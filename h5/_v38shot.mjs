// v38 实拍：拖拽预览对齐 + 锁区红框不再画方块本体
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9363;
const URL = process.env.URL || 'http://localhost:8899/';
const OUT = 'D:/本地AI/game';
const TAG = process.env.TAG || 'v38';
const W = 390, H = 844, DPR = 3;
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-v38-'));
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
const scale = Math.min(W / 540, H / 960), ox = (W - 540 * scale) / 2, oy = (H - 960 * scale) / 2;
const sx = x => ox + x * scale, sy = y => oy + y * scale;
async function move(x, y) {
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx(x), y: sy(y), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
}

// 第 1 关：拿起第一块，移到开放区格 (5,5)，anchor=格中心 → 手指 y 要 +58
await ev("S.tutorialDone=true; startLevel(1); draw();");
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx(90), y: sy(830), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
await sleep(60);
console.log('drag index', await ev('S.drag'));
const cfg = await ev('JSON.stringify({BX,BY,CELL,GAP,LIFT:DRAG_LIFT,s:S.reg.s})');
const c = JSON.parse(cfg);
const ax = c.BX + 5 * (c.CELL + c.GAP) + c.CELL / 2;
const ay = c.BY + 5 * (c.CELL + c.GAP) + c.CELL / 2;
await move(ax, ay + c.LIFT);
await shot('drag_open');
console.log('snap at open =', await ev(`JSON.stringify(snapOrigin(S.pieces[S.drag],S.pos))`));
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await shot('placed');
console.log('score after place =', await ev('S.score'));

// 锁区红框：把 ghost 直接画在左上角锁区，确认不画彩色方块本体
await ev("S.drag=-1; draw(); drawGhost(S.pieces[0],0,0,false);");
await shot('ghost_locked');

console.log('__errors', await ev('JSON.stringify(window.__errs||[])'));
ws.close(); chrome.kill();
