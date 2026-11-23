// 文案体检专项断言（版本随产品升级）：事实校正 / 术语统一 / 三端通用 / 无旧文案残留
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
const SRC = fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8');
vm.runInContext(SRC, sb);
const run = c => vm.runInContext(c, sb);
let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log('✓ ' + name); }
  else { fail++; console.log('✗ ' + name + (detail ? '  → ' + detail : '')); }
}
const help = run('JSON.stringify(INFO_PAGES.help)');
const privacy = run('JSON.stringify(INFO_PAGES.privacy)');
const about = run('JSON.stringify(INFO_PAGES.about)');

// ── 事实校正 ──
ok(run('GAME_VERSION') === 'v40', '版本号 v40');
ok(SRC.indexOf('每日奖励！三种道具各 +1～') >= 0, '每日奖励文案与 DAILY_REWARD=3 一致');
ok(SRC.indexOf('每日奖励！额外获得 1 个道具') < 0, '旧「1 个道具」文案已清除');
ok(run('JSON.stringify(DAILY_TASKS)').indexOf('消除 30 格方块') >= 0,
  '任务按实际统计的消除格数命名');
ok(run('JSON.stringify(DAILY_TASKS)').indexOf('消除 30 颗宝石') < 0,
  '不再误称前 20 关的消除格为宝石');
ok(SRC.indexOf("desc: '消行得分，逐关进阶'") >= 0, '首页模式描述符合 v34 后无收集阶段');
ok(SRC.indexOf('desc: \'收集与分数达标过关\'') < 0, '旧首页描述已清除');
ok(help.indexOf('主画面广告福利当天有效；局内广告道具仅本局有效') >= 0,
  '道具有效期区分主画面福利与局内广告');
ok(help.indexOf('每关首次通关获得拼图碎片 +1 片') >= 0, '拼图碎片规则措辞修正');
ok(SRC.indexOf('道具 ×3，') >= 0 && SRC.indexOf('篇集齐再送 ×5') >= 0,
  '篇集齐奖励写明 3+5 而非含糊的 ×8');
ok(SRC.indexOf("'④ 分数达标就过关啦！'") >= 0, '教程末步不再误指右上角');

// ── 三端通用 / 去技术黑话 ──
ok(privacy.indexOf('好友排行榜仅展示微信好友的公开分数') >= 0, '隐私文案去掉开放数据域黑话');
ok(privacy.indexOf('游戏内提供激励视频广告') >= 0, '广告说明三端通用');
ok(privacy.indexOf('清除游戏数据后') >= 0 && privacy.indexOf('清除微信小游戏数据后') < 0,
  '存档清除说明不再限定微信');
ok(about.indexOf('一款安静的方块消除') >= 0, '关于页描述更贴合产品气质');
ok(SRC.indexOf('好友榜只在微信里显示') >= 0, '空榜提示改成人话');
ok(SRC.indexOf('需正式 AppID') < 0, '技术术语已清除');

// ── 术语统一 ──
ok(SRC.indexOf('看广告续命') < 0, '「续命/复活」统一为复活');
ok(SRC.indexOf("'失败重来', 16") < 0 && SRC.indexOf("'再玩一局', 16") >= 0,
  '无尽模式按钮统一为「再玩一局」');
ok(SRC.indexOf("? '重试本关' : '重新开始'") < 0, '死局弹窗不再出现「重新开始」');
ok(SRC.indexOf("S.msg = '这里放不下，换个位置试试！'") >= 0 &&
   SRC.indexOf("这里放不下，再试一次") < 0 && SRC.indexOf('换个位置或点选再放') < 0,
  '放不下提示统一为同一句');
ok(SRC.indexOf('确定要结束吗？') >= 0 && SRC.indexOf('真的要放弃吗？') < 0,
  '放弃确认语不再带负罪感');
ok(SRC.indexOf('已接上上次进度，继续加油！') >= 0, '存档恢复提示更明确');
ok(SRC.indexOf('拖动或点选方块，尽量拿高分！') >= 0, '无尽提示同步点选玩法');
ok(SRC.indexOf('今日已发道具 ×') >= 0 && SRC.indexOf('今日已发 道具 ×') < 0, '空格排版统一');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
