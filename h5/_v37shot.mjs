// v37 实拍：音效开关（开/关两态）+ 无收集关卡 + 玩法说明新提示
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9362;
const URL = process.env.URL || 'http://localhost:8899/';
const OUT = 'D:/本地AI/game';
const TAG = process.env.TAG || 'v37';
const W = 390, H = 844, DPR = 3;
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-v37-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDir, 'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getWs() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const p = (await r.json()).find(t => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch (e) {}
    await sleep(200);
  }
  throw new Error('chrome 未就绪');
}
const ws = new WebSocket(await getWs());
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0; const pending = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true,
  screenOrientation: { type: 'portraitPrimary', angle: 0 } });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: URL }); await sleep(2400);
await ev('localStorage.clear();');
await send('Page.reload', { ignoreCache: true });
let ready = false;
for (let i = 0; i < 80; i++) {
  await sleep(300);
  if (await ev("typeof S !== 'undefined' && !!S.pieces")) { ready = true; break; }
}
console.log('game ready', ready);
if (!ready) { console.log('TIMEOUT'); ws.close(); chrome.kill(); process.exit(2); }
async function shot(name) {
  await sleep(320);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, '_' + TAG + '_' + name + '.png'), Buffer.from(r.data, 'base64'));
  console.log('shot', name);
}

// 第 1 关：喇叭开态 + 托盘形状
await ev("S.tutorialDone=true; S.soundOn=true; startLevel(1); draw();");
await shot('sound_on');
// 点击喇叭（设计坐标 394,18 → 手机像素需换算）
const scale = Math.min(W / 540, H / 960), ox = (W - 540 * scale) / 2, oy = (H - 960 * scale) / 2;
const sx = x => ox + x * scale, sy = y => oy + y * scale;
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx(414), y: sy(38), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
await sleep(60);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await shot('sound_off');
console.log('soundOn after tap =', await ev('S.soundOn'));
// 再点一次确认能开回来
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx(414), y: sy(38), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
await sleep(60);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('soundOn after 2nd tap =', await ev('S.soundOn'));
// L15：无收集关仍是普通块
await ev("startLevel(15); draw();");
await shot('L15');
console.log('L15 goal =', await ev('S.goal ? JSON.stringify(S.goal) : "null"'));
console.log('L15 piece codes =', await ev('JSON.stringify(S.pieces.map(p=>p.cells.map(c=>c[2])))'));
// 玩法说明：新提示行
await ev("S.scene='info'; S.infoPage='help'; S.infoScroll=0; draw();");
await shot('help_top');

console.log('__errors', await ev('JSON.stringify(window.__errs||[])'));
ws.close(); chrome.kill();
