const fs=require('fs'),vm=require('vm');
const noop=()=>{};
function mkCtx(){return new Proxy({measureText:s=>({width:String(s).length*9}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),createPattern:()=>({}),getImageData:()=>({data:[]})},{get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>{t[k]=v;return true}});}
function cv(){const c={width:540,height:960};c.getContext=()=>mkCtx();return c;}
const store={};
const sb={console,Math,Date,JSON,Object,Array,String,Number,Boolean,isFinite,isNaN,parseInt,parseFloat,setTimeout,
wx:{createCanvas:()=>cv(),getSystemInfoSync:()=>({windowWidth:540,windowHeight:960,pixelRatio:1}),
getStorageSync:k=>store[k],setStorageSync:(k,v)=>{store[k]=v},removeStorageSync:k=>{delete store[k]},
getOpenDataContext:()=>({canvas:cv(),postMessage:noop}),vibrateShort:noop,
onTouchStart:noop,onTouchMove:noop,onTouchEnd:noop}};
vm.createContext(sb);
vm.runInContext(fs.readFileSync('wechat-minigame/game.js','utf8'),sb);
const g=c=>vm.runInContext(c,sb);
let pass=0,fail=0;
const ok=(n,c,x)=>{ if(c){pass++;console.log('  ✓ '+n);} else {fail++;console.log('  ✗ '+n+(x?'  → '+x:''));} };

const SHAPES = g('SHAPES');
console.log('形状池共 '+SHAPES.length+' 个');

// 去重
const kk = s => { const mx=Math.min(...s.map(c=>c[0])), my=Math.min(...s.map(c=>c[1]));
  return s.map(c=>[c[0]-mx,c[1]-my]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]).map(c=>c.join(',')).join('|'); };
const seen = new Set(); let dup = 0;
for (const s of SHAPES) { const k=kk(s); if(seen.has(k)) dup++; seen.add(k); }
ok('没有重复形状', dup===0, '重复 '+dup+' 个');

// 连通性（4 邻接）
function connected(s){
  const set=new Set(s.map(c=>c[0]+','+c[1]));
  const st=[s[0]]; const vis=new Set([s[0].join(',')]);
  while(st.length){ const [x,y]=st.pop();
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const k=(x+dx)+','+(y+dy);
      if(set.has(k)&&!vis.has(k)){vis.add(k);st.push([x+dx,y+dy]);} } }
  return vis.size===set.size;
}
ok('全部形状连通', SHAPES.every(connected));

// 坐标非负且从 0 开始
ok('坐标规范（最小值为 0）', SHAPES.every(s=>Math.min(...s.map(c=>c[0]))===0&&Math.min(...s.map(c=>c[1]))===0));

// L 型识别：3 格 L = 一个角（某格有两个垂直邻居）
function isL3(s){
  if(s.length!==3) return false;
  const set=new Set(s.map(c=>c.join(',')));
  return s.some(([x,y])=>[[1,0],[-1,0]].some(([dx,dy])=>set.has((x+dx)+','+(y+dy)))
    && [[0,1],[0,-1]].some(([dx,dy])=>set.has((x+dx)+','+(y+dy))));
}
// 4 格 L：存在一个格，其两个邻居互相垂直，且整体 3 格成直线
function isL4(s){
  if(s.length!==4) return false;
  const set=new Set(s.map(c=>c.join(',')));
  const corner = s.some(([x,y])=>{
    const n=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>set.has((x+dx)+','+(y+dy)));
    return n.length===2 && n[0][0]*n[1][0]===0 && n[0][1]*n[1][1]===0;  // 互相垂直
  });
  if(!corner) return false;
  // 且有 3 格共线（说明是 3+1 的 L，不是 Z 或闪电）
  const rows={},cols={};
  for(const [x,y] of s){ (rows[y]=rows[y]||[]).push(x); (cols[x]=cols[x]||[]).push(y); }
  return Object.values(rows).some(a=>a.length===3) || Object.values(cols).some(a=>a.length===3);
}
const l3 = SHAPES.filter(isL3), l4 = SHAPES.filter(isL4);
console.log('识别到：3 格 L = '+l3.length+' 个，4 格 L = '+l4.length+' 个');
ok('3 格 L 有 4 个朝向', l3.length===4);
ok('4 格 L 有 8 个朝向', l4.length===8);
ok('Z/闪电不被误判成 L', SHAPES.filter(s=>s.length===4||s.length===5).every(s=>{
  const k=JSON.stringify(s);
  const zs=['[[0,0],[1,0],[1,1],[2,1]]','[[1,0],[2,0],[0,1],[1,1]]','[[1,0],[1,1],[0,1],[0,2]]','[[0,0],[0,1],[1,1],[1,2]]'];
  return !zs.includes(k) || !isL4(s);
}));

// 随机抽样：L 型实际出现的频率
g("S.mode='level'; S.level=10; S.active=6; S.reg=regionOf(6);");
let cnt={}, N=6000;
for(let i=0;i<N;i++){ const p=g('randPiece()'); const cells=p.cells.map(c=>[c[0],c[1]]);
  const tag = isL3(cells)?'L3' : isL4(cells)?'L4' : 'other';
  cnt[tag]=(cnt[tag]||0)+1; }
console.log('随机 6000 次 → 3格L '+(cnt.L3||0)+' 次、4格L '+(cnt.L4||0)+' 次、其它 '+(cnt.other||0)+' 次');
ok('随机能抽到 3 格 L', (cnt.L3||0)>0);
ok('随机能抽到 4 格 L', (cnt.L4||0)>0);
ok('L 型总占比合理（>15%）', ((cnt.L3||0)+(cnt.L4||0))/N > 0.15, (((cnt.L3||0)+(cnt.L4||0))/N*100).toFixed(1)+'%');

// v36：L1-6 教学关放开到 4 格含 L 型（有解发牌保证三手可消），不再只有直条
g("S.level=2;"); const pool=g('eligibleShapes()');
console.log('第 2 关候选池 '+pool.length+' 个，其中非直条 '+pool.filter(s=>!g('isStraightShape')(s)).length+' 个');
ok('L1-6 候选池含 L/方块且不超过 4 格', pool.length > 0 && pool.every(s => s.length <= 4) &&
  pool.some(s => !g('isStraightShape')(s)));
g("S.level=8;"); const pool2=g('eligibleShapes()');
ok('L7-10 候选池最多 4 格', pool2.length > 0 && pool2.every(s => s.length <= 4));

// L 型能真正落到棋盘上
g("S.scene='play'; startLevel(6);");
g("for(let y=S.reg.s;y<S.reg.e;y++) for(let x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=EMPTY;");  // 必须清空：startLevel 会预置方块
const ls = g('JSON.stringify(SHAPES.filter(s=>s.length===4).map(s=>s.map(c=>[c[0],c[1]])))');
const L4s = JSON.parse(ls);
let placeable=0;
for(const s of L4s){ if(g('canPlace('+JSON.stringify(s)+', S.reg.s, S.reg.s)')) placeable++; }
ok('4 格 L 在空棋盘上可放置', placeable===L4s.length, placeable+'/'+L4s.length);

console.log('\n结果: '+pass+' 通过 / '+fail+' 失败');
process.exit(fail?1:0);
