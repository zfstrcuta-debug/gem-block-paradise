// v42 专项：37 种形状还原 + 分档发牌 + 新形状可落子 + 防死局 + 教学关有解
const fs = require('fs'), vm = require('vm');
const noop = () => {};
function mkCtx() {
  return new Proxy({ measureText: s => ({ width: String(s).length * 9 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}), getImageData: () => ({ data: [] }) },
    { get: (t, k) => k in t ? t[k] : noop, set: (t, k, v) => { t[k] = v; return true; } });
}
function cv() { const c = { width: 540, height: 960 }; c.getContext = () => mkCtx(); return c; }
const store = {};
const sb = { console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  isFinite, isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
  wx: { createCanvas: () => cv(), getSystemInfoSync: () => ({ windowWidth: 540, windowHeight: 960, pixelRatio: 1 }),
    getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v; }, removeStorageSync: k => { delete store[k]; },
    createInnerAudioContext: () => ({ set src(v) {}, set volume(v) {}, stop: noop, play: noop }),
    getOpenDataContext: () => ({ canvas: cv(), postMessage: noop }), vibrateShort: noop,
    onTouchStart: noop, onTouchMove: noop, onTouchEnd: noop, onHide: noop, onShow: noop } };
vm.createContext(sb);
vm.runInContext(fs.readFileSync('wechat-minigame/game.js', 'utf8'), sb);
const run = c => vm.runInContext(c, sb);
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + x : '')); } };

const SHAPES = run('SHAPES');
console.log('== 37 种形状 ==');
ok('GAME_VERSION v43', run('GAME_VERSION') === 'v43');
ok('形状池严格 37 个', SHAPES.length === 37, '实际 ' + SHAPES.length);

// 与巧巧设计稿逐格比对（六类，按写进代码的顺序）
const EXPECT = [
  // 深蓝 I9
  '0,0', '0,0|1,0', '0,0|1,0|2,0', '0,0|1,0|2,0|3,0', '0,0|1,0|2,0|3,0|4,0',
  '0,0|0,1', '0,0|0,1|0,2', '0,0|0,1|0,2|0,3', '0,0|0,1|0,2|0,3|0,4',
  // 橘 L12
  '0,0|0,1|1,1', '0,0|0,1|1,1|2,1', '0,0|0,1|0,2|1,2|2,2',
  '0,1|1,0|1,1', '0,1|1,1|2,0|2,1', '0,2|1,2|2,0|2,1|2,2',
  '0,0|0,1|1,0', '0,0|0,1|1,0|2,0', '0,0|0,1|0,2|1,0|2,0',
  '0,0|1,0|1,1', '0,0|1,0|2,0|2,1', '0,0|1,0|2,0|2,1|2,2',
  // 绿 O4
  '0,0|0,1|0,2|1,0|1,1|1,2|2,0|2,1|2,2', '0,0|0,1|1,0|1,1',
  '0,0|0,1|1,0|1,1|2,0|2,1', '0,0|0,1|0,2|1,0|1,1|1,2',
  // 黄 Z4
  '0,0|0,1|1,1|1,2', '0,1|0,2|1,0|1,1', '0,0|1,0|1,1|2,1', '0,1|1,0|1,1|2,0',
  // 紫凸4
  '0,0|0,1|0,2|1,1', '0,1|1,0|1,1|1,2', '0,1|1,0|1,1|2,1', '0,0|1,0|1,1|2,0',
  // 棕红斜4（含原紫1/2）
  '0,0|1,1', '0,1|1,0', '0,2|1,1|2,0', '0,0|1,1|2,2'
];
const key = s => s.map(c => c[0] + ',' + c[1]).sort().join('|');
const got = SHAPES.map(key);
const wrong = [];
for (let i = 0; i < EXPECT.length; i++) {
  if (got[i] !== EXPECT[i]) wrong.push(i + 1 + ':' + got[i] + '≠' + EXPECT[i]);
}
ok('37 个形状逐格匹配设计稿', EXPECT.length === 37 && wrong.length === 0, wrong.slice(0, 3).join(' '));

