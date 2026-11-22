// 每日任务 + 下一关判定 专项验证
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

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}

// ---- 每日任务 ----
run('dailyReset()');
ok('初始三条未完成', run('dailyDoneCount()') === 0);
ok('初始不可领取', run('dailyCanClaim()') === false);

run("addDaily('lines', 8); addDaily('gems', 30);");
ok('两条完成，第三条未完成', run('dailyDoneCount()') === 2, run('dailyDoneCount()'));
ok('未全完成不可领取', run('dailyCanClaim()') === false);

run("addDaily('games', 2)");
ok('三条全完成', run('dailyDoneCount()') === 3);
ok('可以领取', run('dailyCanClaim()') === true);

const before = JSON.stringify(run('S.dayItems'));
run('claimDaily()');
ok('领取后三种道具各 +1', JSON.stringify(run('S.dayItems')) !== before && run('S.dayItems').join(',') === '1,1,1', run('S.dayItems'));
ok('领取后标记已领', run('S.daily.claimed') === true);
ok('重复领取被拒', run('claimDaily()') === false);

// 跨天重置
run("S.daily.date = '2000-1-1'; dailyReset();");
ok('跨天重置进度', run('dailyDoneCount()') === 0 && run('S.daily.claimed') === false);

// 消除要计入任务
run('startLevel(1)');
const r = run('S.reg');
run("S.daily = {date: today(), lines:0, gems:0, games:0, claimed:false}");
for (let x = r.s; x < r.e; x++) run(`S.board[${r.s}][${x}] = 3`);
run(`S.board[${r.s}][${r.s}] = -1`);
run('S.pieces[0] = {cells:[[0,0]],color:"#fff",used:false}');
run('place(0, ' + r.s + ', ' + r.s + ')');
ok('消除计入任务线数', run('S.daily.lines') === 1, run('S.daily.lines'));
ok('消除计入任务宝石数', run('S.daily.gems') === r.size, run('S.daily.gems'));

// 弹窗渲染
run('endFx(); S.scene = "menu"; S.dailyModal = true; draw();');
ok('每日任务弹窗绘制不崩', true);
run('S.daily.lines = 8; S.daily.gems = 30; S.daily.games = 2; S.daily.claimed = false; draw();');
ok('可领取状态绘制不崩', true);
run('S.daily.claimed = true; draw(); S.dailyModal = false;');
ok('已领取状态绘制不崩', true);

// ---- 下一关判定 ----
run('S.cleared = {L1:true,L2:true,L3:true,L4:true}; S.lastLevel = 3;');
ok('通4关但 lastLevel 掉了 → 下一关 5', run('resumeLevel()') === 5, run('resumeLevel()'));
run('S.level = 4; doWin();');
ok('通关后 lastLevel 自动推进到 5', run('S.lastLevel') === 5, run('S.lastLevel'));
run('S.lastLevel = 2; S.cleared = {L1:true};');
ok('只通1关 → 下一关 2', run('resumeLevel()') === 2, run('resumeLevel()'));
run('S.lastLevel = 7; S.cleared = {L1:true};');
ok('曾在第7关失败 → 继续第7关', run('resumeLevel()') === 7, run('resumeLevel()'));

// ---- 主菜单渲染 ----
run('toMenu(); draw();');
ok('主菜单含任务行绘制不崩', true);

console.log('\n==== 结果 ====');
console.log('通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
