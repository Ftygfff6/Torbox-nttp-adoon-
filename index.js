const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { Parser } = require("m3u8-parser");
const WebSocket = require("ws");
const translate = require("translate");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

// ═══════════════════════════════════════════
// الصفحة الرئيسية - إعدادات الإضافة
// ═══════════════════════════════════════════
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>Kick Addon</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2 style="color:#53fc18;">🟢 إعدادات إضافة Kick</h2>
    <p>أدخل أسماء القنوات (مفصولة بفواصل):</p>
    <textarea id="ch" style="width:300px;height:80px;background:#151a1c;color:#53fc18;padding:10px;border:1px solid #53fc18;border-radius:6px;"></textarea><br><br>
    <button onclick="ins()" style="padding:10px 20px;background:#53fc18;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:6px;">تثبيت في التطبيق</button>
    <script>
      function ins() {
        const v = document.getElementById('ch').value.trim();
        if(!v) return alert('أدخل قناة!');
        const list = v.split(/[,\\s\\n]+/).map(c => c.trim().toLowerCase()).filter(Boolean).join(',');
        window.location.href = 'stremio://' + window.location.host + '/' + btoa(encodeURIComponent(list)) + '/manifest.json';
      }
    </script>
  </body>
  </html>
  `);
});

app.get("/configure", (req, res) => res.redirect("/"));

// ═══════════════════════════════════════════
// دالة مساعدة لفك التشفير
// ═══════════════════════════════════════════
function decodeConfig(config) {
  try {
    return decodeURIComponent(Buffer.from(config, "base64").toString("utf-8"));
  } catch (e) {
    return "";
  }
}

// ═══════════════════════════════════════════
// Manifest - تم تغيير الـ ID إلى v7
// ═══════════════════════════════════════════
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.live.vod.v7",  // ⬅️ تغير من v6 إلى v7
    version: "38.0.0",           // ⬅️ تغير من 37.0.0 إلى 38.0.0
    name: "Kick Live & Replays 🟢",
    description: "بث مباشر وإعادات قنوات Kick",
    logo: "https://kick.com/favicon.ico",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [
      { type: "tv", id: "kick_live_cat", name: "🟢 Kick مباشر" },
      { type: "tv", id: "kick_vod_cat", name: "📼 Kick إعادات" }
    ],
    idPrefixes: ["kick:", "kickvod:"]
  });
});

// ═══════════════════════════════════════════
// Catalog - مباشر
// ═══════════════════════════════════════════
app.get("/:config/catalog/tv/kick_live_cat.json", (req, res) => {
  try {
    const channelsStr = decodeConfig(req.params.config);
    const channels = channelsStr.split(",").filter(Boolean);
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `🔴 مباشر: ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
        description: `البث المباشر لقناة ${c.toUpperCase()}`
      }))
    });
  } catch (e) {
    res.json({ metas: [] });
  }
});

// ═══════════════════════════════════════════
// Catalog - إعادات
// ═══════════════════════════════════════════
app.get("/:config/catalog/tv/kick_vod_cat.json", async (req, res) => {
  try {
    const channelsStr = decodeConfig(req.params.config);
    const channels = channelsStr.split(",").filter(Boolean);
    const allVods = [];

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
      "Referer": "https://kick.com/",
      "Origin": "https://kick.com"
    };

    for (const c of channels) {
      try {
        const vodRes = await axios.get(`https://kick.com/api/v2/channels/${c}/videos`, { headers, timeout: 8000 });
        const vods = Array.isArray(vodRes.data) ? vodRes.data : (vodRes.data?.data || []);
        
        vods.slice(0, 20).forEach(v => {
          const uuid = v.video?.uuid || v.uuid;
          if (!uuid) return;

          const title = v.session_title || "بث سابق";
          const createdAt = v.created_at;
          const durationMs = v.duration || 0;
          const durationMin = Math.round(durationMs / 60000);
          const views = v.views || 0;

          allVods.push({
            id: `kickvod:${c}:${uuid}`,
            type: "tv",
            name: `📼 ${c.toUpperCase()}: ${title.substring(0, 40)}`,
            poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
            description: `⏱ ${durationMin} د | 👁 ${views.toLocaleString()} | 📅 ${createdAt ? new Date(createdAt).toLocaleDateString("ar") : ""}`
          });
        });
      } catch (e) {
        console.error(`VOD fetch failed for ${c}:`, e.message);
      }
    }
    res.json({ metas: allVods });
  } catch (e) {
    res.json({ metas: [] });
  }
});

