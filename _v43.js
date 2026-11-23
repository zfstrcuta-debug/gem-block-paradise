// v43 专项：难度曲线重排（L1-3 / L4-8 / L9-20 三段 + L21+ 保持）
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
    onTouchStart: noop, onTouchMove: noop, onTouchEnd: noop,
    onHide: noop, onShow: noop
  }
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8'), sb);
const run = c => vm.runInContext(c, sb);
let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}

console.log('\n== 版本 ==');
ok(run('GAME_VERSION') === 'v43', '版本号 v43');

console.log('\n== 逐关曲线 L1-30 ==');
const expect = n => {
  if (n <= 3) return { tier: 0, size: 6, target: 40 + (n - 1) * 10, obs: 0, goal: false };
  if (n <= 8) return { tier: 1, size: 8, target: 80 + (n - 4) * 10, obs: 0, goal: false };
  if (n <= 20) return { tier: 2, size: 10, target: 200 + (n - 9) * 5,
    obs: 0.14 + (n - 9) * 0.007, goal: false };
  const base = 250 + Math.min(30, (n - 21) * 2);
  const size = n % 2 === 0 ? 10 : 8;
  return { tier: 3, size, target: size === 8 ? Math.round(base * 0.8) : base,
    obs: Math.min(size === 8 ? 0.22 : 0.26, 0.22 + (n - 21) * 0.004), goal: true };
};
const badTier = [], badSize = [], badTarget = [], badObs = [], badGoal = [];
for (let n = 1; n <= 30; n++) {
  const e = expect(n);
  if (run('tierOf(' + n + ')') !== e.tier) badTier.push(n);
  if (run('activeSizeOf(' + n + ')') !== e.size) badSize.push(n);
  const t = run('levelTarget(' + n + ')');
  if (t !== e.target) badTarget.push(n + ':' + t);
  const ratio = run('obstacleRatioOf(' + n + ')');
  if (Math.abs(ratio - e.obs) > 1e-9) badObs.push(n + ':' + ratio);
  const hasGoal = run('makeGoal(' + n + ')') !== null;
  if (hasGoal !== e.goal) badGoal.push(n);
}
ok(badTier.length === 0, 'L1-30 tier 分档逐关正确', badTier.join(','));
ok(badSize.length === 0, 'L1-30 盘面尺寸逐关正确', badSize.join(','));
ok(badTarget.length === 0, 'L1-30 目标分逐关正确', badTarget.join(','));
ok(badObs.length === 0, 'L1-30 障碍密度逐关正确', badObs.join(','));
ok(badGoal.length === 0, 'L1-30 收集起始关正确（L21+）', badGoal.join(','));

console.log('\n== 实际开局状态 ==');
for (const seg of [[1, 3, 6, false], [4, 8, 8, false], [9, 20, 10, true]]) {
  const bad = [];
  for (let n = seg[0]; n <= seg[1]; n++) {
    run('startLevel(' + n + ')');
    const active = run('S.active'), target = run('S.target'), goal = run('S.goal');
    const cells = run('(function(){var c=0;for(var y=0;y<N;y++)for(var x=0;x<N;x++)if(S.board[y][x]===OBSTACLE)c++;return c;})()');
    if (active !== seg[2] || target !== expect(n).target || goal !== null) bad.push(n + '(状态)');
    if (seg[3] ? cells < 1 : cells !== 0) bad.push(n + '(障碍=' + cells + ')');
  }
  ok(bad.length === 0, 'L' + seg[0] + '-' + seg[1] + ' 开局盘面/目标/障碍正确', bad.join(','));
}

console.log('\n== 教学有解发牌仅 tier 0 ==');
ok(run('tierOf(3)===0 && tierOf(4)===1 && tierOf(8)===1 && tierOf(9)===2'),
  '教学 tier0 只覆盖 L1-3');
run('startLevel(2);');
ok(run('S.pieces.length') === 3, 'L2 起手三块');
ok(run('S.pieces.every(p => fitCount(p.cells) >= 2)'), 'L2 教学牌组每块 ≥2 落点');

console.log('\n== 障碍 30 关去重起点 ==');
run('S.layoutHistory=[]; for(var n=9;n<=38;n++) startLevel(n);');
ok(run('S.layoutHistory.length') === 30, 'L9-38 去重记录满 30 关');
ok(run('new Set(S.layoutHistory).size') === 30, 'L9-38 图样 30 关不重样');

console.log('\n==== 结果 ==== 通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
