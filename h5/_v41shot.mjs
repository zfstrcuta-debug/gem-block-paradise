// v41 视觉抽查：8×8 / 10×10 新障碍图样实拍
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9366, URL = 'http://localhost:8899/', OUT = 'D:/本地AI/game';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let server = null;
try { await fetch(URL); } catch (e) {
  server = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { await sleep(150); try { await fetch(URL); break; } catch (e) {} }
}
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-v41-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + userDir, 'about:blank'], { stdio: 'ignore' });
async function getWs() {
  for (let i = 0; i < 60; i++) {
    try { const p = (await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json()).find(t => t.type === 'page');
      if (p) return p.webSocketDebuggerUrl; } catch (e) {}
    await sleep(200);
  }
  throw new Error('chrome 未就绪');
}
const ws = new WebSocket(await getWs());
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0; const pending = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Page.navigate', { url: URL });
await ev('localStorage.clear();');
await send('Page.reload', { ignoreCache: true });
for (let i = 0; i < 80; i++) { await sleep(250); if (await ev("typeof S !== 'undefined' && !!S.pieces")) break; }
for (const n of [21, 30, 40]) {
  await ev('startLevel(' + n + '); draw();');
  await sleep(300);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, '_v41_L' + n + '.png'), Buffer.from(r.data, 'base64'));
  console.log('shot L' + n, 'active=' + await ev('S.active'));
}
ws.close(); chrome.kill(); server?.kill();
setTimeout(() => { try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 300);