// ═══════════════════════════════════════════
// Meta
// ═══════════════════════════════════════════
app.get("/:config/meta/tv/kick:channel.json", (req, res) => {
  const c = req.params.channel;
  res.json({
    meta: {
      id: `kick:${c}`,
      type: "tv",
      name: `🔴 ${c.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      description: `البث المباشر لقناة ${c.toUpperCase()}`
    }
  });
});

app.get("/:config/meta/tv/kickvod:channel:uuid.json", (req, res) => {
  const { channel, uuid } = req.params;
  res.json({
    meta: {
      id: `kickvod:${channel}:${uuid}`,
      type: "tv",
      name: `📼 إعادة: ${channel.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${channel}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      description: `إعادة بث لقناة ${channel.toUpperCase()}`
    }
  });
});

// ═══════════════════════════════════════════
// Stream - مباشر
// ═══════════════════════════════════════════
app.get("/:config/stream/tv/kick:channel.json", async (req, res) => {
  const c = req.params.channel.trim().toLowerCase();
  const streams = [];
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://kick.com/",
    "Origin": "https://kick.com"
  };

  try {
    const liveRes = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers, timeout: 8000 });
    const pb = liveRes.data?.playback_url;
    const isLive = liveRes.data?.livestream !== null && liveRes.data?.livestream !== undefined;
    const viewers = liveRes.data?.livestream?.viewer_count || 0;

    if (isLive && pb) {
      try {
        const masterRes = await axios.get(pb, { headers, timeout: 8000 });
        const parser = new Parser();
        parser.push(masterRes.data);
        parser.end();
        const variants = parser.manifest.playlists || [];
        variants.sort((a, b) => (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0));

        variants.forEach((v) => {
          const attrs = v.attributes || {};
          const resolution = attrs.RESOLUTION ? `${attrs.RESOLUTION.height}p` : "غير معروفة";
          const bandwidth = attrs.BANDWIDTH ? `${Math.round(attrs.BANDWIDTH / 1000)} kbps` : "";
          const streamUrl = v.uri ? new URL(v.uri, pb).href : pb;

          streams.push({
            name: `🟢 مباشر | ${resolution}`,
            title: `${bandwidth} | 👁 ${viewers.toLocaleString()} مشاهد`,
            url: streamUrl,
            behaviorHints: {
              notWebReady: true,
              proxyHeaders: { request: { "Referer": "https://kick.com/", "Origin": "https://kick.com" } }
            }
          });
        });
      } catch (e) {
        console.error("m3u8 parse failed:", e.message);
      }
    }
  } catch (e) {
    console.error("Live fetch failed:", e.message);
  }
  res.json({ streams });
});

// ═══════════════════════════════════════════
// Stream - إعادات
// ═══════════════════════════════════════════
app.get("/:config/stream/tv/kickvod:channel:uuid.json", async (req, res) => {
  const { channel, uuid } = req.params;
  const streams = [];
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://kick.com/",
    "Origin": "https://kick.com"
  };

  let vodMaster = null;
  try {
    const vodInfoRes = await axios.get(`https://kick.com/api/v2/video/${uuid}`, { headers, timeout: 8000 });
    vodMaster = vodInfoRes.data?.source || null;
  } catch (e) {
    console.error("Failed to fetch VOD info:", e.message);
  }

  if (!vodMaster) {
    vodMaster = `https://stream.kick.com/${uuid}/media/hls/master.m3u8`;
  }

  try {
    const masterRes = await axios.get(vodMaster, { headers, timeout: 8000 });
    const parser = new Parser();
    parser.push(masterRes.data);
    parser.end();
    const variants = parser.manifest.playlists || [];
    variants.sort((a, b) => (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0));

    if (variants.length > 0) {
      variants.forEach((v) => {
        const attrs = v.attributes || {};
        const resolution = attrs.RESOLUTION ? `${attrs.RESOLUTION.height}p` : "غير معروفة";
        const streamUrl = v.uri ? new URL(v.uri, vodMaster).href : vodMaster;
        streams.push({
          name: `📼 إعادة | ${resolution}`,
          title: `قناة ${channel.toUpperCase()}`,
          url: streamUrl,
          behaviorHints: {
            notWebReady: true,
            proxyHeaders: { request: { "Referer": "https://kick.com/", "Origin": "https://kick.com" } }
          }
        });
      });
    }
  } catch (e) {
    streams.push({
      name: "📼 الإعادة",
      url: vodMaster,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: { request: { "Referer": "https://kick.com/", "Origin": "https://kick.com" } }
      }
    });
  }
  res.json({ streams });
});

