// v38 专项断言：吸附边界对齐格中心 / 就近吸附按真实距离 / 锁区不画方块本体
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {};
function makeCtx() {
  return new Proxy({
    measureText: s => ({ width: String(s).length * 9 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}), getImageData: () => ({ data: [] }),
    setLineDash: noop
  }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}
function cv() { const c = { width: 540, height: 960 }; c.getContext = () => makeCtx(); return c; }
const store = {};
const sb = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  isFinite, isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
  requestAnimationFrame: () => 0,
  cellCalls: { n: 0 },
  wx: {
    createCanvas: () => cv(),
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2 }),
    getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v },
    removeStorageSync: k => { delete store[k]; },
    getOpenDataContext: () => ({ canvas: cv(), postMessage: noop }),
    vibrateShort: noop, onTouchStart: noop, onTouchMove: noop, onTouchEnd: noop,
    onHide: noop, onShow: noop
  }
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8'), sb);
const run = c => vm.runInContext(c, sb);
let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log('✓ ' + name); }
  else { fail++; console.log('✗ ' + name + (detail ? ' | ' + detail : '')); }
}
const BX = run('BX'), BY = run('BY'), CELL = run('CELL'), GAP = run('GAP'), LIFT = run('DRAG_LIFT');
const STEP = CELL + GAP;

ok(run('GAME_VERSION') === 'v43', '版本号 v43');
const src = fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8');
ok(src.includes('piece(p, a.x, a.y, CELL, CELL + GAP)'), '拖拽预览用棋盘真实格距');
ok(src.includes('function piece(p, cx, cy, unit, step)'), 'piece 支持独立 step');

// ---- 吸附边界：格中心 ±20px 不跳格，边界在 ±24px ----
run('startLevel(1); S.pieces=[{cells:[[0,0,6]],used:false}];');
const centerX = BX + 4 * STEP + CELL / 2, centerY = BY + 4 * STEP + CELL / 2;
const at = dx => run(`snapOrigin(S.pieces[0],{x:${centerX + dx},y:${centerY + LIFT}})`);
ok(at(0).x === 4 && at(0).y === 4, '锚点在格中心 → 落该格');
ok(at(20).x === 4 && at(-20).x === 4, '格中心 ±20px 仍落同格');
ok(at(23).x === 4 && at(26).x === 5, '换格边界在两格之间（+24px）');

// ---- 各宽度形状：几何中心对准锚点 ----
for (const w of [1, 2, 3, 4]) {
  const cells = Array.from({ length: w }, (_, i) => [i, 0, 6]);
  run('S.pieces=[{cells:' + JSON.stringify(cells) + ',used:false}];');
  const want = 5 + (w - 1) / 2;                 // 希望形状中心落在格坐标 want
  const px = BX + want * STEP + CELL / 2;
  const o = run(`snapOrigin(S.pieces[0],{x:${px},y:${centerY + LIFT}})`);
  const got = BX + (o.x + (w - 1) / 2) * STEP + CELL / 2;
  ok(Math.abs(got - px) < 2, w + ' 格宽落点中心与锚点对齐', '差 ' + (got - px).toFixed(1) + 'px');
}

// ---- 就近吸附按真实距离，不再跳斜角 ----
// board 索引是 [y][x]：占住中心与左右下及四斜角，只留正上方一个空格
run('startLevel(1); (function(){for(var y=S.reg.s;y<S.reg.e;y++)for(var x=S.reg.s;x<S.reg.e;x++)S.board[y][x]=EMPTY; var c=S.reg.s+4; S.board[c][c]=6; S.board[c][c-1]=6; S.board[c][c+1]=6; S.board[c+1][c]=6; S.board[c-1][c-1]=6; S.board[c-1][c+1]=6; S.board[c+1][c-1]=6; S.board[c+1][c+1]=6; __c=c;})()');
const c = run('__c');
const fit = run(`nearFit([[0,0]], ${c}, ${c})`);
ok(fit && fit.x === c && fit.y === c - 1, '正上方空格优先于斜角空格', JSON.stringify(fit));

// ---- 锁区只画空框，不画方块本体 ----
run('drawCellOf=function(){cellCalls.n++}; S.mode="level"; S.reg={s:4,e:10,size:6};');
run('S.board[2][2]=EMPTY; S.pieces=[{cells:[[0,0,6]],used:false}]; cellCalls.n=0; drawGhost(S.pieces[0],2,2,false);');
ok(sb.cellCalls.n === 0, '锁区位置不调用 drawCellOf（不会看成移进去）');
run('S.board[4][4]=EMPTY; cellCalls.n=0; drawGhost(S.pieces[0],4,4,true);');
ok(sb.cellCalls.n === 1, '开放区合法位置仍正常画预览');

console.log('==== 结果 ==== 通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
