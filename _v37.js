// v37 专项断言：音效开关 / 无收集关卡宝石清零 / 旧存档兼容
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
const store = {}, audio = { play: 0, stop: 0 };
const sb = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  isFinite, isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
  requestAnimationFrame: () => 0,
  audioLog: audio, gemCalls: { n: 0 },
  wx: {
    createCanvas: () => cv(),
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2 }),
    getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v },
    removeStorageSync: k => { delete store[k]; },
    createInnerAudioContext: () => ({
      set src(v) {}, set volume(v) {},
      stop: () => { audio.stop++ }, play: () => { audio.play++ }
    }),
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

// ---- 版本与默认态 ----
ok(run('GAME_VERSION') === 'v40', '版本号 v40');
ok(run('S.soundOn') === true, '音效默认开');
ok(typeof run('iconSound') === 'function', '喇叭图标函数存在');
const src = fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8');
ok(src.includes("navButton('sound', 394, 18)"), '关卡 HUD 有音效按钮');
ok(src.includes("hit(t.x, t.y, 394, 18, 40, 40)"), '音效按钮有触摸命中');

// ---- 音效闸门 ----
run('audioLog.play=0; S.soundOn=true; sfx("w1");');
ok(audio.play === 1, '开启时 sfx 会播放', 'play=' + audio.play);
run('audioLog.play=0; S.soundOn=false; sfx("w1");');
ok(audio.play === 0, '关闭时 sfx 完全不发声', 'play=' + audio.play);

// ---- 开关存档往返 ----
run('S.soundOn=false; saveSound(); S.soundOn=true; loadSave();');
ok(run('S.soundOn') === false, '关闭状态写入存档并读回');
run('S.soundOn=true; saveSound(); S.soundOn=false; loadSave();');
ok(run('S.soundOn') === true, '重新开启后存档读回');
run('S.soundOn=true;');

// ---- 无收集关卡：发牌无宝石 ----
let gem = 0, all = 0;
for (const n of [1, 5, 10, 15, 20]) {
  run('startLevel(' + n + ')');
  for (let t = 0; t < 20; t++) {
    run('spawn()');
    const codes = JSON.parse(run('JSON.stringify(S.pieces.filter(p=>!p.used).flatMap(p=>p.cells.map(c=>c[2])))'));
    for (const c of codes) { all++; if (c >= 0 && c < 6) gem++; }
  }
}
ok(gem === 0, 'L1/5/10/15/20 共 100 轮发牌零宝石', '宝石格=' + gem + '/' + all);
run('startLevel(21)');
ok(run('!!S.goal') === true, 'L21 起仍有收集目标');

// ---- 旧暂存兼容：宝石编码被洗成普通块 ----
run('(function(){var b=[];for(var y=0;y<N;y++){b.push([]);for(var x=0;x<N;x++)b[y].push(LOCKED);}b[3][3]=3;b[4][4]=5;__fake={mode:"level",level:5,target:90,active:6,reg:regionOf(6),goal:null,board:b,pieces:[{cells:[[0,0,4]],color:null,used:false}],score:12,combo:0,adUsed:0,adItems:[0,0,0],date:today()};})()');
run('(function(){var old=wx.getStorageSync;wx.getStorageSync=function(k){return k==="resume"?__fake:old(k)};tryRestoreResume();wx.getStorageSync=old;})()');
ok(run('S.board[3][3]') === 9, '旧暂存盘面宝石 3 → 普通块 9');
ok(run('S.board[4][4]') === 11, '旧暂存盘面宝石 5 → 普通块 11');
ok(run('S.pieces[0].cells[0][2]') === 10, '旧暂存方块宝石 4 → 普通块 10');
ok(run('S.goal') === null, '恢复后仍无收集目标');

// ---- 还原道具快照兼容 ----
run('S.mode="level";S.level=8;S.goal=null;S.snap={board:[[0,2]],pieces:[{cells:[[0,0,1]],used:false}],color:null,score:0,over:false,msg:"",combo:0,goal:null};restoreSnap();');
ok(run('S.snap') === null && run('S.pieces[0].cells[0][2]') === 7, '还原快照里的宝石也洗成普通块');

// ---- 渲染兜底：无 goal 绝不画宝石 ----
run('S.mode="level";S.goal=null;gemCalls.n=0;drawGem=function(){gemCalls.n++};drawCellOf(null,[0,0,2],0,0,20);');
ok(sb.gemCalls.n === 0, '无目标关渲染不调用 drawGem');
run('S.goal={2:{need:18,got:0}};drawCellOf(null,[0,0,2],0,0,20);');
ok(sb.gemCalls.n === 1, '有目标关仍正常画宝石');

console.log('==== 结果 ==== 通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
