const fs=require('fs');
const src=fs.readFileSync('wechat-minigame/game.js','utf8');
const m=src.match(/const SHAPES = \[([\s\S]*?)\n\];/);
const shapes = eval('['+m[1]+']');
let html=`<!DOCTYPE html><html><head><meta charset=utf-8><style>
body{margin:0;padding:16px;background:#F0EEE8;font-family:sans-serif}
.g{display:flex;flex-wrap:wrap;gap:10px}
.c{background:#1E2622;border-radius:10px;padding:8px;position:relative}
.c b{position:absolute;top:4px;left:6px;color:#9fbfa8;font-size:11px}
table{border-collapse:collapse}
td{width:22px;height:22px}
td.on{background:#7FB08A;border-radius:4px}
</style></head><body><div class="g">`;
shapes.forEach((s,i)=>{
  const w=Math.max(...s.map(c=>c[0]))+1, h=Math.max(...s.map(c=>c[1]))+1;
  let t='<table>';
  for(let y=0;y<h;y++){ t+='<tr>'; for(let x=0;x<w;x++){ t+='<td class="'+(s.some(v=>v[0]===x&&v[1]===y)?'on':'')+'"></td>'; } t+='</tr>'; }
  t+='</table>';
  html+=`<div class="c"><b>#${i+1} (${s.length}格)</b><div style="margin-top:14px">${t}</div></div>`;
});
html+='</div></body></html>';
fs.writeFileSync('_shapesheet.html',html);
console.log('共 '+shapes.length+' 个形状');
