/* 开放数据域 - 好友排行榜（独立子域，只能在真 AppID 下拿到好友数据） */
'use strict';

const canvas = wx.getSharedCanvas();
const ctx = canvas.getContext('2d');
let ranking = [];
let loaded = false;

// 主域发消息：上传分数 / 触发拉取
wx.onMessage(data => {
  if (!data) return;
  if (data.action === 'setScore') {
    try {
      wx.setUserCloudStorage({
        KVDataList: [{ key: 'endlessScore', value: String(data.score) }],
        success() { if (S_showing) loadRank(); },
        fail() { if (S_showing) loadRank(); }
      });
    } catch (e) { if (S_showing) loadRank(); }
  } else if (data.action === 'show') {
    S_showing = true;
    loadRank();
  }
});
let S_showing = false;

function loadRank() {
  loaded = false;
  try {
    wx.getFriendCloudStorage({
      keyList: ['endlessScore'],
      success(res) {
        ranking = (res.data || [])
          .map(item => {
            const kv = (item.KVDataList || []).find(k => k.key === 'endlessScore');
            return { name: item.nickname || '玩家', score: kv ? (parseInt(kv.value, 10) || 0) : 0,
                     avatar: item.avatarUrl };
          })
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        loaded = true;
        draw();
      },
      fail() { loaded = true; ranking = []; draw(); }
    });
  } catch (e) { loaded = true; ranking = []; draw(); }
}

function text(s, x, y, size, color, align) {
  ctx.fillStyle = color;
  ctx.font = size + 'px sans-serif';
  ctx.textAlign = align || 'left';
  ctx.fillText(s, x, y);
}

function draw() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  // 面板
  ctx.fillStyle = '#F7F4ED';
  ctx.fillRect(30, 150, w - 60, 620);
  ctx.strokeStyle = '#C3BBAE'; ctx.lineWidth = 4;
  ctx.strokeRect(30, 150, w - 60, 620);
  text('好 友 排 行 榜', w / 2, 215, 30, '#6B6258', 'center');

  if (!loaded) {
    text('载入中…', w / 2, 400, 22, '#847B70', 'center');
    return;
  }
  if (ranking.length === 0) {
    text('尚无好友分数', w / 2, 380, 24, '#847B70', 'center');
    text('（游客模式或好友尚未游玩）', w / 2, 420, 17, '#9A9086', 'center');
    return;
  }
  for (let i = 0; i < ranking.length; i++) {
    const r = ranking[i], y = 285 + i * 45;
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    text(String(medal), 70, y, i < 3 ? 26 : 22, '#A98C63');
    text(r.name.slice(0, 10), 130, y, 21, '#5E564D');
    text(String(r.score), w - 70, y, 22, '#5E6B5C', 'right');
  }
}

draw();
