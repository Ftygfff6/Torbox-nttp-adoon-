const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

/* -------------------------
   1. صفحة الإعدادات
------------------------- */
app.get(["/", "/configure"], (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kick Live Subtitle Chat</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0b0e0f; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #151a1c; padding: 30px; border-radius: 16px; width: 90%; max-width: 460px; border: 1px solid #232b2e; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.6); }
      h2 { color: #53fc18; margin-bottom: 8px; font-size: 22px; }
      p { font-size: 13px; color: #aaa; margin-bottom: 20px; line-height: 1.5; }
      .input-group { text-align: right; margin-bottom: 15px; }
      label { font-size: 13px; color: #ccc; display: block; margin-bottom: 6px; }
      textarea { width: 100%; padding: 12px; background: #0b0e0f; border: 1px solid #333; color: #53fc18; border-radius: 8px; box-sizing: border-box; resize: vertical; min-height: 100px; font-family: monospace; font-size: 14px; direction: ltr; }
      button { width: 100%; padding: 14px; background: #53fc18; border: none; color: #000; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; }
      button:hover { background: #42cb12; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>💬 Kick Live Subtitle Chat</h2>
      <p>أدخل أسماء قنوات Kick (Usernames) مفصولة بفواصل:</p>
      
      <div class="input-group">
        <label>أسماء القنوات (Usernames):</label>
        <textarea id="channels" placeholder="bo3omar22, abu_abeer, streamer_name"></textarea>
      </div>

      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const input = document.getElementById('channels').value.trim();
        if (!input) {
          alert("يرجى كتابة اسم قناة واحدة على الأقل!");
          return;
        }
        
        const channelsList = input
          .split(/[,\\s\\n]+/)
          .map(c => c.trim().toLowerCase())
          .filter(Boolean)
          .join(',');

        const encodedConfig = btoa(encodeURIComponent(channelsList));
        const manifestUrl = window.location.origin + '/' + encodedConfig + '/manifest.json';
        window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

/* -------------------------
   2. Manifest (تفعيل مصدر الترجمات)
------------------------- */
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.live.subchat",
    version: "4.0.0",
    name: "Kick Live + Subtitle Chat",
    description: "عرض شات بث Kick المباشر كترجمة نصية داخل المشغل",
    resources: ["catalog", "meta", "stream", "subtitles"],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: "kick_sub_catalog",
        name: "🟢 Kick - البث والترجمة"
      }
    ],
    idPrefixes: ["kick:"]
  });
});

/* -------------------------
   3. Catalog & Meta
------------------------- */
app.get("/:config/catalog/tv/kick_sub_catalog.json", (req, res) => {
  const { config } = req.params;
  try {
    const rawChannels = decodeURIComponent(Buffer.from(config, 'base64').toString('utf-8'));
    const channelArray = rawChannels.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);

    const metas = channelArray.map(channel => ({
      id: `kick:${channel}`,
      type: "tv",
      name: `Kick: ${channel}`,
      poster: `https://ui-avatars.com/api/?name=${channel}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      description: `شغّل البث وستجد الشات داخل قائمة الترجمات Subtitles`
    }));

    res.json({ metas });
  } catch (e) {
    res.json({ metas: [] });
  }
});

app.get("/:config/meta/tv/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("kick:")) return res.json({ meta: {} });

  const channelSlug = id.replace("kick:", "").trim().toLowerCase();

  return res.json({
    meta: {
      id: `kick:${channelSlug}`,
      type: "tv",
      name: `Kick: ${channelSlug}`,
      poster: `https://ui-avatars.com/api/?name=${channelSlug}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      background: `https://ui-avatars.com/api/?name=${channelSlug}&background=151A1C&color=53FC18&size=1024&bold=true`,
      description: `اختر الجودة للتشغيل، ثم فعّل الترجمة من قائمة الترجمات لرؤية الشات.`
    }
  });
});

/* -------------------------
   4. Stream Handler (إضافة خيار الترجمة إلى البث)
------------------------- */
app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("kick:")) return res.json({ streams: [] });

  const channelSlug = id.replace("kick:", "").trim().toLowerCase();
  const host = req.get('host');
  const protocol = req.protocol;

  try {
    const response = await axios.get(`https://kick.com/api/v2/channels/${channelSlug}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      },
      timeout: 5000
    });

    const channelData = response.data;

    if (channelData && channelData.playback_url) {
      const masterPlaylistUrl = channelData.playback_url;
      const subtitleUrl = `${protocol}://${host}/chat-sub/${channelSlug}.vtt`;

      return res.json({
        streams: [
          {
            name: "🟢 [KICK LIVE + CHAT]",
            title: `بث مباشر مع دعم الشات كترجمة\n(فعّل الترجمة أثناء الفيديو)`,
            url: masterPlaylistUrl,
            subtitles: [
              {
                id: "kick_chat_sub",
                url: subtitleUrl,
                lang: "ara"
              }
            ]
          }
        ]
      });
    }

    return res.json({ streams: [] });
  } catch (error) {
    res.json({ streams: [] });
  }
});

/* -------------------------
   5. Subtitles Resource Endpoint (المصدر المستقل للترجمة)
------------------------- */
app.get("/:config/subtitles/tv/:id.json", (req, res) => {
  const { id } = req.params;
  const channelSlug = id.replace("kick:", "").trim().toLowerCase();
  const host = req.get('host');
  const protocol = req.protocol;

  res.json({
    subtitles: [
      {
        id: "kick_chat_sub",
        url: `${protocol}://${host}/chat-sub/${channelSlug}.vtt`,
        lang: "💬 Kick Chat"
      }
    ]
  });
});

/* -------------------------
   6. Live Chat VTT Generator (توليد ملف الترجمة الحية للشات)
------------------------- */
app.get("/chat-sub/:channel.vtt", async (req, res) => {
  const channelSlug = req.params.channel.toLowerCase();

  try {
    // 1. جلب ID غرفة الشات
    const channelRes = await axios.get(`https://kick.com/api/v2/channels/${channelSlug}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 3000
    });
    
    const chatroomId = channelRes.data?.chatroom?.id;
    let chatLines = ["💬 جاري تحميل الشات..."];

    if (chatroomId) {
      const chatRes = await axios.get(`https://kick.com/api/v2/chatrooms/${chatroomId}/messages`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 3000
      });

      const messages = chatRes.data?.data?.messages || [];
      if (messages.length > 0) {
        chatLines = messages.slice(-5).map(m => `${m.sender.username}: ${m.content}`);
      }
    }

    // 2. توليد صيغة WebVTT ممتدة لعدة ساعات لتبقي الشات معروضاً أسفل الشاشة
    const vttContent = `WEBVTT

00:00:00.000 --> 99:59:59.000
${chatLines.join("\n")}
`;

    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.send(vttContent);

  } catch (e) {
    const fallbackVtt = `WEBVTT

00:00:00.000 --> 99:59:59.000
💬 يتعذر جلب الشات حالياً
`;
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.send(fallbackVtt);
  }
});

/* -------------------------
   7. تشغيل الخادم
------------------------- */
app.use((req, res) => {
  res.status(200).json({ streams: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 Kick Addon with Live Subtitle Chat running on port ${PORT}`);
});
