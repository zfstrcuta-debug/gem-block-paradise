// v34 专项断言：小孩化难度 / 收集后移 / 纯普通块 / 全局防死局发牌 / 一次性教程
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {};
function makeCtx() {
  return new Proxy({
    measureText: s => ({ width: String(s).length * 9 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}), getImageData: () => ({ data: [] })
  }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}
function cv() { const c = { width: 540, height: 960 }; c.getContext = () => makeCtx(); return c; }
const store = {};
const touches = { start: null, move: null, end: null };
const sb = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  isFinite, isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
  requestAnimationFrame: () => 0,
  wx: {
    createCanvas: () => cv(),
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2 }),
    getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v },
    removeStorageSync: k => { delete store[k]; },
    getOpenDataContext: () => ({ canvas: cv(), postMessage: noop }),
    vibrateShort: noop,
    onTouchStart: f => { touches.start = f; },
    onTouchMove: f => { touches.move = f; },
    onTouchEnd: f => { touches.end = f; },
    onHide: noop, onShow: noop
  }
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8'), sb);
const run = c => vm.runInContext(c, sb);
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name); } }
const reset = () => run('S.tutorialDone = false;');

console.log('\n== 难度分档（v43 三段）==');
ok([1, 2, 3].every(n => run('activeSizeOf(' + n + ')') === 6), 'L1-3 是 6×6');
ok([4, 5, 6, 7, 8].every(n => run('activeSizeOf(' + n + ')') === 8), 'L4-8 是 8×8');
ok([9, 10, 15, 20].every(n => run('activeSizeOf(' + n + ')') === 10), 'L9-20 是 10×10');
ok(run('activeSizeOf(21)') === 8 && run('activeSizeOf(22)') === 10, 'L21+ 10×10 / 8×8 交替');
ok(run('levelTarget(1)') === 40 && run('levelTarget(2)') === 50 && run('levelTarget(3)') === 60,
  'L1-3 目标 40/50/60');
ok(run('levelTarget(4)') === 80 && run('levelTarget(8)') === 120, 'L4-8 目标 80~120');
ok(run('levelTarget(9)') === 200 && run('levelTarget(20)') === 255, 'L9-20 目标 200~255');
ok([1, 3, 4, 8].every(n => run('obstacleRatioOf(' + n + ')') === 0), 'L1-8 零障碍');
ok([9, 15, 20, 21].every(n => run('obstacleRatioOf(' + n + ')') > 0), 'L9 起有障碍');

console.log('\n== 收集目标后移 ==');
for (let n = 1; n <= 20; n++) ok(run('makeGoal(' + n + ')') === null, 'L' + n + ' 无收集目标');
ok(!!run('makeGoal(21)'), 'L21 开始有收集目标');
ok(!!run('makeGoal(30)'), 'L30 保持收集目标');

console.log('\n== 无目标关纯普通块 ==');
run("S.mode='level'; S.scene='play'; startLevel(10);");
let allPlain = true;
for (let t = 0; t < 30; t++) {
  run('spawn()');
  const codes = run('JSON.stringify(S.pieces.map(p => p.cells.map(c => c[2])))');
  const flat = JSON.parse(codes).flat();
  if (flat.some(c => c < 6 || c >= 18)) { allPlain = false; break; }
}
ok(allPlain, 'L10 连抽 30 批全是普通块编码 6..11');
run('startLevel(25);');
let hasGem = false;
for (let t = 0; t < 20 && !hasGem; t++) {
  run('spawn()');
  const codes = run('JSON.stringify(S.pieces.map(p => p.cells.map(c => c[2])))');
  hasGem = JSON.parse(codes).flat().some(c => c >= 0 && c < 6);
}
ok(hasGem, 'L25 仍会出宝石（收集目标保留）');

console.log('\n== 全局防死局发牌（每块 ≥2 落点）==');
function fitCheck(level, boardFill) {
  run("startLevel(" + level + ");");
  if (boardFill > 0) run('(function(){var k=0;for(var y=S.reg.s;y<S.reg.e;y++)for(var x=S.reg.s;x<S.reg.e;x++){if(k++%100<' + Math.round(boardFill * 100) + ') S.board[y][x]=6;}})()');
  let worst = 99, bad = 0;
  for (let round = 0; round < 40; round++) {
    run('spawn()');
    const counts = run('JSON.stringify(S.pieces.map(p => fitCount(p.cells)))');
    JSON.parse(counts).forEach(n => { worst = Math.min(worst, n); if (n < 2) bad++; });
    // 用掉一块后补牌，模拟真实推进
    run('S.pieces[0].used = true; spawn();');
  }
  return { worst, bad };
}
[1, 5, 10, 15, 21, 30].forEach(n => {
  const r = fitCheck(n, 0);
  ok(r.bad === 0, 'L' + n + ' 空盘 40 轮每块 ≥2 落点（最少 ' + r.worst + '）');
});
// v36：L1 教学关优先走「有解发牌」，盘面极挤时会退回 fitPiece 腾位；
// 那里的落点规则由 L10/L21 覆盖，L1 满盘只要求不崩（game over 是正常结局）。
[10, 21].forEach(n => {
  const r = fitCheck(n, 0.75);
  ok(r.bad === 0, 'L' + n + ' 盘面填 75% 时仍每块 ≥2 落点（最少 ' + r.worst + '）');
});

console.log('\n== 拖拽锚点与就近吸附 ==');
ok(run('dragAnchor({x:100,y:500}).y') === 442, '拖拽锚点上移 58px');
ok(run('nearFit([[0,0]], 3, 3).x') === 3, '合法落点不改写');
run('startLevel(1); (function(){for(var y=S.reg.s;y<S.reg.e;y++)for(var x=S.reg.s;x<S.reg.e;x++)S.board[y][x]=EMPTY; var c=S.reg.s+2; S.board[c][c]=6; var b={x:c,y:c}; b.snap=nearFit([[0,0]], b.x, b.y); globalThis.__blk=b;})()');
const nf = run('JSON.stringify(globalThis.__blk.snap)');
const snap = JSON.parse(nf);
ok(snap && snap.snapped === true && run('S.board[__blk.y][__blk.x]') === 6, '占用格落点自动吸附到 ±2 内的空格（' + JSON.stringify(snap) + '）');

console.log('\n== 一次性动态教程 ==');
reset();
run("startLevel(1);");
ok(run('S.tutorial && S.tutorial.step') === 0, '首次进第 1 关启动教程 step0');
run('tutorialAdvance(1); tutorialAdvance(2); tutorialAdvance(3);');
ok(run('S.tutorial.step') === 3, '教程可推进到 step3');
run('tutorialFinish();');
ok(run('S.tutorialDone') === true && !!store['tutorialDone'], '完成后写存档');
run("startLevel(1);");
ok(run('S.tutorial') === null, '再次进第 1 关不再弹教程');
reset(); store['tutorialDone'] = true;
run('loadSave(); startLevel(1);');
ok(run('S.tutorial') === null, '冷启动读到 tutorialDone 也不弹');
reset(); delete store['tutorialDone'];
run('loadSave();');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
