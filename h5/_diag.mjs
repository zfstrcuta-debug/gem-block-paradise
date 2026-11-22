// 诊断：落一手前后 + reload 后的棋盘与暂存内容
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9444;
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdpdiag-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--mute-audio',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDir, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let wsUrl = null;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
    const p = list.find(t => t.type === 'page');
    if (p) wsUrl = p.webSocketDebuggerUrl;
  } catch (e) { }
  await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let seq = 0; const pending = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});

const W = 390, H = 844;
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: 'http://localhost:8899/' });
await sleep(2400);

const ev=async expr => (await send('Runtime.evaluate',{expression:expr,returnByValue:true})).result.value;
const dump = label => ev(`(function(){
  var r=null; try{r=wx.getStorageSync('resume')}catch(e){r='ERR'}
  var occ=[]; if(typeof S!=='undefined'&&S.board){for(var y=0;y<10;y++)for(var x=0;x<10;x++){if(S.board[y][x]!==-1&&S.board[y][x]!==-2)occ.push(x+','+y+':'+S.board[y][x]);}}
  return JSON.stringify({label:'${label}',scene:S.scene,score:S.score,lock:S.lock,
    occ:occ.join('|'),
    resumeScore:r&&r.score, resumeOcc:r&&r.board?r.board.flat().filter(v=>v!==-1&&v!==-2).length:'none'});
})()`).then(v => console.log(v));

const scale = Math.min(W / 540, H / 960), ox = (W - 540 * scale) / 2, oy = (H - 960 * scale) / 2;
const sx = x => ox + x * scale, sy = y => oy + y * scale;

await dump('after-load');
await ev(`S.scene='menu';draw();1`);
// 直接进关卡（跳过点击）
await ev(`startLevel(1);draw();1`);
await sleep(300);
await dump('after-start');

// 拖第一块
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx(120), y: sy(862), id: 1, force: 1 }] });
await sleep(50);
for (let i = 1; i <= 10; i++) {
  const t = i / 10;
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx(120 + 80 * t), y: sy(862 - 462 * t), id: 1, force: 1 }] });
  await sleep(24);
}
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(900);
await dump('after-place');

await send('Page.reload', { ignoreCache: true });
await sleep(2600);
await dump('after-reload');

ws.close(); chrome.kill();
setTimeout(() => { try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { } process.exit(0); }, 300);
