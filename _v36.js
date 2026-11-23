// v36 专项断言：教学关有解发牌 / 形状多样 / 三手可消 / 防死局不被破坏
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
  else { fail++; console.log('✗ ' + name + (detail ? '  → ' + detail : '')); }
}

console.log('== 版本与形状池 ==');
ok(run('GAME_VERSION') === 'v40', '版本号 v40');
run('S.mode="level"; S.level=1; S.active=6; S.reg=regionOf(6);');
const pool = run('JSON.stringify(eligibleShapes())');
const shapes = JSON.parse(pool);
const w = s => Math.max.apply(null, s.map(c => c[0])) + 1;
const h = s => Math.max.apply(null, s.map(c => c[1])) + 1;
ok(shapes.length >= 8, '教学关候选池够丰富（' + shapes.length + ' 种）');
ok(shapes.every(s => s.length >= 2), '教学关不发 1×1');
ok(shapes.some(s => s.length === 3 && w(s) > 1 && h(s) > 1),
  '教学关含 3 格 L 型');
ok(shapes.some(s => s.length === 4 && s.some(c => c[1] === 1)), '教学关含 4 格形状');
ok(!shapes.some(s => s.length === 4 && (w(s) === 4 || h(s) === 4)),
  '教学关排除 1×4 长条');

console.log('\n== 有解发牌：三手可消 ==');
// 用棋盘副本模拟：把 S.pieces 的设计落点重建出来不现实，
// 改为直接验证 buildTeachSet 的返回值——它内部已经在副本上模拟过。
// 这里独立再做一次「存在一组落点能消行」的搜索，交叉验证。
function solvable() {
  return run(`(function(){
    var reg=S.reg, ps=S.pieces;
    // 枚举目标行
    for(var y=reg.s;y<reg.e;y++){
      var need=[];
      for(var x=reg.s;x<reg.e;x++) if(S.board[y][x]===EMPTY) need.push(x);
      if(need.length<2||need.length>9) continue;
      // 每块在该行能覆盖哪些格（枚举落点）
      var opts=ps.map(function(p){
        var list=[];
        for(var yy=reg.s;yy<reg.e;yy++) for(var xx=reg.s;xx<reg.e;xx++){
          if(!canPlace(p.cells,xx,yy)) continue;
          var cov=[];
          for(var i=0;i<p.cells.length;i++) if(yy+p.cells[i][1]===y) cov.push(xx+p.cells[i][0]);
          if(cov.length) list.push({x:xx,y:yy,cov:cov});
        }
        return list;
      });
      // 暴力：3 块各取一个落点，看覆盖并集是否 == need
      var n0=need.length;
      for(var a=0;a<opts[0].length;a++) for(var b=0;b<opts[1].length;b++){
        if(a===b) {}
        for(var c=0;c<opts[2].length;c++){
          var set={}; var cnt=0;
          [opts[0][a],opts[1][b],opts[2][c]].forEach(function(o){
            o.cov.forEach(function(v){ if(!set[v]){set[v]=1;cnt++;} });
          });
          if(cnt===n0 && need.every(function(v){return !!set[v];})) return true;
        }
      }
    }
    return false;
  })()`);
}
let solved = 0, total = 0, badFit = 0, nonStraight = 0;
for (let round = 0; round < 40; round++) {
  run('startLevel(1);');
  if (!solvable()) { /* 下面单独统计 */ }
  total++;
  if (solvable()) solved++;
  const ps = JSON.parse(run('JSON.stringify(S.pieces.map(p=>({n:p.cells.length,straight:(function(){var w=Math.max.apply(null,p.cells.map(function(c){return c[0]}))+1,h=Math.max.apply(null,p.cells.map(function(c){return c[1]}))+1;return w===1||h===1;})(),fit:fitCount(p.cells)})))'));
  if (ps.some(p => p.fit < 2)) badFit++;
  if (ps.some(p => !p.straight)) nonStraight++;
}
ok(solved >= 36, '空盘 40 轮至少 36 轮存在「三手消一行」的解（实际 ' + solved + '）');
ok(nonStraight >= 30, '空盘 40 轮至少 30 轮含非直线形状（实际 ' + nonStraight + '）');
ok(badFit === 0, '教学关发牌仍满足每块 ≥2 落点（违规 ' + badFit + '）');

console.log('\n== 满盘降级与教程文案 ==');
run('startLevel(1); (function(){var k=0;for(var y=S.reg.s;y<S.reg.e;y++)for(var x=S.reg.s;x<S.reg.e;x++){if(k++%100<75)S.board[y][x]=6;}})()');
run('spawn()');
ok(typeof run('S.pieces') === 'object' && run('S.pieces.length') === 3, '极挤盘面仍能发满 3 块');
const src = fs.readFileSync(path.join(__dirname, 'wechat-minigame', 'game.js'), 'utf8');
ok(src.indexOf('② 试试把三块摆在同一行，摆满就消') >= 0, '教程引导改成了拼满一行');
ok(src.indexOf('前 6 关发的方块都能拼成完整一行') >= 0, '玩法说明同步了有解发牌');

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
