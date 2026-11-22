// 生成各画面预览 HTML（注入 wx mock），供 headless Chrome 截图
const fs = require('fs');
const game = fs.readFileSync('wechat-minigame/game.js', 'utf8').replace(/^'use strict';/m, '');

const setups = {
  menu: `S.scene='menu';S.daily={date:today(),lines:5,gems:18,games:1,claimed:false};draw();`,
  menu_claim: `S.scene='menu';S.daily={date:today(),lines:8,gems:30,games:2,claimed:false};S.beadGot=3;S.bestEndless=860;draw();`,
  menu_idle: `S.scene='menu';S.daily={date:today(),lines:8,gems:30,games:2,claimed:true};draw();`,
  bead: `S.scene='menu';S.daily={date:today(),lines:8,gems:30,games:2,claimed:true};S.beadGot=5;draw();`,
  beadz: `S.scene='menu';S.beadGot=13;S.albumZoom=0;S.scene='album';draw();`,
  game: `S.scene='game';startLevel(3);for(let y=0;y<10;y++)for(let x=0;x<10;x++){if(inRegion(x,y,S.reg)&&((x*3+y*7)%5)<2)S.board[y][x]=(x+y*2)%12;}S.score=1240;draw();`,
  endless: `S.scene='game';startEndless();for(let y=0;y<10;y++)for(let x=0;x<10;x++){if(((x*5+y*3)%7)<3)S.board[y][x]=(x+y)%6;}S.score=860;draw();`,
  losehint: `S.scene='game';startLevel(3);for(let y=0;y<10;y++)for(let x=0;x<10;x++){if(inRegion(x,y,S.reg)&&((x*3+y*7)%5)<2)S.board[y][x]=(x+y*2)%12;}S.score=1240;S.items[0]=2;S.dayItems[1]=1;S.result='lose';S.over=true;S.loseHint='item';draw();`,
  lose: `S.scene='play';startLevel(3);S.result='lose';S.over=true;S.score=1240;S.target=2000;draw();`,
  win: `S.scene='play';startLevel(9);S.result='win';S.score=2600;for(const k in S.goal){S.goal[k].got=S.goal[k].need;}S.msg='收集达标，分数线已过';draw();`,
  burst: `S.scene='play';startLevel(16);S.result='win';S.score=2600;S.msg='合成「火箭」！交通篇集齐，道具 ×8！';S.pageBurst={t0:Date.now()-200};draw();`,
  winbead: `S.scene='play';startLevel(9);S.result='win';S.score=2600;S.msg='过关！拼图碎片 +1（6/16）';S.shardFly={t0:Date.now()-300,dur:820,x0:DW/2,y0:700,cx:DW/2+70,cy:560,x1:DW/2-116,y1:460};draw();`,
  addlg: `S.scene='play';startLevel(9);S.pendingAd={type:'revive'};draw();`,
  admenu: `S.scene='menu';S.daily={date:today(),lines:8,gems:30,games:2,claimed:true};S.pendingAd={type:'menuReward'};draw();`,
  reveal: `S.scene='menu';S.daily={date:today(),lines:8,gems:30,games:2,claimed:true};S.menuAd={date:today(),count:3};S.menuReveal={item:0,t0:Date.now()-300};draw();`,
  daily: `S.scene='menu';S.daily={date:today(),lines:8,gems:30,games:2,claimed:false};S.dailyModal=true;draw();`,
  daily2: `S.scene='menu';S.daily={date:today(),lines:3,gems:12,games:1,claimed:false};S.dailyModal=true;draw();`,
  combo: `S.scene='play';startLevel(1);S.combo=3;S.msg='消除 2 条 ×2.5 · 连击 ×3 · +150 分';S.fx={cells:[],rows:[S.reg.s],cols:[],t0:Date.now(),dur:260,cb:null};for(let x=S.reg.s;x<S.reg.e;x++)S.fx.cells.push({x:x,y:S.reg.s,v:3});S.lock=true;draw();`,
  lpiece: `S.scene='play';startLevel(3);
    S.pieces=[
      {cells:[[0,0,0],[0,1,1],[0,2,2],[1,2,3]],used:false},
      {cells:[[0,0,4],[1,0,5],[2,0,0],[0,1,1]],used:false},
      {cells:[[1,0,2],[1,1,3],[0,2,4],[1,2,5]],used:false}
    ];
    S.board[S.reg.s][S.reg.s]=2;S.board[S.reg.s][S.reg.s+1]=2;S.board[S.reg.s][S.reg.s+2]=2;
    S.board[S.reg.s+1][S.reg.s]=2;
    S.board[S.reg.s+3][S.reg.s+3]=4;S.board[S.reg.s+3][S.reg.s+4]=4;
    S.board[S.reg.s+4][S.reg.s+3]=4;S.board[S.reg.s+5][S.reg.s+3]=4;
    draw();`,
  drag: `S.scene='play';startLevel(3);
    for(let y=0;y<10;y++)for(let x=0;x<10;x++){if(inRegion(x,y,S.reg)&&((x*3+y*7)%5)<2)S.board[y][x]=(x+y*2)%12;}
    S.pieces[0]={cells:[[0,0,0],[0,1,1],[0,2,2],[1,2,3]],used:false};
    S.drag=0;S.pos={x:190,y:790};draw();`,
  obs_all: `S.scene='play';startLevel(22);
    // 8 种布局依次画进一张大图（4 列 × 2 行，缩略盘）
    const W=540,H=960;ctx.clearRect(0,0,W,H);
    ctx.fillStyle=UI.bg;ctx.fillRect(0,0,W,H);
    const titles=OB_LAYOUTS.map(o=>o.id);
    for(let i=0;i<OB_LAYOUTS.length;i++){
      const col=i%2,row=Math.floor(i/2);
      const ox=30+col*250,oy=120+row*180;
      const side=140,cs=side/10;
      ctx.fillStyle=UI.boardTop;roundRectPath(ctx,ox,oy,side,side,10);ctx.fill();
      const reg={s:0,size:10,e:10};
      const cells=obstacleCellsFor(reg,OB_LAYOUTS[i],0.24*100);
      for(const c of cells){
        ctx.fillStyle=OBST.base;
        roundRectPath(ctx,ox+c.x*cs+0.5,oy+c.y*cs+0.5,cs-1,cs-1,2);ctx.fill();
      }
      text(titles[i],ox,oy-8,12,UI.onSurfaceVar);
    }
    text('障碍布局一览（24% 密度 / 10×10）',30,80,20,UI.onSurface,'600');`,
  obs13: `S.scene='play';startLevel(13);
    for(let y=S.reg.s;y<S.reg.e;y++)for(let x=S.reg.s;x<S.reg.e;x++){
      if(S.board[y][x]===-1 && ((x*3+y*5)%7)<2) S.board[y][x]=(x+y)%6;
    }S.score=1580;draw();`,
  obs22: `S.scene='play';startLevel(22);for(let y=S.reg.s;y<S.reg.e;y++)for(let x=S.reg.s;x<S.reg.e;x++){if(S.board[y][x]===-1&&((x*3+y*5)%7)<2)S.board[y][x]=(x+y)%6;}S.score=1810;draw();`,
  obs23: `S.scene='play';startLevel(23);for(let y=S.reg.s;y<S.reg.e;y++)for(let x=S.reg.s;x<S.reg.e;x++){if(S.board[y][x]===-1&&((x*3+y*5)%7)<2)S.board[y][x]=(x+y)%6;}S.score=940;draw();`,
  obs25: `S.scene='play';startLevel(25);
    for(let y=S.reg.s;y<S.reg.e;y++)for(let x=S.reg.s;x<S.reg.e;x++){
      if(S.board[y][x]===-1 && ((x*3+y*5)%7)<2) S.board[y][x]=(x+y*2)%6;
    }S.score=2420;draw();`,
  obs8: `S.scene='play';startLevel(8);
    for(let y=S.reg.s;y<S.reg.e;y++)for(let x=S.reg.s;x<S.reg.e;x++){
      if(S.board[y][x]===-1 && ((x*3+y*5)%7)<2) S.board[y][x]=(x+y)%6;
    }S.score=980;draw();`,
  album: `S.scene='album';S.albumPage=0;draw();`,
  albumz: `S.scene='album';S.albumPage=0;S.albumZoom=3;draw();`,
  info: `S.scene='info';S.infoPage='help';draw();`,
  rank: `S.scene='rank';draw();`,
  noad: `S.scene='game';startLevel(3);for(let y=0;y<10;y++)for(let x=0;x<10;x++){if(inRegion(x,y,S.reg)&&((x*3+y*7)%5)<2)S.board[y][x]=(x+y*2)%12;}S.score=1240;S.items[0]=1;S.adUsed=2;S.result='lose';S.over=true;S.loseHint='item';draw();`
};

const mock = `
var __first=true;
var wx={
  createCanvas:function(){
    var c=document.createElement('canvas');
    if(__first){__first=false;}else{c.style.display='none';}
    document.body.appendChild(c);return c;
  },
  getSystemInfoSync:function(){return {pixelRatio:1,windowWidth:540,windowHeight:960};},
  onTouchStart:function(){},onTouchMove:function(){},onTouchEnd:function(){},
  getStorageSync:function(){return 0;},setStorageSync:function(){},vibrateShort:function(){},
  getOpenDataContext:function(){var c=document.createElement('canvas');c.style.display='none';document.body.appendChild(c);return {canvas:c,postMessage:function(){}};}
};
`;

for (const [name, setup] of Object.entries(setups)) {
  const html = '<!DOCTYPE html><html><head><meta charset=utf-8><style>html,body{margin:0;padding:0;background:#F0EEE8}canvas{display:block;width:540px;height:960px}</style></head><body><script>' +
    mock + game + '\ntry{' + setup + '}catch(e){document.title="ERR:"+e.message}</script></body></html>';
  fs.writeFileSync('_shot_' + name + '.html', html);
}
console.log('written', Object.keys(setups).join(', '));
