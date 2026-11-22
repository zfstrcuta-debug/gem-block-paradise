# 宝石方块乐园 · Gem Block Paradise

柔和安静的解压拼图小游戏。同一份游戏逻辑，跑在三个地方：**微信小游戏**、**手机浏览器（H5/PWA）**、**安卓 App**。

---

## 目录

```
wechat-minigame/        微信小游戏工程（唯一真源：game.js 只在这里改）
  game.js               全部游戏逻辑，Canvas 2D 单文件
  audio/                木琴音效 WAV（由 _mksfx.js 生成）
  open-data/            好友排行榜开放数据域
  project.config.json   微信开发者工具工程配置

h5/                     浏览器版 —— 加了一层平台适配，game.js 一字不改
  wx-shim.js            把 wx.* API 映射成浏览器能力
  index.html            满屏画布 + PWA 元信息
  manifest.webmanifest  加到主屏幕后全屏独立运行
  build.mjs             从 wechat-minigame/ 同步源码过来
  server.mjs            局域网服务，手机同 WiFi 可直接打开

android-app/            安卓壳（Capacitor）
  sync-www.mjs          把 h5 产物同步到 www/
  capacitor.config.json 应用标识 / 配色 / 配置
  android/              原生工程（图标、启动图、竖屏、沉浸式已配好）
```

## 跑起来

### 微信小游戏（最接近正式上线）

用微信开发者工具打开 `wechat-minigame/`，然后「真机调试 / 预览」扫码，手机上就能玩。

### 手机浏览器（不用装任何东西）

```bash
cd h5
node server.mjs          # 或双击「启动手机试玩.bat」
```

手机连同一个 WiFi，浏览器打开终端里打印的 `http://<电脑IP>:8899/`。
iOS Safari / Android Chrome 里选「添加到主屏幕」，就有独立图标、全屏无地址栏。

### 安卓 APK

需要 JDK 21 + Android SDK（compileSdk 36）。

```bash
cd android-app
node sync-www.mjs
npx cap sync android
cd android
./gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

## 改代码之后

`game.js` 是唯一手写的游戏源码。改完同步：

```bash
cd h5 && node build.mjs           # H5
cd android-app && node sync-www.mjs && npx cap sync android   # 安卓
```

## 平台适配层做了什么

`h5/wx-shim.js` 只做一件事：把游戏用到的 14 个微信接口翻译成浏览器接口。

| 微信 | 浏览器 |
| --- | --- |
| `wx.createCanvas()` | 首次返回页面主画布，之后返回离屏 canvas |
| `wx.getStorageSync` / `setStorageSync` | `localStorage`（JSON 序列化，前缀 `gbp:`） |
| `wx.onTouchStart/Move/End` | Pointer Events，单指操作 |
| `wx.createInnerAudioContext` | `HTMLAudioElement`，首次触摸时解锁 |
| `wx.vibrateShort` | `navigator.vibrate` |
| `wx.shareAppMessage` | `navigator.share`，不支持时回退为复制链接提示 |
| `wx.onShow` / `onHide` | `visibilitychange` + `pagehide` |
| `wx.getOpenDataContext` | 主动抛错，让游戏走「空榜」降级分支 |

因为绘制完全依赖 `sys.windowWidth / windowHeight / pixelRatio`，适配层如实返回真实视口和 DPR，画面在任意机型上都能正确居中缩放。

## 已知限制

- 激励视频目前是**模拟弹窗**，没有接真实广告 SDK。
- 好友排行榜依赖微信开放数据域，H5 与 APK 里显示为空榜。
- 暂存续玩（接电话 / 切后台 / 杀进程）在三个端都生效，靠 `saveResume()` 每手落盘。
