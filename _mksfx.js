// 生成木琴风音效 WAV（无外部素材依赖）：基频正弦 + 3x/6.3x 泛音 + 指数衰减
// 用法：node _mksfx.js  → 输出到 wechat-minigame/audio/*.wav
const fs = require('fs');
const path = require('path');
const SR = 22050;
const OUT = path.join(__dirname, 'wechat-minigame', 'audio');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// 木琴音色：基频 + 快衰减的三倍频泛音 + 更快的 6.3 倍频（敲击质感）+ 总包络
function tone(f0, dur, gain) {
  const n = Math.floor(SR * dur);
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 9);                       // 木琴的短衰减
    const strike = Math.exp(-t * 30) * 0.12;            // 敲击瞬态（6.3x 非谐泛音）
    buf[i] = (
      Math.sin(2 * Math.PI * f0 * t) +
      Math.sin(2 * Math.PI * f0 * 3 * t) * 0.35 * Math.exp(-t * 18) +
      Math.sin(2 * Math.PI * f0 * 6.3 * t) * strike
    ) * env * gain;
    if (i < 40) buf[i] *= i / 40;                       // 去爆音的 2ms 淡入
  }
  return buf;
}
function writeWav(name, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    let v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
  hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20);
  hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28);
  hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34);
  hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, name + '.wav'), Buffer.concat([hdr, data]));
  console.log(name + '.wav', (44 + data.length) + 'B');
}

// 五音阶：连击越高音越亮（C 大调五度排列），done = 上行双音
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.00];   // C5 D5 E5 G5 A5
NOTES.forEach((f, i) => writeWav('wood' + (i + 1), tone(f, 0.28, 0.9)));
// 合成/过关：E6 + C6 双音叠合
const done = tone(1318.5, 0.5, 0.55);
tone(1046.5, 0.5, 0.55).forEach((v, i) => { done[i] += v; });
writeWav('done', done);
console.log('done → ' + OUT);
