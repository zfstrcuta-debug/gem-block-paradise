const fs=require('fs'),vm=require('vm');
const noop=()=>{};
function mkCtx(){return new Proxy({measureText:s=>({width:String(s).length*9}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),createPattern:()=>({}),getImageData:()=>({data:[]})},{get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>{t[k]=v;return true}});}
function cv(){const c={width:540,height:960};c.getContext=()=>mkCtx();return c;}
const store={cleared:{L1:true},lastLevel:2};
const sb={console,Math,Date,JSON,Object,Array,String,Number,Boolean,isFinite,isNaN,parseInt,parseFloat,setTimeout,
wx:{createCanvas:()=>cv(),getSystemInfoSync:()=>({windowWidth:540,windowHeight:960,pixelRatio:1}),
getStorageSync:k=>store[k],setStorageSync:(k,v)=>{store[k]=v},removeStorageSync:k=>{delete store[k]},
getOpenDataContext:()=>({canvas:cv(),postMessage:noop}),vibrateShort:noop,
onTouchStart:noop,onTouchMove:noop,onTouchEnd:noop}};
vm.createContext(sb);
vm.runInContext(fs.readFileSync('wechat-minigame/game.js','utf8'),sb);
const g=c=>vm.runInContext(c,sb);
let pass=0,fail=0;
function ok(name,cond,extra){ if(cond){pass++;console.log('  ✓ '+name);} else {fail++;console.log('  ✗ '+name+(extra?'  → '+extra:''));} }

function deadlock(extra){
  g(`S.scene='play'; startLevel(3);
     for(let y=S.reg.s;y<S.reg.e;y++) for(let x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=1;
     S.over=true; S.result='lose'; S.loseHint='item';
     S.adItems=[0,0,0]; S.dayItems=[0,0,0]; S.items=[0,0,0]; S.adUsed=0; S.adLimit=2;
     ${extra||''}`);
}

console.log('【1】真死局（棋盘全满）用锤子');
deadlock('S.adItems=[1,0,0];');
ok('使用前确实是死局', g('checkOver()'));
g('useItem(I_HAMMER)');
ok('弹窗关闭', g('!S.loseHint'), 'loseHint='+JSON.stringify(g('S.loseHint')));
ok('回到游戏态（over=false result=\'\'）', g("!S.over && S.result===''"), 'over='+g('S.over')+' result='+JSON.stringify(g('S.result')));
ok('确实有可放置空间', !g('checkOver()'));

console.log('【2】真死局用刷子');
deadlock('S.adItems=[0,0,1];');  // 刷新=2
g('useItem(I_REFRESH)');
ok('弹窗关闭', g('!S.loseHint'));
ok('三块里至少一块放得下', !g('checkOver()'));

console.log('【3】真死局用还原（有快照）');
deadlock('S.adItems=[0,1,0]; S.snap=null;');  // 还原=1
g('saveSnap();');
g('useItem(I_UNDO)');
ok('弹窗关闭', g('!S.loseHint'), 'loseHint='+JSON.stringify(g('S.loseHint')));
ok('回到游戏态', g("!S.over && S.result===''"));

console.log('【4】正常游戏中用锤子：仍只敲 1 格（语义不能被改坏）');
g(`S.scene='play'; startLevel(1); S.loseHint=null; S.result=''; S.over=false;
   S.adItems=[1,0,0];
   for(let y=S.reg.s;y<S.reg.e;y++) for(let x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=EMPTY;
   S.board[S.reg.s][S.reg.s]=1; S.board[S.reg.s][S.reg.s+1]=1; S.board[S.reg.s][S.reg.s+2]=1;
   S.board[S.reg.s+1][S.reg.s]=1;`);
const before=g('(function(){let n=0;for(let y=S.reg.s;y<S.reg.e;y++)for(let x=S.reg.s;x<S.reg.e;x++)if(S.board[y][x]!==EMPTY)n++;return n})()');
g('useItem(I_HAMMER)');
const after=g('(function(){let n=0;for(let y=S.reg.s;y<S.reg.e;y++)for(let x=S.reg.s;x<S.reg.e;x++)if(S.board[y][x]!==EMPTY)n++;return n})()');
ok('只减少 1 格（原语义保留）', before-after===1, before+'→'+after);

console.log('【5】完整链路：死局 → 点空库存道具 → 看广告 → 领到 → 再用 → 回游戏');
deadlock('');
g('useItem(I_HAMMER)');
ok('打开广告确认框', g('!!S.pendingAd'));
g('S.adUsed+=1; S.adItems[S.pendingAd.item]+=1; S.pendingAd=null;');
ok('领到 1 个道具', g('itemTotal(0)===1'));
ok('此时仍在死局提示', g("S.loseHint==='item'"));
g('useItem(I_HAMMER)');
ok('用完道具回到游戏', g("!S.loseHint && !S.over && S.result===''"));
ok('道具已扣除', g('itemTotal(0)===0'));

console.log('【6】广告次数用完的提示路径');
deadlock('S.adUsed=2;');
g('useItem(I_HAMMER)');
ok('不再打开广告框', g('!S.pendingAd'));
ok('给出明确提示', /广告次数已用完/.test(g('S.msg')), JSON.stringify(g('S.msg')));

console.log('【7】无尽模式同样生效');
g(`S.scene='play'; startEndless();
   for(let y=S.reg.s;y<S.reg.e;y++) for(let x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=1;
   S.over=true; S.result='lose'; S.loseHint='item'; S.adItems=[1,0,0];`);
g('useItem(I_HAMMER)');
ok('无尽死局用锤子也回到游戏', g("!S.loseHint && !S.over && S.result===''"));

console.log('\n结果: '+pass+' 通过 / '+fail+' 失败');
process.exit(fail?1:0);
