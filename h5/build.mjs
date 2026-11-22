// 把微信小游戏源码同步到 H5 目录（单一代码源：只改 wechat-minigame/game.js）
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'wechat-minigame');
const DST = import.meta.dirname;

const files = ['game.js'];
for (const f of files) {
  fs.copyFileSync(path.join(SRC, f), path.join(DST, f));
  console.log('copy', f, (fs.statSync(path.join(SRC, f)).size / 1024).toFixed(1) + 'KB');
}

// 音频整目录同步
const srcAudio = path.join(SRC, 'audio');
const dstAudio = path.join(DST, 'audio');
fs.mkdirSync(dstAudio, { recursive: true });
for (const f of fs.readdirSync(srcAudio)) {
  fs.copyFileSync(path.join(srcAudio, f), path.join(dstAudio, f));
}
console.log('copy audio/', fs.readdirSync(dstAudio).length, 'files');

// 版本戳写进 index.html 的 title 注释，方便确认手机上跑的是哪一版
const gameJs = fs.readFileSync(path.join(SRC, 'game.js'), 'utf8');
const ver = (gameJs.match(/GAME_VERSION\s*=\s*'([^']+)'/) || [, '?'])[1];
console.log('version', ver);

console.log('H5 同步完成 →', DST);