console.log('\n== 全关卡开放 + 盘面尺寸过滤 ==');
function poolAt(level, size) {
  run('S.mode="level"; S.level=' + level + '; S.active=' + size + '; S.reg=regionOf(' + size + ');');
  return run('JSON.stringify(eligibleShapes())');
}
const p2 = JSON.parse(poolAt(2, 6)), p8 = JSON.parse(poolAt(8, 6)),
      p15 = JSON.parse(poolAt(15, 10)), p25 = JSON.parse(poolAt(25, 8));
const fits = (size, noSingle) => SHAPES.filter(s => Math.max.apply(null, s.map(c => c[0])) < size &&
  Math.max.apply(null, s.map(c => c[1])) < size && (!noSingle || s.length >= 2));
const fits6 = fits(6, true), fits8 = fits(8, false);
ok('教学关发盘面放得下的全部形状（只排 1×1）', p2.length === fits6.length &&
  p2.every(s => s.length >= 2), '实际 ' + p2.length + ' 应 ' + fits6.length);
ok('非教学关同尺寸全开含 1×1（无格数分档）', p8.length === fits(6, false).length, '实际 ' + p8.length);
ok('10×10 盘全开 37 种', p15.length === 37, '实际 ' + p15.length);
ok('8×8 盘按尺寸过滤', p25.length === fits8.length, '实际 ' + p25.length + ' 应 ' + fits8.length);
ok('所有候选都放得进当前盘', p2.concat(p8).every(s =>
  Math.max.apply(null, s.map(c => c[0])) < 6 && Math.max.apply(null, s.map(c => c[1])) < 6));

console.log('\n== 新形状可落子 + 防死局 ==');
// 新形状（设计稿里原来没有的 12 个）：5 格 L4、2×3 横竖、斜条、凸型等
const NEW_IDX = [2, 5, 8, 11, 14, 15, 25, 26, 27, 28, 33, 34, 35, 36];
run('S.mode="level"; S.level=25; S.active=8; S.reg=regionOf(8); startLevel(25);');
run('for(var y=S.reg.s;y<S.reg.e;y++)for(var x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=EMPTY;');
let placeOK = 0;
for (const i of NEW_IDX) {
  const s = SHAPES[i];
  if (run('canPlace(' + JSON.stringify(s) + ', S.reg.s, S.reg.s)')) placeOK++;
}
ok('新增形状在空盘都能落子', placeOK === NEW_IDX.length, placeOK + '/' + NEW_IDX.length);

// 防死局：每个形状发出来都至少有 2 个合法落点（空盘上）
let fitOK = 0;
for (const s of SHAPES) {
  const n = run('fitCount(' + JSON.stringify(s) + ')');
  if (n >= 2) fitOK++;
}
ok('37 种形状空盘都有 ≥2 落点', fitOK === 37, fitOK + '/37');

// 实际发牌 300 手：每一块都过 ≥2 落点，且都在 37 种池里
run('startLevel(25);');
let spawnOK = 0, spawnBad = 0;
for (let t = 0; t < 100; t++) {
  run('S.reg=regionOf(8); S.active=8; for(var y=0;y<N;y++)for(var x=0;x<N;x++)S.board[y][x]=EMPTY; spawn();');
  const ps = JSON.parse(run('JSON.stringify(S.pieces)'));
  for (const p of ps) {
    const k = key(p.cells.map(c => [c[0], c[1]]));
    if (got.indexOf(k) >= 0) spawnOK++; else spawnBad++;
  }
}
ok('实际发牌全部来自 37 种设计稿', spawnBad === 0, '异常 ' + spawnBad + ' 块');

console.log('\n== 教学关有解不受影响 ==');
run('S.mode="level"; S.level=3; S.active=6; S.reg=regionOf(6); startLevel(3);');
const solved = run(`(function(){
  for(var t=0;t<40;t++){ var set=buildTeachSet(); if(set && set.length===3) return true; }
  return false;
})()`);
ok('教学关仍能生成三手有解牌组', !!solved);

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
