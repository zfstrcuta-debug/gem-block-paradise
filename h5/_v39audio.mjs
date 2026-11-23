// v40 真浏览器验证：拾取/拖动静音，落子轻咔，消除叠木琴（挂钩 HTMLMediaElement.play）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9364, URL = 'http://localhost:8899/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let server = null;
try { await fetch(URL); } catch (e) {
  server = spawn(process.execPath, ['server.mjs'], { cwd: path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { await sleep(150); try { await fetch(URL); break; } catch (e) {} }
}
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-v39audio-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--autoplay-policy=user-gesture-required', '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + userDir, 'about:blank'], { stdio: 'ignore' });
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
const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__audioLog = [];
  (function(){
    var orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      var tag = (this.src || '').split('/').pop().split(';')[0].slice(0, 18) || '(empty)';
      var p;
      try { p = orig.apply(this, arguments); } catch (e) { window.__audioLog.push('THROW ' + tag); throw e; }
      if (p && p.then) p.then(function(){ window.__audioLog.push('OK ' + tag); },
                              function(e){ window.__audioLog.push('FAIL ' + tag + ' ' + e.name); });
      else window.__audioLog.push('OK? ' + tag);
      return p;
    };
  })();
` });
await send('Page.navigate', { url: URL });
await ev('localStorage.clear();');
await send('Page.reload', { ignoreCache: true });
let ready = false;
for (let i = 0; i < 80; i++) { await sleep(250); if (await ev("typeof S !== 'undefined' && !!S.pieces")) { ready = true; break; } }
if (!ready) { console.log('TIMEOUT'); ws.close(); chrome.kill(); server?.kill(); process.exit(2); }
const scale = Math.min(390 / 540, 844 / 960), ox = (390 - 540 * scale) / 2, oy = (844 - 960 * scale) / 2;
const sx = x => ox + x * scale, sy = y => oy + y * scale;
// 过滤 shim 解锁用的 20ms 静音 WAV（tag 解析成 "wav"），只留 wood*/done 游戏音
const real = () => ev('JSON.stringify(window.__audioLog.filter(function(x){return x.split(" ")[1] !== "wav";}))');
let fail = 0;
const ok = (c, n, d) => { console.log((c ? '✓ ' : '✗ ') + n + (d ? ' | ' + d : '')); if (!c) fail++; };

await ev(`startLevel(1); S.soundOn=true; S.drag=-1; S.sel=-1; window.__audioLog=[]; 'ready'`);
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx(90), y: sy(850), id: 1, force: 1 }] });
await sleep(250);
ok((await ev('S.drag')) === 0 && await real() === '[]', '拿起方块：进入拖拽态且零发声', await real());
await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx(200), y: sy(600), id: 1, force: 1 }] });
await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx(260), y: sy(500), id: 1, force: 1 }] });
await sleep(200);
ok(await real() === '[]', '拖动过程零发声', await real());
await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx(200), y: sy(850), id: 1, force: 1 }] });
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(200);
ok(await real() === '[]', '松手在棋盘外（未放置）零发声', await real());

// 拖拽到棋盘内放下（不消除）：只响一声轻咔
await ev(`(function(){
  startLevel(1); S.soundOn=true; window.__audioLog=[];
  for(var y=S.reg.s;y<S.reg.e;y++) for(var x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=EMPTY;
  S.pieces=[{cells:[[0,0,6]],used:false}];
})()`);
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx(90), y: sy(850), id: 1, force: 1 }] });
await sleep(80);
await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx(244), y: sy(441 + 58), id: 1, force: 1 }] });
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(350);
const tapOnly = await real();
ok(tapOnly.includes('OK tap.wav') && !tapOnly.includes('wood'), '放下未消除：只响轻咔', tapOnly);

await ev(`(function(){
  startLevel(1); S.soundOn=true; window.__audioLog=[];
  for(var y=S.reg.s;y<S.reg.e;y++) for(var x=S.reg.s;x<S.reg.e;x++) S.board[y][x]=EMPTY;
  var row=S.reg.s,last=S.reg.e-1;
  for(var x=S.reg.s;x<last;x++) S.board[row][x]=6;
  S.pieces=[{cells:[[0,0,6]],used:false}];
  place(0,last,row);
})()`);
await sleep(500);
const log = await real();
ok(log.includes('OK tap.wav') && log.includes('OK wood'), '放置并消除：轻咔 + 木琴', log);

console.log('==== 浏览器验证 ' + (fail ? '失败 ' + fail + ' 项' : '全部通过') + ' ====');
ws.close(); chrome.kill(); server?.kill();
setTimeout(() => { try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) {} process.exit(fail ? 1 : 0); }, 300);
