// v41 专项断言：障碍图样池 ≥30 种 / 连续 30 关不重样 / 去重记录落盘
const fs = require('fs'), vm = require('vm'), path = require('path');
const noop = () => {};
function makeCtx() {
  return new Proxy({
    measureText: s => ({ width: String(s).length * 9 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({}), getImageData: () => ({ data: [] }), setLineDash: noop
  }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
}
function cv() { const c = { width: 540, height: 960 }; c.getContext = () => makeCtx(); return c; }
const store = {};
const sb = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  isFinite, isNaN, parseInt, parseFloat, setTimeout, clearTimeout,
  requestAnimationFrame: () => 0,
  store,
  wx: {
    createCanvas: () => cv(),
    getSystemInfoSync: () => ({ windowWidth: 540, windowHeight: 960, pixelRatio: 1 }),
    getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v },
    removeStorageSync: k => { delete store[k]; },
    createInnerAudioContext: () => ({ set src(v) {}, set volume(v) {}, stop: noop, play: noop }),
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
const src = fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8');

ok(run('GAME_VERSION') === 'v43', '版本号 v43');
const total = run('OB_LAYOUTS.length'), small = run('OB_LAYOUTS.filter(L=>L.rects.length<=2).length');
ok(total >= 31, '图样池 ≥31 种', 'total=' + total);
ok(small >= 31, '小盘（≤8×8）可用图样 ≥31 种', 'small=' + small);
ok(run('OB_LAYOUTS.every(L=>L.id && L.rects.length>0)'), '每种图样都有 id 与矩形');
ok(new Set(JSON.parse(run('JSON.stringify(OB_LAYOUTS.map(L=>L.id))'))).size === total, '图样 id 无重复');

// ---- 连续 70 关有障碍关：历史 key 必须等于实际铺出的形状，且 30 关窗口不重样 ----
// v43：障碍起关从 L11 提前到 L9，窗口覆盖 L9–78
const keys = [], shapes = [], counts = [];
for (let n = 9; n <= 78; n++) {
  run('startLevel(' + n + ')');
  keys.push(run('S.layoutHistory[S.layoutHistory.length-1]'));
  const cells = run(`(function(){var a=[];for(var y=0;y<N;y++)for(var x=0;x<N;x++) if(S.board[y][x]===OBSTACLE)a.push(y*100+x);return a.sort(function(a,b){return a-b;});})()`);
  shapes.push(cells.join(','));
  counts.push(cells.length);
}
ok(counts.every(c => c > 0), 'L9–78 每关都有障碍砖', '最少=' + Math.min(...counts));
ok(run('S.layoutHistory.length') === 30, '去重记录只保留最近 30 关');
ok(keys.every((k, i) => k === shapes[i]), '历史 key 与实际障碍形状逐关一致');
const dupKeys = [];
for (let i = 29; i < keys.length; i++) {
  const w = keys.slice(i - 29, i + 1);
  if (new Set(w).size !== 30) dupKeys.push(i + 9);
}
ok(dupKeys.length === 0, '任意连续 30 关实际障碍形状不重复', dupKeys.join(','));

// ---- 存档往返 ----
run('S.layoutHistory=["30304,30305","40404"]; saveLayoutHistory(); S.layoutHistory=[]; loadSave();');
ok(run('JSON.stringify(S.layoutHistory)') === '["30304,30305","40404"]', '去重记录写入存档并读回');
run('delete store.layoutHistory; S.layoutHistory=["old"]; loadSave();');
ok(run('JSON.stringify(S.layoutHistory)') === '[]', '旧档没有记录时安全降级为空');
run('S.layoutHistory=[];');

// ---- 小盘图样不会退化成散点：障碍砖全在开放区内 ----
run('startLevel(21)');  // 8×8
ok(run(`(function(){for(var y=0;y<N;y++)for(var x=0;x<N;x++) if(S.board[y][x]===OBSTACLE && !inRegion(x,y,S.reg)) return false; return true;})()`),
  '8×8 关障碍只在开放区内');

console.log('==== 结果 ==== 通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
