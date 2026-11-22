// 生成图鉴预览 HTML（海鲜篇/服装篇），注入 wx mock
const fs = require('fs');
const game = fs.readFileSync('wechat-minigame/game.js', 'utf8').replace(/^'use strict';/m, '');
const view = process.argv[2] || 'album6';
const setups = {
  album6: 'S.scene="album";S.albumPage=6;S.beadDone={};for(let i=0;i<48;i++)S.beadDone[i]=true;S.beadGot=30;draw();',
  album7: 'S.scene="album";S.albumPage=7;S.beadDone={};for(let i=0;i<56;i++)S.beadDone[i]=true;S.beadGot=60;draw();'
};
const mock = `
var wx={
  createCanvas:function(){var c=document.createElement('canvas');c.width=540;c.height=960;c.id='main';document.body.appendChild(c);return c;},
  getSystemInfoSync:function(){return {pixelRatio:1,windowWidth:540,windowHeight:960};},
  onTouchStart:function(){},onTouchMove:function(){},onTouchEnd:function(){},
  getStorageSync:function(){return 0;},setStorageSync:function(){},
  getOpenDataContext:function(){return {canvas:document.createElement('canvas'),postMessage:function(){}};}
};
`;
const html = '<!DOCTYPE html><html><head><meta charset=utf-8><style>*{margin:0;padding:0}body{background:#ddd}canvas{display:block;margin:0 auto}</style></head><body><script>' + mock + game + '\ntry{' + setups[view] + '}catch(e){document.title="ERR:"+e.message;throw e}\<\/script></body></html>';
fs.writeFileSync('_preview_' + view + '.html', html);
console.log('written', view);
