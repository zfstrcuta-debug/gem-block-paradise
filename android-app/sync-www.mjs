// 把 h5/ 的游戏产物同步到 www/（不含本地服务器与调试脚本）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'h5');
const DST = path.join(import.meta.dirname, 'www');

const KEEP = ['index.html', 'wx-shim.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-180.png'];

fs.rmSync(DST, { recursive: true, force: true });
fs.mkdirSync(DST, { recursive: true });

// game.js 从源头拿，保证与微信小游戏完全同源
fs.copyFileSync(path.join(ROOT, 'wechat-minigame', 'game.js'), path.join(DST, 'game.js'));

for (const f of KEEP) {
  const s = path.join(SRC, f);
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(DST, f));
}

// 音效
const audioSrc = path.join(ROOT, 'wechat-minigame', 'audio');
const audioDst = path.join(DST, 'audio');
fs.mkdirSync(audioDst, { recursive: true });
for (const f of fs.readdirSync(audioSrc)) {
  fs.copyFileSync(path.join(audioSrc, f), path.join(audioDst, f));
}

const size = (p) => (fs.statSync(p).size / 1024).toFixed(1) + 'KB';
console.log('www 同步完成');
console.log('  game.js', size(path.join(DST, 'game.js')));
console.log('  audio  ', fs.readdirSync(audioDst).length, '个文件');