// ═══════════════════════════════════════════
// 🌟 صفحة المشاهدة (فيديو + شات + ترجمة)
// ═══════════════════════════════════════════
app.get("/watch/:channel", (req, res) => {
  const channel = req.params.channel.toLowerCase();
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>مشاهدة ${channel} - Kick</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { background:#0b0e0f; color:#fff; font-family:'Segoe UI',sans-serif; height:100vh; display:flex; flex-direction:column; overflow:hidden; }
      .header { background:#151a1c; padding:8px 15px; display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #53fc18; }
      .header h1 { color:#53fc18; font-size:16px; }
      .stats { display:flex; gap:15px; font-size:13px; color:#aaa; }
      .stats span { color:#53fc18; font-weight:bold; }
      .main { display:flex; flex:1; overflow:hidden; }
      .video-section { flex:2; background:#000; display:flex; flex-direction:column; }
      video { width:100%; height:100%; background:#000; }
      .chat-section { flex:1; background:#151a1c; display:flex; flex-direction:column; border-right:1px solid #333; min-width:280px; }
      .chat-header { padding:8px; background:#0b0e0f; border-bottom:1px solid #333; font-size:13px; color:#53fc18; text-align:center; }
      .chat-messages { flex:1; overflow-y:auto; padding:8px; font-size:13px; line-height:1.5; }
      .chat-message { margin-bottom:6px; padding:4px 8px; background:#1c2327; border-radius:6px; border-right:3px solid #53fc18; }
      .chat-user { color:#53fc18; font-weight:bold; font-size:11px; }
      .chat-text { color:#eee; margin-top:2px; font-size:12px; }
      .chat-text .translated { color:#ffd700; font-style:italic; display:block; margin-top:2px; font-size:11px; }
      .controls { padding:8px; background:#0b0e0f; display:flex; gap:8px; justify-content:center; align-items:center; }
      .controls select, .controls button { padding:5px 10px; background:#1c2327; color:#53fc18; border:1px solid #53fc18; border-radius:4px; cursor:pointer; font-size:12px; }
      @media (max-width:768px) {
        .main { flex-direction:column; }
        .video-section { flex:1; }
        .chat-section { flex:1; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>🟢 ${channel.toUpperCase()}</h1>
      <div class="stats">
        <div>👁 <span id="viewers">0</span></div>
        <div>💬 <span id="msgCount">0</span></div>
      </div>
    </div>
    <div class="main">
      <div class="video-section">
        <video id="player" controls autoplay></video>
        <div class="controls">
          <select id="qualitySelect"><option value="">الجودة التلقائية</option></select>
          <button onclick="toggleTranslate()" id="transBtn">🌐 الترجمة: تشغيل</button>
        </div>
      </div>
      <div class="chat-section">
        <div class="chat-header">💬 الشات المترجم</div>
        <div class="chat-messages" id="chatMessages"></div>
      </div>
    </div>
    <script>
      let translateEnabled = true;
      let msgCount = 0;
      const chatMessages = document.getElementById('chatMessages');
      const player = document.getElementById('player');
      const qualitySelect = document.getElementById('qualitySelect');
      const viewersSpan = document.getElementById('viewers');
      const msgCountSpan = document.getElementById('msgCount');

      fetch('/api/stream/${channel}')
        .then(r => r.json())
        .then(d => {
          if (d.playback_url) player.src = d.playback_url;
          if (d.viewers) viewersSpan.textContent = d.viewers.toLocaleString();
        });

      fetch('/api/qualities/${channel}')
        .then(r => r.json())
        .then(d => {
          if (d.qualities) d.qualities.forEach(q => {
            const opt = document.createElement('option');
            opt.value = q.url; opt.textContent = q.label;
            qualitySelect.appendChild(opt);
          });
        });

      qualitySelect.addEventListener('change', e => {
        if (e.target.value) { player.src = e.target.value; player.play(); }
      });

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(protocol + '//' + window.location.host + '/chat/${channel}');

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'message') {
            msgCount++;
            msgCountSpan.textContent = msgCount;
            const user = data.sender?.username || 'مجهول';
            const text = data.content || '';
            let translatedText = '';
            if (translateEnabled && text) {
              try { translatedText = await translate(text, { from: 'auto', to: 'ar' }); } catch(e) {}
            }
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-message';
            msgDiv.innerHTML = \`<div class="chat-user">\${user}</div><div class="chat-text">\${text}\${translatedText && translatedText !== text ? '<span class="translated">🔤 '+translatedText+'</span>' : ''}</div>\`;
            chatMessages.appendChild(msgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            while (chatMessages.children.length > 100) chatMessages.removeChild(chatMessages.firstChild);
          }
        } catch(e) {}
      };

      function toggleTranslate() {
        translateEnabled = !translateEnabled;
        document.getElementById('transBtn').textContent = '🌐 الترجمة: ' + (translateEnabled ? 'تشغيل' : 'إيقاف');
      }
    </script>
  </body>
  </html>
  `);
});

// ═══════════════════════════════════════════
// API - البث
// ═══════════════════════════════════════════
app.get("/api/stream/:channel", async (req, res) => {
  const c = req.params.channel.toLowerCase();
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://kick.com/",
    "Origin": "https://kick.com"
  };
  try {
    const liveRes = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers, timeout: 8000 });
    res.json({
      playback_url: liveRes.data?.playback_url || null,
      viewers: liveRes.data?.livestream?.viewer_count || 0
    });
  } catch (e) {
    res.json({ playback_url: null, viewers: 0 });
  }
});

// ═══════════════════════════════════════════
// API - الجودات
// ═══════════════════════════════════════════
app.get("/api/qualities/:channel", async (req, res) => {
  const c = req.params.channel.toLowerCase();
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://kick.com/",
    "Origin": "https://kick.com"
  };
  try {
    const liveRes = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers, timeout: 8000 });
    const pb = liveRes.data?.playback_url;
    if (!pb) return res.json({ qualities: [] });
    const masterRes = await axios.get(pb, { headers, timeout: 8000 });
    const parser = new Parser();
    parser.push(masterRes.data);
    parser.end();
    const variants = parser.manifest.playlists || [];
    variants.sort((a, b) => (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0));
    const qualities = variants.map(v => ({
      label: v.attributes?.RESOLUTION ? `${v.attributes.RESOLUTION.height}p` : 'غير معروفة',
      url: v.uri ? new URL(v.uri, pb).href : pb
    }));
    res.json({ qualities });
  } catch (e) {
    res.json({ qualities: [] });
  }
});

// ═══════════════════════════════════════════
// WebSocket - الشات
// ═══════════════════════════════════════════
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server, path: '/chat' });

wss.on('connection', (ws, req) => {
  const channel = req.url.split('/').pop().toLowerCase();
  const kickWs = new WebSocket(`wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false`);

  kickWs.on('open', () => {
    kickWs.send(JSON.stringify({
      event: 'pusher:subscribe',
      data: { channel: `chatrooms.${channel}.v2` }
    }));
  });

  kickWs.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.event === 'App\\Events\\ChatMessageEvent') {
        const msgData = JSON.parse(parsed.data);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'message',
            sender: msgData.sender,
            content: msgData.content
          }));
        }
      }
    } catch (e) {}
  });

  kickWs.on('error', (err) => console.error('Kick WS error:', err.message));
  ws.on('close', () => kickWs.close());
});

// ═══════════════════════════════════════════
// تشغيل السيرفر
// ═══════════════════════════════════════════
server.listen(PORT, () => {
  console.log(`🟢 Kick Addon running on port ${PORT}`);
});
