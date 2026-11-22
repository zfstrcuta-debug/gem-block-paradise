// 渲染冒烟：mock 微信 Canvas 环境，遍历全部画面，捕获异常与坐标越界
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DW = 540, DH = 960;
const calls = [];
let curCanvas = null;

function makeCtx() {
  const rec = { ops: 0 };
  const noop = () => { rec.ops++; };
  const ctx = {
    __rec: rec,
    canvas: null,
    save: noop, restore: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    arc: noop, ellipse: noop, rect: noop, clip: noop, fill: noop, stroke: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop, drawImage: noop,
    translate: noop, rotate: noop, scale: noop, setTransform: noop, transform: noop,
    fillText: (s, x, y) => {
      rec.ops++;
      if (typeof s === 'string' && /undefined|NaN/.test(s)) {
        calls.push({ level: 'ERROR', msg: '文字含 undefined/NaN: "' + s + '"' });
      }
      if (!isFinite(x) || !isFinite(y)) {
        calls.push({ level: 'ERROR', msg: '文字坐标为 NaN: "' + s + '" @ ' + x + ',' + y });
      }
      if (x < -800 || x > 1400 || y < -200 || y > 1200) {
        calls.push({ level: 'WARN', msg: '文字跑出画布: "' + s + '" @ ' + Math.round(x) + ',' + Math.round(y) });
      }
    },
    measureText: (s) => ({ width: String(s).length * 9 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    getImageData: () => ({ data: [] }),
    putImageData: noop,
    setLineDash: noop,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    lineCap: 'butt', lineJoin: 'miter', font: '10px sans',
    textAlign: 'left', textBaseline: 'alphabetic',
    shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0
  };
  return ctx;
}

function makeCanvas(w, h) {
  const cv = { width: w || 300, height: h || 150 };
  const ctx = makeCtx();
  ctx.canvas = cv;
  cv.getContext = () => ctx;
  return cv;
}

const store = {};
const sandbox = {
  console,
  Math, Date, JSON, Object, Array, String, Number, Boolean, isFinite, isNaN,
  parseInt, parseFloat, setTimeout, clearTimeout,
  wx: {
    createCanvas: (w, h) => makeCanvas(w, h),
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2, platform: 'devtools' }),
    getStorageSync: k => store[k],
    setStorageSync: (k, v) => { store[k] = v; },
    getOpenDataContext: () => ({ canvas: makeCanvas(480, 626), postMessage: () => {} }),
    onTouchStart: () => {}, onTouchMove: () => {}, onTouchEnd: () => {}
  }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const code = fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8');
try {
  vm.runInContext(code, sandbox, { filename: 'game.js' });
  calls.push({ level: 'OK', msg: '载入成功，初始 draw 未抛错' });
} catch (e) {
  console.log('载入失败:', e.message);
  process.exit(1);
}

const run = (expr) => vm.runInContext(expr, sandbox);

function drawScene(name, setup) {
  try {
    run('try{' + setup + '}catch(e){globalThis.__err=e.message}');
    const err = run('globalThis.__err') || run('undefined');
    run('globalThis.__err=null');
    run('draw()');
    calls.push({ level: 'OK', msg: name + ' 绘制通过' });
  } catch (e) {
    calls.push({ level: 'ERROR', msg: name + ' 抛错: ' + (e.message || e) });
  }
}

// 1 主菜单
drawScene('主菜单', "S.scene='menu'");
// 2 图鉴
drawScene('图鉴', "S.scene='album';S.albumZoom=null");
drawScene('图鉴放大', "S.albumZoom=5");
// 3 信息页
drawScene('玩法说明', "S.scene='info';S.infoPage='help';S.infoScroll=0");
drawScene('隐私政策', "S.infoPage='privacy'");
drawScene('关于', "S.infoPage='about'");
// 4 排行榜
drawScene('排行榜', "S.scene='rank'");
// 5 闯关进行中
drawScene('闯关进行中', "S.scene='game';startLevel(1)");
drawScene('闯关第11关', "S.scene='game';startLevel(11)");
// 6 无尽进行中
drawScene('无尽进行中', "S.scene='game';startEndless()");
// 7 死局提示
drawScene('死局提示', "S.scene='game';startLevel(3);S.result='lose';S.over=true;S.loseHint='item'");
drawScene('死局提示(敲完仍无位)', "S.loseHint='still'");
// 8 广告弹窗（复活）
drawScene('广告弹窗-复活', "S.pendingAd={type:'revive'}");
// 9 广告弹窗（领道具）
drawScene('广告弹窗-道具', "S.pendingAd={type:'item',item:0}");
// 10 失败结算
drawScene('失败结算-闯关', "S.pendingAd=null;S.loseHint=null;S.mode='level';S.result='lose';S.score=1234;S.target=2000");
drawScene('失败结算-无尽', "S.mode='endless';S.result='lose';S.score=888");
// 11 过关
drawScene('过关', "S.mode='level';S.result='win';S.level=3;S.msg='收集达标＋分数线达成'");

const errs = calls.filter(c => c.level === 'ERROR');
const warns = calls.filter(c => c.level === 'WARN');
console.log('==== 结果 ====');
calls.forEach(c => { if (c.level !== 'OK') console.log('[' + c.level + '] ' + c.msg); });
console.log('通过 ' + calls.filter(c => c.level === 'OK').length + ' 项 / 错误 ' + errs.length + ' / 警告 ' + warns.length);
process.exit(errs.length ? 1 : 0);
