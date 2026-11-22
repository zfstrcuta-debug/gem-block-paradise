/* 宝石方块乐园 · H5 平台适配层
 * 把浏览器能力映射成微信小游戏 wx.* 接口，game.js 一个字不改直接跑。
 * 覆盖：canvas / 系统信息 / 存储 / 触摸 / 音频 / 分享 / 震动 / 前后台切换
 */
(function () {
  'use strict';

  var mainCanvas = document.getElementById('game');
  var canvasUsed = false;

  // ---------- 画布 ----------
  // 第一次调用返回主画布（满屏），之后返回离屏画布（拼图 sprite / 缓存层）
  function createCanvas() {
    if (!canvasUsed) { canvasUsed = true; return mainCanvas; }
    var c = document.createElement('canvas');
    return c;
  }

  function viewport() {
    var de = document.documentElement;
    var w = Math.round(Math.min(window.innerWidth, de.clientWidth || window.innerWidth));
    var h = Math.round(Math.min(window.innerHeight, de.clientHeight || window.innerHeight));
    return { w: w || 390, h: h || 844 };
  }

  function getSystemInfoSync() {
    var v = viewport();
    return {
      pixelRatio: Math.min(window.devicePixelRatio || 1, 3),
      windowWidth: v.w,
      windowHeight: v.h,
      screenWidth: v.w,
      screenHeight: v.h,
      platform: 'h5',
      system: (navigator.userAgent || '').slice(0, 60),
      brand: 'h5',
      model: 'browser',
      language: navigator.language || 'zh_CN',
      SDKVersion: '3.18.0',
      safeArea: { top: 0, bottom: v.h, left: 0, right: v.w, width: v.w, height: v.h }
    };
  }

  // ---------- 存储 ----------
  // 微信 storage 支持任意可序列化值，取不到时返回空字符串
  var PREFIX = 'gbp:';
  function storageGet(key) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return '';
      return JSON.parse(raw);
    } catch (e) { return ''; }
  }
  function storageSet(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) { /* 隐私模式忽略 */ }
  }
  function storageRemove(key) {
    try { localStorage.removeItem(PREFIX + key); } catch (e) { /* 忽略 */ }
  }

  // ---------- 触摸 ----------
  var touchHandlers = { start: [], move: [], end: [], cancel: [] };

  function point(e) {
    return { identifier: e.pointerId || 0, clientX: e.clientX, clientY: e.clientY, pageX: e.pageX, pageY: e.pageY, force: 1 };
  }
  function makeEvent(e, ended) {
    var p = point(e);
    return {
      touches: ended ? [] : [p],
      changedTouches: [p],
      timeStamp: e.timeStamp || Date.now()
    };
  }
  function emit(type, ev) {
    var list = touchHandlers[type];
    for (var i = 0; i < list.length; i++) {
      try { list[i](ev); } catch (err) { console.error('[touch ' + type + ']', err); }
    }
  }

  var activePointer = null;

  mainCanvas.addEventListener('pointerdown', function (e) {
    if (activePointer !== null && activePointer !== e.pointerId) return; // 单点操作，忽略第二根手指
    activePointer = e.pointerId;
    try { mainCanvas.setPointerCapture(e.pointerId); } catch (err) { /* 老浏览器忽略 */ }
    unlockAudio();
    emit('start', makeEvent(e, false));
  }, { passive: true });

  mainCanvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== activePointer) return;
    emit('move', makeEvent(e, false));
  }, { passive: true });

  function endPointer(e) {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    emit('end', makeEvent(e, true));
  }
  mainCanvas.addEventListener('pointerup', endPointer, { passive: true });
  mainCanvas.addEventListener('pointercancel', function (e) {
    if (e.pointerId !== activePointer) return;
    activePointer = null;
    emit('cancel', makeEvent(e, true));
  }, { passive: true });

  // 双保险：部分安卓 WebView 的 pointer 事件不全，补一套 touch 兜底
  if (window.PointerEvent === undefined) {
    mainCanvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      activePointer = 1;
      var t = e.touches[0];
      emit('start', { touches: [point(t)], changedTouches: [point(t)] });
    }, { passive: false });
    mainCanvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var t = e.touches[0];
      emit('move', { touches: [point(t)], changedTouches: [point(t)] });
    }, { passive: false });
    mainCanvas.addEventListener('touchend', function (e) {
      e.preventDefault();
      var t = e.changedTouches[0];
      emit('end', { touches: [], changedTouches: [point(t)] });
    }, { passive: false });
  }

  // ---------- 音频 ----------
  // 移动端（尤其 iOS）的播放必须先拿到一次「用户激活」，否则第一批 play() 会被静音丢弃。
  // 关键：只 new 一个 AudioContext 并 resume 是不够的，必须真的播出一点声音，
  // 页面才会被标记为已激活。这里播一段 20ms 静音 WAV，听不见但有效。
  var audioReady = false;
  var audioPool = [];
  var SILENT_WAV = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

  function unlockAudio() {
    if (audioReady) return;
    audioReady = true;

    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        var ac = new AC();
        if (ac.state === 'suspended' && ac.resume) ac.resume();
      }
    } catch (e) { /* 忽略 */ }

    try {
      var sil = new Audio(SILENT_WAV);
      sil.volume = 0.01;
      var sp = sil.play();
      if (sp && sp.catch) sp.catch(function () { /* 忽略 */ });
    } catch (e) { /* 忽略 */ }
  }

  function createInnerAudioContext() {
    var el = new Audio();
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    audioPool.push(el);

    var api = {
      _src: '',
      get src() { return this._src; },
      set src(v) {
        this._src = v;
        el.src = v;
        try { el.load(); } catch (e) { /* 主动触发缓冲，缩短首播延迟 */ }
      },
      get volume() { return el.volume; },
      set volume(v) { el.volume = Math.max(0, Math.min(1, v)); },
      get loop() { return el.loop; },
      set loop(v) { el.loop = !!v; },
      play: function () {
        // 注意：媒体未就绪时 el.currentTime = 0 会抛 InvalidStateError。
        // 必须与 play() 分开 try，否则第一次播放会被连坐吞掉——这正是「第一次消除没声音」的原因。
        try { el.pause(); } catch (e) { /* 忽略 */ }
        try { el.currentTime = 0; } catch (e) { /* 未就绪，跳过 */ }
        try {
          var p = el.play();
          if (p && p.catch) p.catch(function () { /* 被自动播放策略拦截时静默 */ });
        } catch (e) { /* 忽略 */ }
      },
      stop: function () {
        try { el.pause(); } catch (e) { /* 忽略 */ }
        try { el.currentTime = 0; } catch (e) { /* 忽略 */ }
      },
      pause: function () { try { el.pause(); } catch (e) { /* 忽略 */ } },
      seek: function () { },
      destroy: function () { try { el.pause(); el.src = ''; } catch (e) { /* 忽略 */ } },
      onPlay: function () { }, onEnded: function () { }, onError: function () { }
    };
    return api;
  }

  // ---------- 分享 ----------
  function shareAppMessage(opt) {
    var title = (opt && opt.title) || document.title;
    var url = (opt && opt.imageUrl) || location.href;
    if (navigator.share) {
      navigator.share({ title: title, text: title, url: location.href }).catch(function () { /* 用户取消 */ });
    } else {
      var tip = document.createElement('div');
      tip.textContent = '长按复制本页链接分享：' + location.href;
      tip.style.cssText = 'position:fixed;left:50%;bottom:8%;transform:translateX(-50%);max-width:80vw;' +
        'padding:12px 18px;border-radius:14px;background:rgba(38,35,32,.92);color:#F6F2EA;' +
        'font:14px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;z-index:99;text-align:center';
      document.body.appendChild(tip);
      setTimeout(function () { tip.remove(); }, 2600);
    }
  }

  // ---------- 震动 ----------
  function vibrateShort(opt) {
    var type = (opt && opt.type) || 'light';
    var ms = type === 'heavy' ? 35 : type === 'medium' ? 22 : 12;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* 忽略 */ }
  }

  // ---------- 前后台 ----------
  var showHandlers = [], hideHandlers = [];
  function fireShow() { for (var i = 0; i < showHandlers.length; i++) { try { showHandlers[i](); } catch (e) { } } }
  function fireHide() { for (var i = 0; i < hideHandlers.length; i++) { try { hideHandlers[i](); } catch (e) { } } }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) fireHide(); else fireShow();
  });
  window.addEventListener('pagehide', fireHide);
  // iOS Safari 切 App / 接电话不触发 visibilitychange 的情况，用 blur 兜底
  window.addEventListener('blur', function () { setTimeout(function () { if (document.hidden) fireHide(); }, 60); });

  // ---------- 导出 ----------
  window.wx = {
    createCanvas: createCanvas,
    getSystemInfoSync: getSystemInfoSync,
    getStorageSync: storageGet,
    setStorageSync: storageSet,
    removeStorageSync: storageRemove,
    clearStorageSync: function () { try { localStorage.clear(); } catch (e) { } },
    onTouchStart: function (fn) { touchHandlers.start.push(fn); },
    onTouchMove: function (fn) { touchHandlers.move.push(fn); },
    onTouchEnd: function (fn) { touchHandlers.end.push(fn); },
    onTouchCancel: function (fn) { touchHandlers.cancel.push(fn); },
    createInnerAudioContext: createInnerAudioContext,
    shareAppMessage: shareAppMessage,
    onShareAppMessage: function () { },
    vibrateShort: vibrateShort,
    vibrateLong: function () { try { if (navigator.vibrate) navigator.vibrate(400); } catch (e) { } },
    onShow: function (fn) { showHandlers.push(fn); },
    onHide: function (fn) { hideHandlers.push(fn); },
    // 好友排行榜依赖开放数据域，浏览器里没有 —— 抛错让 game.js 走「空榜」降级分支
    getOpenDataContext: function () { throw new Error('H5 has no open data context'); },
    showToast: function (o) { console.log('[toast]', o && o.title); },
    showModal: function () { },
    getLaunchOptionsSync: function () { return { scene: 1001, query: {} }; },
    exitMiniProgram: function () { }
  };
})();
