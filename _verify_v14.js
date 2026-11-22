// v14 验收：新增海鲜篇、服装篇（每篇 8 图样，共 64）+ 分页 4×2 布局
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('wechat-minigame/game.js', 'utf8');
const noop = () => {}, grad = { addColorStop: noop };
const measure = { width: 10 };
const mc = () => new Proxy({}, {
  get: (t, k) => {
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
    if (k === 'measureText') return () => measure;
    return (k in t ? t[k] : noop);
  },
  set: (t, k, v) => { t[k] = v; return true; }
});
let store = {};
let handlers = {};
const wx = {
  createCanvas: () => ({ width: 0, height: 0, getContext: mc }),
  getSystemInfoSync: () => ({ pixelRatio: 2, windowWidth: 375, windowHeight: 667 }),
  onTouchStart: f => handlers.start = f, onTouchMove: f => handlers.move = f, onTouchEnd: f => handlers.end = f,
  getStorageSync: k => store[k], setStorageSync: (k, v) => { store[k] = v; },
  getOpenDataContext: () => ({ canvas: { width: 0, height: 0 }, postMessage: noop })
};
const o = { wx, console, Math, Array, Object, JSON, Date };
vm.createContext(o); vm.runInContext(src, o);
const run = c => vm.runInContext(c, o);
let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('✓', name); } else { fail++; console.log('✗', name); } }

// 1. 数据结构
ok('1. 篇数 8', run('BEAD_PAGES.length') === 8);
ok('2. 图样总数 64', run('BEAD_TOTAL') === 64);
ok('3. 篇名顺序', run('BEAD_PAGES.map(p=>p.name).join(",")') === '动物,文具,家具,交通,水果,电器,海鲜,服装');
ok('4. 每篇 8 个', run('BEAD_PAGES.every(p=>p.patterns.length===8)'));
ok('5. 海鲜 8 个图样', run('BEAD_PAGES[6].patterns.map(p=>p.name).join(",")') === '虾,扇贝,章鱼,海星,水母,龙虾,鱿鱼,海马');
ok('6. 服装 8 个图样', run('BEAD_PAGES[7].patterns.map(p=>p.name).join(",")') === '短袖,长裤,裙子,帽子,鞋子,袜子,围巾,手套');
ok('7. 全部图样名字不重复', run('new Set(BEADS.map(b=>b.name)).size') === 64);
ok('8. 索引 48/63 正确', run('BEADS[48].name') === '虾' && run('BEADS[63].name') === '手套');
ok('9. 新图样 need=100', run('BEADS.slice(48).every(b=>b.need===100)'));
ok('10. 新图样 cells 非空且 ci 合法', run('BEADS.slice(48).every(b=>b.cells.length>=20 && b.cells.length<=90 && b.cells.every(c=>c.ci>=0&&c.ci<=5))'));

// 11. 分页布局常量
ok('11. ALBUM_TAB 4列', run('ALBUM_TAB.cols') === 4);
ok('12. 8 标签两行不溢出', run('(()=>{let m=0;for(let p=0;p<8;p++){const tx=ALBUM_TAB.x0+(p%4)*(ALBUM_TAB.w+ALBUM_TAB.gap);m=Math.max(m,tx+ALBUM_TAB.w);}return m;})()') <= 540);
ok('13. 第二行 y 坐标', run('ALBUM_TAB.y0+(Math.floor(7/4))*(ALBUM_TAB.h+ALBUM_TAB.gap)') === 141);

// 14. 图鉴场景绘制（8 页都画一遍，含新篇）
ok('14. 绘制 8 页图鉴无异常', run('(()=>{S.scene="album";for(let p=0;p<8;p++){S.albumPage=p;draw();}return true;})()') === true);
ok('15. 新篇图样绘制（full/progress/locked 三态）', run('(()=>{S.beadDone={};S.beadGot=50;S.scene="album";S.albumPage=6;draw();S.albumPage=7;draw();return true;})()') === true);

// 16. 触控切换到新篇（onTouchStart + 设计坐标换算成 clientX/Y）
run('S.scene="album";S.albumPage=0;');
function clickTab(p) {
  const d = run('({x:ALBUM_TAB.x0+(' + p + '%4)*(ALBUM_TAB.w+ALBUM_TAB.gap)+5,y:ALBUM_TAB.y0+Math.floor(' + p + '/4)*(ALBUM_TAB.h+ALBUM_TAB.gap)+5})');
  const sc = run('scale'), oxv = run('ox'), oyv = run('oy');
  handlers.start({ touches: [{ clientX: d.x * sc + oxv, clientY: d.y * sc + oyv }] });
}
clickTab(6);
ok('16. 点击切到海鲜篇(索引6)', run('S.albumPage') === 6);
clickTab(7);
ok('17. 点击切到服装篇(索引7)', run('S.albumPage') === 7);

// 18. 发放/合成逻辑不因篇数增加坏掉（第 65 个图样不该存在）
run('S.beadDone={};for(let i=0;i<64;i++)S.beadDone[i]=true;S.beadGot=0;S.items=[0,0,0];grantBeads(1);');
ok('18. 全部集齐后不再发豆', run('S.beadGot') === 0 && run('currentBeadIdx()') === 64);

// 19. 核心玩法回归
ok('19. 消行计分', run('(()=>{startEndless();S.board=Array.from({length:N},()=>Array(N).fill(-1));for(let x=0;x<9;x++)S.board[9][x]=0;S.pieces=[{cells:[[0,0,0]],used:false}];S.score=0;place(0,9,9);return S.score===11;})()'));
ok('20. 还原快照', run('(()=>{startLevel(1);S.board[2][2]=-1;S.pieces=[{cells:[[0,0,0]],used:false}];S.score=0;saveSnap();place(0,2,2);restoreSnap();return S.board[2][2]===-1&&S.score===0;})()'));

console.log('\n结果: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
