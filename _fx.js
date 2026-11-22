// 消除动效 / 连击 / 阶梯倍率 专项验证
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {};
function mkCtx() {
  return new Proxy({
    measureText: s => ({ width: String(s).length * 9 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}), getImageData: () => ({ data: [] })
  }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}
function cv() { const c = { width: 540, height: 960 }; c.getContext = () => mkCtx(); return c; }

const store = {};
let vibes = [];
const sb = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  isFinite, isNaN, parseInt, parseFloat, setTimeout,
  wx: {
    createCanvas: () => cv(),
    getSystemInfoSync: () => ({ windowWidth: 540, windowHeight: 960, pixelRatio: 1 }),
    getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v },
    getOpenDataContext: () => ({ canvas: cv(), postMessage: noop }),
    vibrateShort: o => vibes.push(o.type),
    onTouchStart: noop, onTouchMove: noop, onTouchEnd: noop
  }
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8'), sb);
const run = c => vm.runInContext(c, sb);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + JSON.stringify(extra) : '')); }
}

// ---- 场景 1：单条消除 ----
run('startLevel(1)');
const reg = run('S.reg');
for (let x = reg.s; x < reg.e; x++) run(`S.board[${reg.s}][${x}] = 3`);
run(`S.board[${reg.s}][${reg.s}] = -1`);            // 留一个洞
run('S.pieces[0] = {cells:[[0,0]],color:"#fff",used:false}');
run('S.score = 0; S.combo = 0;');
run('place(0, ' + reg.s + ', ' + reg.s + ')');

ok('消除后启动动效', run('!!S.fx'));
ok('动效期间锁输入', run('S.lock') === true);
ok('动效格子数 = 一整行', run('S.fx.cells.length') === reg.size, run('S.fx.cells.length'));
ok('连击数 = 1', run('S.combo') === 1);
ok('单条得分 = 10 + 落子 1', run('S.score') === 11, run('S.score'));
ok('震动类型 light', vibes[0] === 'light', vibes);
ok('粒子已生成', run('S.particles.length') > 0);
ok('棋盘逻辑已清空', run(`S.board[${reg.s}][${reg.s}]`) === -1);

run('endFx()');
ok('动效结束解锁', run('S.lock') === false && run('S.fx') === null);
ok('动效结束不动托盘（还有 2 个没用）', run('S.pieces.filter(p => !p.used).length') === 2, run('S.pieces.filter(p => !p.used).length'));

// ---- 场景 2：同一次消两行 → 阶梯倍率 ----
run('startLevel(1)');
const r2 = run('S.reg');
for (let y = r2.s; y < r2.s + 2; y++)
  for (let x = r2.s; x < r2.e; x++) if (!(x === r2.s && (y === r2.s || y === r2.s + 1))) run(`S.board[${y}][${x}] = 3`);
run('S.pieces[0] = {cells:[[0,0],[0,1]],color:"#fff",used:false}');
run('S.score = 0; S.combo = 0;');
run('place(0, ' + r2.s + ', ' + r2.s + ')');
ok('双行倍率 = 2.5 → 50 分', run('S.score') === 52, run('S.score'));  // 2 格落子 + 50
ok('双条震动 = medium', vibes[vibes.length - 1] === 'medium', vibes[vibes.length - 1]);
ok('msg 带倍率提示', run('S.msg').indexOf('2.5') >= 0, run('S.msg'));

// ---- 场景 3：三行 → ×4 且 heavy 震动 ----
run('startLevel(1)');
const r3 = run('S.reg');
for (let y = r3.s; y < r3.s + 3; y++)
  for (let x = r3.s; x < r3.e; x++) if (!(x === r3.s && y < r3.s + 3)) run(`S.board[${y}][${x}] = 3`);
run('S.pieces[0] = {cells:[[0,0],[0,1],[0,2]],color:"#fff",used:false}');
run('S.score = 0; S.combo = 0;');
run('place(0, ' + r3.s + ', ' + r3.s + ')');
ok('三条倍率 = 4 → 120 分', run('S.score') === 123, run('S.score'));
ok('三条震动 = heavy', vibes[vibes.length - 1] === 'heavy', vibes[vibes.length - 1]);

// ---- 场景 4：连击递增与断连 ----
run('startLevel(1)');
const r4 = run('S.reg');
function oneLine() {
  for (let x = r4.s; x < r4.e; x++) run(`S.board[${r4.s}][${x}] = 3`);
  run(`S.board[${r4.s}][${r4.s}] = -1`);
  run('S.pieces[0] = {cells:[[0,0]],color:"#fff",used:false}');
  run('place(0, ' + r4.s + ', ' + r4.s + ')');
  run('endFx()');
}
oneLine(); oneLine(); oneLine();
ok('连击累加到 3', run('S.combo') === 3, run('S.combo'));
run('S.pieces[0] = {cells:[[0,0]],color:"#fff",used:false}');
const free = run('(function(){for(let y=S.reg.s;y<S.reg.e;y++)for(let x=S.reg.s;x<S.reg.e;x++)if(S.board[y][x]===-1)return {x:x,y:y};return {x:S.reg.s,y:S.reg.s};})()');
run('place(0, ' + free.x + ', ' + free.y + ')');
ok('无消除则连击归零', run('S.combo') === 0, run('S.combo'));

// ---- 场景 5：动效中触发通关，弹窗要等动效播完 ----
run('startLevel(1)');
const r5 = run('S.reg');
for (let x = r5.s; x < r5.e; x++) run(`S.board[${r5.s}][${x}] = 3`);
run(`S.board[${r5.s}][${r5.s}] = -1`);
run('S.pieces[0] = {cells:[[0,0]],color:"#fff",used:false}');
run('S.target = 1; S.goal = null;');
run('place(0, ' + r5.s + ', ' + r5.s + ')');
ok('动效中还没弹过关窗', run("S.result") === '', run('S.result'));
run('endFx()');
ok('动效后才弹过关窗', run("S.result") === 'win', run('S.result'));

console.log('\n==== 结果 ====');
console.log('通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
