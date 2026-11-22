// 验证音频解锁：模拟严格自动播放策略（等同 iOS），检查首次手势前后的播放结果
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9555;
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audiotest-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--mute-audio',
  '--autoplay-policy=user-gesture-required',   // 模拟 iOS 的严格策略
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + userDir, 'about:blank'
], { stdio: 'ignore' });

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
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});

const W = 390, H = 844;
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

// 在页面脚本执行前挂上播放结果记录
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__audioLog = [];
    (function(){
      var orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        var self = this;
        var tag = (self.src || '').split('/').pop().split(';')[0].slice(0, 18) || '(empty)';
        var p;
        try { p = orig.apply(self, arguments); }
        catch (e) { window.__audioLog.push('THROW ' + tag); throw e; }
        if (p && p.then) {
          p.then(function(){ window.__audioLog.push('OK   ' + tag); })
           .catch(function(e){ window.__audioLog.push('FAIL ' + tag + '  <- ' + e.name); });
        } else {
          window.__audioLog.push('OK?  ' + tag);
        }
        return p;
      };
    })();
  `
});

await send('Page.navigate', { url: 'http://localhost:8899/' });
await sleep(2500);

const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

console.log('激活前 hasBeenActive =', await ev('navigator.userActivation.hasBeenActive'));

// 1）未触摸：直接播
await ev(`window.__audioLog=[]; if(typeof sfx==='function'){sfx('w1');} 'issued'`);
await sleep(600);
console.log('未触摸时播放结果:', await ev('JSON.stringify(window.__audioLog)'));

// 2）模拟第一次触摸（解锁）+ 同一手势内立刻播放（真实场景：第一次点击就触发音效）
const scale = Math.min(W / 540, H / 960), ox = (W - 540 * scale) / 2, oy = (H - 960 * scale) / 2;
const sx = x => ox + x * scale, sy = y => oy + y * scale;

await ev(`window.__audioLog=[]; window.__once=false;
  wx.onTouchStart(function(){ if(!window.__once){ window.__once = true; if(typeof sfx==='function') sfx('w3'); } });
  'hooked'`);

await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx(270), y: sy(60), id: 1, force: 1 }] });
await sleep(60);
await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await sleep(900);
console.log('触摸后 hasBeenActive =', await ev('navigator.userActivation.hasBeenActive'));
console.log('★ 第一次触摸同一手势内播放:', await ev('JSON.stringify(window.__audioLog)'));

// 3）已激活：再播
await ev(`window.__audioLog=[]; if(typeof sfx==='function'){sfx('w1');} 'issued'`);
await sleep(800);
console.log('触摸后播放结果:', await ev('JSON.stringify(window.__audioLog)'));

ws.close(); chrome.kill();
setTimeout(() => { try { fs.rmSync(userDir, { recursive: true, force: true }); } catch (e) { } process.exit(0); }, 300);
