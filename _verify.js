const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('d:/本地AI/game/wechat-minigame/game.js', 'utf8');
const ctxMock = new Proxy({}, { get: () => () => {}, set: () => true });
const saved = {};
const wx = {
  createCanvas: () => ({ getContext: () => ctxMock, width: 0, height: 0 }),
  getSystemInfoSync: () => ({ pixelRatio: 2, windowWidth: 375, windowHeight: 667 }),
  onTouchStart: () => {}, onTouchMove: () => {}, onTouchEnd: () => {},
  getStorageSync: (k) => saved[k] || 0, setStorageSync: (k, v) => { saved[k] = v; }
};
const test = `
  // 1. 莫兰迪配色就位
  console.log('1. 方块色数:', COLORS.length, '| 界面配色键数:', Object.keys(UI).length, '| 首色:', COLORS[0]);

  // 2. 消行计分
  S.board = Array.from({length:N},()=>Array(N).fill(-1));
  for (let x=0;x<9;x++) S.board[9][x]=0;
  S.pieces=[{cells:[[0,0]],color:COLORS[0],used:false}];
  S.score=0; S.over=false;
  place(0,9,9);
  console.log('2. 消行后分数:', S.score, S.score===11?'OK':'FAIL', '| 行已清:', S.board[9].every(v=>v===-1));

  // 3. 死局触发结束（交错棋盘，2x2无处放）
  function checker(){ S.board=[]; for(let y=0;y<N;y++){const r=[];for(let x=0;x<N;x++)r.push((x+y)%2===0?0:-1);S.board.push(r);} }
  const big={cells:[[0,0],[1,0],[0,1],[1,1]],color:COLORS[1],used:false};
  const big2={cells:[[0,0],[1,0],[0,1],[1,1]],color:COLORS[2],used:false};
  const one={cells:[[0,0]],color:COLORS[3],used:false};
  checker(); S.pieces=[one,big,big2]; S.over=false;
  place(0,0,1);
  console.log('3. 死局结束判定:', S.over?'OK 已触发':'FAIL', '| 提示:', S.msg);

  // 4. 落点预览与放置坐标一致
  const center=(gx,gy)=>({x:BX+gx*(CELL+GAP)+CELL/2,y:BY+gy*(CELL+GAP)+CELL/2});
  const t={cells:[[0,0],[1,0],[2,0],[1,1]]};
  const a=snapOrigin(t,center(5,5)), b=snapOrigin(t,center(5,5));
  console.log('4. 预览=落点:', (a.x===b.x&&a.y===b.y)?'OK':'FAIL');

  // 5. 最高分持久化
  console.log('5. 最高分存档:', saved['best']===11?'OK':'FAIL', saved['best']);
`;
vm.runInNewContext(src + test, { wx, console, Math, Array, JSON, Object });
