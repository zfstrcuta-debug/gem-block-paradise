// 暂停/暂存续玩回归：落子→暂存→模拟杀进程→冷启动恢复，局面必须一致
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DW = 540, DH = 960;
function makeCtx() {
  const noop = () => {};
  return {
    canvas: null,
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    arc: noop, ellipse: noop, rect: noop, clip: noop, fill: noop, stroke: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, drawImage: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop, transform: noop,
    fillText: noop, strokeText: noop,
    measureText: (s) => ({ width: String(s).length * 9 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    getImageData: () => ({ data: [] }),
    setLineDash: noop,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    font: '', textAlign: 'left', textBaseline: 'alphabetic',
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', lineDashOffset: 0,
    fillStyle: '#000', strokeStyle: '#000'
  };
}
// 存储模拟（含 removeStorageSync，真实 wx 有、旧 mock 可能没有）
const store = {};
function makeCtx() {
  const noop = () => {};
  return {
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    arc: noop, ellipse: noop, rect: noop, clip: noop, fill: noop, stroke: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, drawImage: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop, transform: noop,
    fillText: noop, strokeText: noop,
    measureText: (s) => ({ width: String(s).length * 9 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    getImageData: () => ({ data: [] }),
    setLineDash: noop,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    lineCap: 'butt', lineJoin: 'miter', font: '10px sans',
    textAlign: 'left', textBaseline: 'alphabetic',
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0
  };
}
function makeCanvas(w, h) {
  const cv = { width: w || 300, height: h || 150 };
  const c = makeCtx(); c.canvas = cv;
  cv.getContext = () => c;
  return cv;
}
const wx = {
  createCanvas: (w, h) => makeCanvas(w, h),
  getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2, platform: 'devtools' }),
  getStorageSync: (k) => store[k],
  setStorageSync: (k, v) => { store[k] = v; },
  removeStorageSync: (k) => { delete store[k]; },
  getOpenDataContext: () => ({ canvas: makeCanvas(480, 626), postMessage: () => {} }),
  onTouchStart: () => {}, onTouchMove: () => {}, onTouchEnd: () => {},
  vibrateShort: () => {},
  createInnerAudioContext: () => null,
  shareAppMessage: () => {}
};
let nextFrameCb = null;
const sandbox = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean, isFinite, isNaN,
  parseInt, parseFloat, setTimeout, clearTimeout,
  requestAnimationFrame: (cb) => { nextFrameCb = cb; },
  wx
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const code = fs.readFileSync(path.join(__dirname, 'wechat-minigame/game.js'), 'utf8');
vm.runInContext(code, sandbox, { filename: 'game.js' });

const g = sandbox;
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}

console.log('== 暂存往返 ==');
const run = (expr) => vm.runInContext(expr, sandbox);

run("startLevel(21)");   // v34：收集目标后移到 L21+
// 模拟落两手（在 vm 内找可落位置）
run(`
  function __find() {
    for (let i = 0; i < 3; i++) {
      const p = S.pieces[i];
      if (p.used) continue;
      for (let y = S.reg.s; y < S.reg.e; y++) for (let x = S.reg.s; x < S.reg.e; x++) {
        const fits = p.cells.every(([dx, dy]) => {
          const yy = y + dy, xx = x + dx;
          return yy >= S.reg.s && yy < S.reg.e && xx >= S.reg.s && xx < S.reg.e && S.board[yy][xx] === -1;
        });
        if (fits) return { i, x, y };
      }
    }
    return null;
  }
`);
for (let m = 0; m < 2; m++) run("var __mv = __find(); if (__mv) place(__mv.i, __mv.x, __mv.y);");
ok(run("S.scene") === 'play' && !run("S.result"), '落子后仍在局内');
const snap = store['resume'];
ok(!!snap, '落子后已写入暂存');
ok(snap && snap.mode === 'level' && snap.level === 21, '暂存含关卡信息');
ok(snap && snap.goal && Object.keys(snap.goal).length > 0, '暂存含收集目标');

// 模拟杀进程：全新 sandbox，只留存储
const sandbox2 = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean, isFinite, isNaN,
  parseInt, parseFloat, setTimeout, clearTimeout,
  requestAnimationFrame: (cb) => { nextFrameCb = cb; },
  wx
};
sandbox2.globalThis = sandbox2;
vm.createContext(sandbox2);
vm.runInContext(code, sandbox2, { filename: 'game.js' });
const run2 = (expr) => vm.runInContext(expr, sandbox2);

ok(run2("S.scene") === 'play', '冷启动直接回到局内（续玩）');
ok(run2("S.mode") === 'level' && run2("S.level") === 21, '恢复的关卡一致');
ok(run2("S.score") === snap.score, '恢复的分数一致');
ok(run2("S.board.length") === 10, '棋盘已重建');
ok(!store['resume'], '恢复后暂存已清（防重复恢复）');

console.log('== 死局/退出清暂存 ==');
run2("startEndless()");
run2(`
  for (let y = S.reg.s; y < S.reg.e; y++) {
    for (let x = S.reg.s; x < S.reg.e; x++) {
      if ((x * 7 + y * 3) % 5 !== 0) S.board[y][x] = (x + y) % 6;
    }
  }
  S.pieces = [
    { cells: [[0,0],[0,1],[1,0],[1,1]], color: 0, used: false },
    { cells: [[0,0],[0,1],[1,0],[1,1]], color: 1, used: true },
    { cells: [[0,0],[0,1],[1,0],[1,1]], color: 2, used: true }
  ];
  S.over = checkOver();
  doLose();
`);
ok(!store['resume'], '死局后暂存已清');
run2("toMenu()");
ok(!store['resume'], '回主画面暂存仍为空');

console.log('== 广告福利盲盒 ==');
ok(run2("drawAdDialog.toString()").indexOf("ITEM_NAMES[S.pendingAd.item] + ' ×1 · 今天有效") === -1,
  '弹窗不再预告 menuReward 的道具名');
ok(run2("drawAdDialog.toString()").indexOf("type === 'menuReward'") !== -1 &&
   run2("drawAdDialog.toString()").indexOf("'?'") !== -1, 'menuReward 弹窗画盲盒问号');
run2("requestAd({ type: 'menuReward' })");
ok(run2("S.pendingAd") && run2("S.pendingAd.type") === 'menuReward' &&
   run2("S.pendingAd.item") === undefined, 'pendingAd 不预传道具');
ok(run2("drawMenuReveal.toString()").indexOf('ITEM_NAMES[S.menuReveal.item]') !== -1,
  '揭晓卡展示具体道具');
// 看完广告 → 揭晓卡与计数
run2("S.menuAd = { date: today(), count: 0 }; S.dayItems = [0,0,0]; S.menuAdPulse = 0;");
run2(`
  (function confirmMenuAd() {
    menuAdReset();
    const it = Math.floor(Math.random() * 3);
    S.dayItems[it] += 1;
    S.menuAd.count += 1;
    S.menuReveal = { item: it, t0: Date.now() };
  })();
`);
ok(run2("S.menuAd.count") === 1, '看完广告计数 +1');
ok(run2("S.dayItems.reduce((a,b)=>a+b,0)") === 1, '道具进当日池 ×1');
ok(!!run2("S.menuReveal") && run2("S.menuReveal.item") >= 0 && run2("S.menuReveal.item") < 3,
  '看完广告才掷出揭晓道具');

console.log('==== 结果 ==== 通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
