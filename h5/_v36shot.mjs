// v36 实拍：教学关有解发牌的多样形状 + 教程第 2 步新文案
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9361;
const URL = process.env.URL || 'http://localhost:8899/';
const OUT = 'D:/本地AI/game';
const TAG = process.env.TAG || 'v36';
const W = 390, H = 844, DPR = 3;
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-v36-'));
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

// 首次进第 1 关：教程 step0 + 有解发牌（忽略存档从头开始）
await ev("S.tutorialDone=false; startLevel(1); draw();");
await shot('tut0');
console.log('pieces@1', await ev('JSON.stringify(S.pieces.map(p=>p.cells.map(c=>c[0]+","+c[1]).join(" ")))'));
// 模拟拿起第一块 → 教程 step2 文案
await ev("S.tutorial.step=1; draw();");
await shot('tut1');
// 重开几局看形状随机性（不重跑教程）
await ev("S.tutorialDone=true; startLevel(1); draw();");
await shot('fresh1');
console.log('pieces@fresh', await ev('JSON.stringify(S.pieces.map(p=>p.cells.map(c=>c[0]+","+c[1]).join(" ")))'));
await ev("startLevel(2); draw();");
await shot('fresh2');
console.log('pieces@L2', await ev('JSON.stringify(S.pieces.map(p=>p.cells.map(c=>c[0]+","+c[1]).join(" ")))'));

console.log('__errors', await ev('JSON.stringify(window.__errs||[])'));
ws.close(); chrome.kill();
