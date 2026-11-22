// 关卡分数线基准：用贪心自动玩家模拟真实对局，看每关能打到多少分
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
const sb = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  isFinite, isNaN, parseInt, parseFloat, setTimeout,
  requestAnimationFrame: () => 0,
  wx: {
    createCanvas: () => cv(),
    getSystemInfoSync: () => ({ windowWidth: 540, windowHeight: 960, pixelRatio: 1 }),
    getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v },
    getOpenDataContext: () => ({ canvas: cv(), postMessage: noop }),
    vibrateShort: noop,
    onTouchStart: noop, onTouchMove: noop, onTouchEnd: noop
  }
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8'), sb);
const run = c => vm.runInContext(c, sb);

// 一步贪心：三块里挑「能消最多条」的落点，同分取覆盖格子多的
const STEP = `(function(){
  if (S.over) return 'over';
  var best = null;
  for (var i = 0; i < S.pieces.length; i++) {
    var p = S.pieces[i];
    if (p.used) continue;
    for (var y = S.reg.s; y < S.reg.e; y++) for (var x = S.reg.s; x < S.reg.e; x++) {
      if (!canPlace(p.cells, x, y)) continue;
      var bak = S.board.map(function(r){ return r.slice(); });
      for (var k = 0; k < p.cells.length; k++) S.board[y + p.cells[k][1]][x + p.cells[k][0]] = 1;
      var lines = 0, yy, xx, full;
      for (yy = S.reg.s; yy < S.reg.e; yy++) { full = true;
        for (xx = S.reg.s; xx < S.reg.e; xx++) if (S.board[yy][xx] < 0) { full = false; break; }
        if (full) lines++; }
      for (xx = S.reg.s; xx < S.reg.e; xx++) { full = true;
        for (yy = S.reg.s; yy < S.reg.e; yy++) if (S.board[yy][xx] < 0) { full = false; break; }
        if (full) lines++; }
      S.board = bak;
      var sc = lines * 1000 + p.cells.length;
      if (!best || sc > best.sc) best = { i: i, x: x, y: y, sc: sc };
    }
  }
  if (!best) return 'stuck';
  place(best.i, best.x, best.y);
  if (S.fx) endFx();
  return 'ok';
})()`;

function playOnce(n) {
  run('startLevel(' + n + '); S.target = 1e9; S.goal = null; S.loseHint = null;');
  let steps = 0;
  while (steps++ < 300) {
    const r = run(STEP);
    if (r !== 'ok') break;
  }
  return { score: run('S.score'), steps, lines: run('S.totalLines || 0') };
}

function stats(n, tries) {
  const arr = [];
  for (let i = 0; i < tries; i++) arr.push(playOnce(n).score);
  arr.sort((a, b) => a - b);
  const sum = arr.reduce((a, b) => a + b, 0);
  const q = p => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
  return {
    level: n,
    avg: Math.round(sum / arr.length),
    p25: q(0.25), p50: q(0.5), p75: q(0.75),
    min: arr[0], max: arr[arr.length - 1],
    oldTarget: run('levelTarget(' + n + ')')
  };
}

console.log('关卡  旧分数线   平均   25%    中位   75%    最高');
const list = [1, 3, 5, 8, 10, 11, 15, 20, 21, 25];
const rows = [];
for (const n of list) {
  const s = stats(n, 12);
  rows.push(s);
  console.log(
    String(s.level).padStart(4) + '  ' +
    String(s.oldTarget).padStart(7) + '  ' +
    String(s.avg).padStart(6) + '  ' +
    String(s.p25).padStart(6) + '  ' +
    String(s.p50).padStart(6) + '  ' +
    String(s.p75).padStart(6) + '  ' +
    String(s.max).padStart(6)
  );
}
console.log('\n建议分数线（目标：让「中位玩家刚好过、高手有余量」≈ p50×0.75）');
for (const s of rows) {
  console.log('  L' + s.level + ' → ' + Math.round(s.p50 * 0.75) + '  (旧 ' + s.oldTarget + ')');
}
