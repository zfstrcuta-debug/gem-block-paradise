// v40 专项断言：落子轻咔（音量低于木琴）、拾取拖动静音、消除时咔+木琴叠加
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
const store = {}, audio = { tags: [], vols: [] }, H = {};
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
      set volume(v) { this._vol = v; }, get volume() { return this._vol; },
      stop: noop,
      play: function () { audio.tags.push(this._src); audio.vols.push(this._vol); }
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
const reset = `startLevel(1); S.soundOn=true; S.drag=-1; S.sel=-1; S.lock=false;
  S.dailyModal=false; S.pendingAd=null; S.loseHint=null; S.result='';
  audioLog.tags=[]; audioLog.vols=[];`;

ok(run('GAME_VERSION') === 'v40', '版本号 v40');
ok(fs.existsSync(path.join(__dirname, 'wechat-minigame', 'audio', 'tap.wav')), '微信包体含 tap.wav');
ok(fs.existsSync(path.join(__dirname, 'h5', 'audio', 'tap.wav')), 'H5 含 tap.wav');
ok(run("SFX.tap.src") === 'audio/tap.wav', 'tap 音源路径正确');
ok(run('SFX.tap.volume') < run('SFX.w1.volume'), '咔声比木琴轻', run('SFX.tap.volume') + ' < ' + run('SFX.w1.volume'));
ok(/sfx\('tap'\)/.test(src.slice(src.indexOf('function place('), src.indexOf('function finishPlace('))), 'place() 里落子播轻咔');

// ---- 拖拽放下（不消除）：只有一声轻咔 ----
run(reset + `for(var y=S.reg.s;y<S.reg.e;y++) for(var x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=EMPTY;
  S.pieces=[{cells:[[0,0,6]],used:false}];`);
H.start({ touches: [{ clientX: 90, clientY: 850 }] });
ok(audio.tags.length === 0, '拿起方块仍静音', JSON.stringify(audio.tags));
const BX = run('BX'), BY = run('BY'), CELL = run('CELL'), GAP = run('GAP'), LIFT = run('DRAG_LIFT');
const px = BX + 4 * (CELL + GAP) + CELL / 2, py = BY + 4 * (CELL + GAP) + CELL / 2;
H.move({ touches: [{ clientX: px, clientY: py + LIFT }] });
ok(audio.tags.length === 0, '拖动到棋盘上仍静音', JSON.stringify(audio.tags));
H.end();
ok(audio.tags.length === 1 && audio.tags[0] === 'audio/tap.wav', '放下未消除：只响一声轻咔', JSON.stringify(audio.tags));

// ---- 点选放置也走同一条轻咔 ----
run(reset + `for(var y=S.reg.s;y<S.reg.e;y++) for(var x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=EMPTY;
  S.pieces=[{cells:[[0,0,6]],used:false}]; S.sel=0;`);
H.start({ touches: [{ clientX: px, clientY: py }] });
ok(audio.tags.length === 1 && audio.tags[0] === 'audio/tap.wav', '点选放置同样响轻咔', JSON.stringify(audio.tags));

// ---- 消除：轻咔 + 木琴两声 ----
run(reset + `(function(){
  for(var y=S.reg.s;y<S.reg.e;y++) for(var x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=EMPTY;
  var row=S.reg.s,last=S.reg.e-1;
  for(var x=S.reg.s;x<last;x++) S.board[row][x]=6;
  S.pieces=[{cells:[[0,0,6]],used:false}];
  place(0,last,row);
})()`);
ok(audio.tags.length === 2 && audio.tags[0] === 'audio/tap.wav' && audio.tags[1].includes('wood'),
  '消除时轻咔 + 木琴依次响', JSON.stringify(audio.tags));

console.log('==== 结果 ==== 通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
