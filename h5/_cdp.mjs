// 用 CDP 精确模拟手机视口 + 真实触摸，验证 H5 版能玩
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const URL = process.env.URL || 'http://localhost:8899/';
const OUT = process.env.OUT || 'D:/本地AI/game';
const TAG = process.env.TAG || 'h5';

const W = Number(process.env.W) || 390;
const H = Number(process.env.H) || 844;
const DPR = Number(process.env.DPR) || 3;

const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + userDir,
  'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const list = await r.json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* 还没起来 */ }
    await sleep(200);
  }
  throw new Error('chrome 未就绪');
}

const ws = new WebSocket(await getWsUrl());
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let seq = 0;
const pending = new Map();
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: DPR, mobile: true,
  screenOrientation: { type: 'portraitPrimary', angle: 0 }
});
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

await send('Page.navigate', { url: URL });
await sleep(2600);

// 收集页面错误
const errs = await send('Runtime.evaluate', {
  expression: `JSON.stringify({ err: window.__errs || [], title: document.title,
    iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio,
    canvas: (function(){var c=document.getElementById('game');return c?[c.width,c.height]:null})() })`,
  returnByValue: true
});
console.log('env', errs.result.value);

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const p = path.join(OUT, '_' + TAG + '_' + name + '.png');
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
  console.log('shot', p);
}

// 设计坐标 → 屏幕坐标
const scale = Math.min(W / 540, H / 960);
const ox = (W - 540 * scale) / 2;
const oy = (H - 960 * scale) / 2;
const sx = x => ox + x * scale;
const sy = y => oy + y * scale;

async function tap(x, y, holdMs = 60) {
  const cx = sx(x), cy = sy(y);
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1, radiusX: 8, radiusY: 8, force: 1 }]
  });
  await sleep(holdMs);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(320);
}

async function drag(x0, y0, x1, y1, steps = 8) {
  await send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: sx(x0), y: sy(y0), id: 1, radiusX: 8, radiusY: 8, force: 1 }]
  });
  await sleep(40);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: sx(x0 + (x1 - x0) * t), y: sy(y0 + (y1 - y0) * t), id: 1, radiusX: 8, radiusY: 8, force: 1 }]
    });
    await sleep(22);
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(520);
}

const scene = async () => (await send('Runtime.evaluate', {
  expression: `(function(){try{return JSON.stringify({scene:S.scene,mode:S.mode,level:S.level,pieces:S.pieces?S.pieces.length:0,beadGot:S.beadGot})}catch(e){return 'ERR '+e.message}})()`,
  returnByValue: true
})).result.value;

console.log('scene0', await scene());
await shot('menu');

// 点「闯关模式」卡片
await tap(193, 370);
console.log('scene1', await scene());
await shot('level');

// 拖第一块到底盘中央
await drag(120, 862, 200, 400, 10);
console.log('scene2', await scene());
await shot('placed');

// 刷新页面：验证暂存续玩（localStorage 持久化）
await send('Page.reload', { ignoreCache: true });
await sleep(2600);
console.log('scene3 (reload)', await scene());
await shot('resumed');

ws.close();
chrome.kill();
setTimeout(() => { try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { } process.exit(0); }, 400);
