// v35 文案体检实拍：首页 / 玩法说明 / 隐私 / 关于 / 每日任务 / 排行榜 / 死局弹窗
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9351;
const URL = process.env.URL || 'http://localhost:8899/';
const OUT = 'D:/本地AI/game';
const TAG = process.env.TAG || 'v35';
const W = 390, H = 844, DPR = 3;
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-v35-'));
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
if (!ready) { console.log('TIMEOUT waiting game'); ws.close(); chrome.kill(); process.exit(2); }

async function shot(name) {
  await sleep(320);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, '_' + TAG + '_' + name + '.png'), Buffer.from(r.data, 'base64'));
  console.log('shot', name);
}
async function scene(expr, name) { await ev(expr + '; draw();'); await shot(name); }

// 1) 首页：闯关描述 / 广告福利卡 / 任务横幅
await scene("S.scene='menu'; S.tutorial=null;", 'menu');

// 2) 玩法说明：滚到「道具说明 / 死局」段，验证长句折行
await ev("S.scene='info'; S.infoPage='help'; S.infoScroll=430; draw();");
await shot('help_scroll');

// 3) 隐私政策 / 关于（版本号）
await scene("S.infoPage='privacy'; S.infoScroll=0;", 'privacy');
await scene("S.infoPage='about'; S.infoScroll=0;", 'about');

// 4) 每日任务弹窗：验证「消除 30 格方块」
await ev("S.scene='menu'; S.dailyModal=true; dailyReset(); S.daily={date:today(),lines:3,gems:12,games:1,claimed:false}; draw();");
await shot('daily');

// 5) 排行榜空榜文案
await scene("S.dailyModal=false; S.scene='rank';", 'rank');

// 6) 死局弹窗：验证「再玩一局 / 确定要结束吗」
await ev("S.scene='play'; S.mode='endless'; S.result='lose'; S.over=true; S.score=128; S.adUsed=10; S.loseHint=null; draw();");
await shot('lose');

console.log('__errors', await ev('JSON.stringify(window.__errs||[])'));
ws.close(); chrome.kill();
