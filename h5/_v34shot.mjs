// v34 手机视口实拍：教程四步、点选放置、拖拽上移显示
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334;
const URL = process.env.URL || 'http://localhost:8899/';
const OUT = 'D:/本地AI/game';
const W = 390, H = 844, DPR = 3;
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-v34-'));
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
for (let i = 0; i < 60; i++) {
  await sleep(300);
  if (await ev("typeof S !== 'undefined' && !!S.pieces")) { ready = true; break; }
}
console.log('game ready', ready);
if (!ready) { console.log('TIMEOUT waiting game'); ws.close(); chrome.kill(); process.exit(2); }

const scale = Math.min(W / 540, H / 960);
const ox = (W - 540 * scale) / 2, oy = (H - 960 * scale) / 2;
const sx = x => ox + x * scale, sy = y => oy + y * scale;
async function tap(x, y) {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx(x), y: sy(y), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
  await sleep(70);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(420);
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const p = path.join(OUT, '_v34_' + name + '.png');
  fs.writeFileSync(p, Buffer.from(r.data, 'base64')); console.log('shot', p);
}

console.log('env', await ev(`JSON.stringify({err:window.__errs||[], iw:innerWidth, ih:innerHeight, dpr:devicePixelRatio, v:document.querySelector('script[src*=game]')?.src})`));
// 首次进第 1 关
await ev('startLevel(1); draw();');
console.log('t0', await ev(`JSON.stringify({step:S.tutorial&&S.tutorial.step, done:S.tutorialDone, level:S.level, active:S.active, goal:S.goal})`));
await shot('tut0');
// 点第一块托盘 → 应进入点选态、教程 step1
await tap(90, 830);
console.log('after pickup', await ev(`JSON.stringify({step:S.tutorial&&S.tutorial.step, sel:S.sel, drag:S.drag})`));
await shot('tut1');
// 点棋盘放置 → 教程 step2
await tap(270, 480);
console.log('after place', await ev(`JSON.stringify({step:S.tutorial&&S.tutorial.step, score:S.score, used:S.pieces.map(p=>p.used), sel:S.sel})`));
await shot('tut2');
// 推进到 step3（省去凑满一行的等待）
await ev('tutorialAdvance(3); draw();');
await shot('tut3');
// 跳过按钮：应写存档且不再显示
await tap(468, 205);
console.log('after skip', await ev(`JSON.stringify({tut:S.tutorial, done:S.tutorialDone, stored:localStorage.getItem('gbp:tutorialDone')})`));
// 拖拽上移显示：按住「第二块」（第一块已用掉）拖到棋盘中途截图
await ev('S.sel=-1; draw();');
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx(270), y: sy(830), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
await sleep(60);
await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx(260), y: sy(520), id: 1, radiusX: 8, radiusY: 8, force: 1 }] });
await sleep(120);
console.log('dragging', await ev(`JSON.stringify({drag:S.drag, pos:S.pos, inBoard:inBoard(S.pos), anchor:dragAnchor(S.pos)})`));
await shot('dragging');
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(400);
console.log('errors', await ev('JSON.stringify(window.__errs||[])'));
ws.close(); chrome.kill();
setTimeout(() => { try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) {} process.exit(0); }, 400);
