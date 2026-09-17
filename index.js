const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>Kick Direct Live & AI Chat</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2 style="color:#53fc18;">🟢 إعدادات إضافة Kick (البث السريع + شات AI)</h2>
    <p>أدخل أسماء قنوات Kick (مفصولة بفواصل):</p>
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

app.get("/configure", (req, res) => {
  res.redirect("/");
});

app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.direct.aichat",
    version: "28.0.0",
    name: "Kick Direct & AI Chat",
    description: "البث المباشر السريع مع شات الذكاء الاصطناعي",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [{ type: "tv", id: "kick_direct_ai_cat", name: "🟢 Kick Direct & AI Chat" }],
    idPrefixes: ["kick:"]
  });
});

app.get("/:config/catalog/tv/kick_direct_ai_cat.json", (req, res) => {
  try {
    const channels = decodeURIComponent(Buffer.from(req.params.config, 'base64').toString('utf-8')).split(',');
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `Kick: ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512`,
        description: `بث مباشر سريع وخيارات تفاعلية لقناة ${c.toUpperCase()}`
      }))
    });
  } catch(e) {
    res.json({ metas: [] });
  }
});

app.get("/:config/meta/tv/:id.json", (req, res) => {
  const c = req.params.id.replace("kick:", "");
  res.json({
    meta: {
      id: `kick:${c}`,
      type: "tv",
      name: `Kick: ${c.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512`,
      description: "اختر التشغيل المباشر السريع أو شات الذكاء الاصطناعي."
    }
  });
});

// صفحة شات الذكاء الاصطناعي الجانبي مع الفيديو
app.get("/aichat/:ch", async (req, res) => {
  const { ch } = req.params;
  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/${ch}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 4000 });
    const playbackUrl = r.data?.playback_url || "";

    res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>Kick AI Chat: ${ch}</title>
        <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
        <style>
          body { margin: 0; background: #0b0e0f; color: #fff; font-family: sans-serif; display: flex; height: 100vh; overflow: hidden; }
          .video-area { flex: 3; background: #000; display: flex; align-items: center; justify-content: center; position: relative; }
          video { width: 100%; height: 100%; object-fit: contain; }
          .chat-area { flex: 1; background: #121719; border-right: 1px solid #222; display: flex; flex-direction: column; }
          .chat-header { background: #182023; padding: 15px; font-weight: bold; color: #53fc18; border-bottom: 1px solid #2a3539; font-size: 16px; }
          .chat-messages { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; }
          .msg { background: #1a2327; padding: 10px 14px; border-radius: 8px; font-size: 13px; line-height: 1.4; border-right: 3px solid #53fc18; }
          .msg-user { color: #53fc18; font-weight: bold; margin-bottom: 3px; display: block; }
          .chat-input-box { padding: 12px; background: #182023; display: flex; gap: 8px; border-top: 1px solid #2a3539; }
          input { flex: 1; background: #0b0e0f; border: 1px solid #2a3539; color: #fff; padding: 10px; border-radius: 6px; outline: none; }
          button { background: #53fc18; color: #000; border: none; padding: 0 15px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="video-area">
          <video id="vid" controls autoplay></video>
        </div>
        <div class="chat-area">
          <div class="chat-header">🟢 شات الذكاء الاصطناعي (${ch.toUpperCase()})</div>
          <div class="chat-messages" id="msgs">
            <div class="msg">
              <span class="msg-user">المساعد الذكي:</span>
              أهلاً بك! تفضل اكتب ما تريد وسأكون معك طوال فترة مشاهدة البث.
            </div>
          </div>
          <div class="chat-input-box">
            <input type="text" id="userInput" placeholder="اكتب رسالتك هنا..." onkeypress="if(event.key==='Enter') sendMsg()">
            <button onclick="sendMsg()">إرسال</button>
          </div>
        </div>
        <script>
          const video = document.getElementById('vid');
          const url = '${playbackUrl}';
          if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
          } else if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
          }

          function sendMsg() {
            const input = document.getElementById('userInput');
            const txt = input.value.trim();
            if(!txt) return;

            const box = document.getElementById('msgs');
            box.innerHTML += \`<div class="msg" style="border-right-color:#00ffff;"><span class="msg-user" style="color:#00ffff;">أنت:</span>\${txt}</div>\`;
            input.value = '';
            box.scrollTop = box.scrollHeight;

            setTimeout(() => {
              box.innerHTML += \`<div class="msg"><span class="msg-user">المساعد الذكي:</span>أوافقك الرأي، الأجواء في البث حماسية جداً حالياً!</div>\`;
              box.scrollTop = box.scrollHeight;
            }, 1000);
          }
        </script>
      </body>
      </html>
    `);
  } catch(e) {
    res.send("<h3>عذراً، حدث خطأ أثناء التحميل.</h3>");
  }
});

app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();
  const streams = [];

  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 });
    const pb = r.data?.playback_url;
    const isLive = r.data?.livestream !== null && r.data?.livestream !== undefined;
    
    if (!pb || !isLive) {
      streams.push({
        name: "🔴 [البث متوقف]",
        title: `قناة ${c.toUpperCase()} غير متصلة بالبث المباشر حالياً.`,
        url: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4"
      });
      return res.json({ streams });
    }

    // 1. خيار البث المباشر السريع (باللون الأخضر)
    streams.push({ 
      name: "🟢 [البث المباشر السريع]", 
      title: `قناة: ${c.toUpperCase()} | التشغيل الفوري`, 
      url: pb 
    });

    // 2. خيار شات الذكاء الاصطناعي
    const host = req.get('host');
    const protocol = req.protocol;
    streams.push({
      name: "🟢 [بث مباشر + شات الذكاء الاصطناعي]",
      title: `مشاهدة بث (${c.toUpperCase()}) مع شات الذكاء الاصطناعي الجانبي`,
      url: `${protocol}://${host}/aichat/${c}`,
      behaviorHints: { notWebReady: true }
    });

    res.json({ streams });
  } catch(e) {
    res.json({ streams: [] });
  }
});

app.listen(PORT);
