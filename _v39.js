// v39 专项断言：拾取/拖动全程静音，只有放置且消除才发声；音效开关仍生效
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
const store = {}, audio = { play: 0, stop: 0, tags: [], vols: [] }, H = {};
const sb = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  isFinite, isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
  requestAnimationFrame: () => 0,
  audioLog: audio,
  wx: {
    createCanvas: () => cv(),
    getSystemInfoSync: () => ({ windowWidth: 540, windowHeight: 960, pixelRatio: 1 }),
    getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v },
    removeStorageSync: k => { delete store[k]; },
    createInnerAudioContext: () => ({
      _src: '', _vol: 0,
      set src(v) { this._src = v; }, get src() { return this._src; },
      set volume(v) { this._vol = v; },
      stop: () => { audio.stop++ },
      play: function () { audio.play++; audio.tags.push(this._src); audio.vols.push(this._vol); }
    }),
    getOpenDataContext: () => ({ canvas: cv(), postMessage: noop }),
    vibrateShort: noop,
    onTouchStart: cb => { H.start = cb; },
    onTouchMove: cb => { H.move = cb; },
    onTouchEnd: cb => { H.end = cb; },
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
const src = fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8');

// ---- 版本与触发点 ----
ok(run('GAME_VERSION') === 'v43', '版本号 v43');
ok(/sfx\('w'\s*\+\s*Math\.min\(5/.test(src), '消除音仍在 startClearFx');
// 托盘代码块里不能出现 sfx 调用
const tray = src.slice(src.indexOf('方块托盘：命中区放宽'), src.indexOf('wx.onTouchMove'));
ok(!/sfx\s*\(/.test(tray), '托盘拾取段不含任何 sfx 调用');

// ---- 行为：拿起 → 拖动 → 松手，全程零播放 ----
const setup = `startLevel(1); S.soundOn=true; S.drag=-1; S.sel=-1; S.lock=false;
  S.dailyModal=false; S.pendingAd=null; S.loseHint=null; S.result='';
  audioLog.play=0; audioLog.tags=[]; audioLog.vols=[];`;
run(setup);
H.start({ touches: [{ clientX: 90, clientY: 850 }] });   // 托盘第一块
ok(run('S.drag') === 0, '触摸托盘拿起方块（拖拽态生效）');
ok(audio.tags.length === 0, '拿起方块不发声', JSON.stringify(audio.tags));
H.move({ touches: [{ clientX: 200, clientY: 600 }] });   // 拖到棋盘上
H.move({ touches: [{ clientX: 260, clientY: 500 }] });
ok(audio.tags.length === 0, '拖动过程不发声', JSON.stringify(audio.tags));
H.move({ touches: [{ clientX: 200, clientY: 850 }] });   // 移到托盘区（上移 58 后仍在棋盘外）
H.end();
ok(audio.tags.length === 0, '松手在棋盘外（未放置）不发声', JSON.stringify(audio.tags));

// ---- 行为：放置并消除 → 轻咔 + 木琴 ----
run(`(function(){
  startLevel(1); S.soundOn=true; audioLog.play=0; audioLog.tags=[]; audioLog.vols=[];
  for(var y=S.reg.s;y<S.reg.e;y++) for(var x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=EMPTY;
  var row=S.reg.s, last=S.reg.e-1;
  for(var x=S.reg.s;x<last;x++) S.board[row][x]=6;
  S.pieces=[{cells:[[0,0,6]],used:false}];
  place(0,last,row);
})()`);
ok(audio.tags.some(t => t.includes('tap.wav')) && audio.tags.some(t => t.includes('wood')),
  '放置并消除：轻咔 + 木琴都响', JSON.stringify(audio.tags));

// ---- 开关关掉后，轻咔与木琴都静音 ----
run(`(function(){
  startLevel(1); S.soundOn=false; audioLog.play=0; audioLog.tags=[]; audioLog.vols=[];
  for(var y=S.reg.s;y<S.reg.e;y++) for(var x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=EMPTY;
  var row=S.reg.s, last=S.reg.e-1;
  for(var x=S.reg.s;x<last;x++) S.board[row][x]=6;
  S.pieces=[{cells:[[0,0,6]],used:false}];
  place(0,last,row);
})()`);
ok(audio.tags.length === 0, '关闭音效后落子与消除都静音', JSON.stringify(audio.tags));
run('S.soundOn=true;');

console.log('==== 结果 ==== 通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
