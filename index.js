const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

const KICK_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://kick.com/"
};

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
    <title>إعدادات إضافة Kick</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0f0f11; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1a1a1e; padding: 30px; border-radius: 16px; width: 90%; max-width: 440px; border: 1px solid #2a2a30; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
      h2 { color: #53fc18; margin-bottom: 8px; font-size: 22px; }
      p { font-size: 13px; color: #aaa; margin-bottom: 20px; line-height: 1.5; }
      .input-group { text-align: right; margin-bottom: 15px; }
      label { font-size: 13px; color: #ccc; display: block; margin-bottom: 6px; }
      textarea { width: 100%; padding: 12px; background: #0f0f11; border: 1px solid #333; color: #fff; border-radius: 8px; box-sizing: border-box; resize: vertical; min-height: 80px; font-family: inherit; }
      button { width: 100%; padding: 14px; background: #53fc18; border: none; color: #000; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; }
      button:hover { background: #42cb12; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🟢 Kick Stremio Config</h2>
      <p>أدخل أسماء القنوات مفصولة بفواصل أو مسافات:</p>
      
      <div class="input-group">
        <label>أسماء القنوات (Usernames):</label>
        <textarea id="channels" placeholder="playaway, we11y, abu_abeer16"></textarea>
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
          .split(/[\\s,\\n]+/)
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
   2. Manifest
------------------------- */
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.custom.following",
    version: "1.7.0",
    name: "Kick - متابعاتك",
    description: "بثوث وإعادات قنوات Kick المتابعة",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: "kick_following",
        name: "Kick - متابعاتك"
      }
    ],
    idPrefixes: ["kick:"]
  });
});

/* -------------------------
   3. الكتالوج (Catalog)
------------------------- */
app.get("/:config/catalog/tv/kick_following.json", (req, res) => {
  const { config } = req.params;
  try {
    const rawChannels = decodeURIComponent(Buffer.from(config, 'base64').toString('utf-8'));
    const channelArray = rawChannels.split(',').map(c => c.trim()).filter(Boolean);

    const metas = channelArray.map(channel => ({
      id: `kick:${channel}`,
      type: "tv",
      name: channel.toUpperCase(),
      poster: `https://ui-avatars.com/api/?name=${channel}&background=0D0E12&color=53FC18&size=512&bold=true`,
      description: `قناة ${channel} على Kick`
    }));

    res.json({ metas });
  } catch (e) {
    res.json({ metas: [] });
  }
});

/* -------------------------
   4. Meta Handler
------------------------- */
app.get("/:config/meta/tv/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("kick:")) return res.json({ meta: {} });

  const channelName = id.replace("kick:", "").trim().toLowerCase();

  return res.json({
    meta: {
      id: `kick:${channelName}`,
      type: "tv",
      name: channelName.toUpperCase(),
      poster: `https://ui-avatars.com/api/?name=${channelName}&background=0D0E12&color=53FC18&size=512&bold=true`,
      background: `https://ui-avatars.com/api/?name=${channelName}&background=0D0E12&color=53FC18&size=1024&bold=true`,
      description: `شاهد البث المباشر والإعادات لقناة ${channelName}`
    }
  });
});

/* -------------------------
   5. Stream Handler (استخراج رابط التشغيل المباشر داخل Stremio)
------------------------- */
app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("kick:")) return res.json({ streams: [] });

  const channelName = id.replace("kick:", "").trim().toLowerCase();
  const streams = [];

  try {
    // استخدام بروكسي لتجاوز الحظر وتلقي بيانات القناة والإعادات
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://kick.com/api/v2/channels/${channelName}`)}`;
    const response = await axios.get(proxyUrl, { timeout: 6000 });
    
    if (response.data && response.data.contents) {
      const channelData = JSON.parse(response.data.contents);

      // 1. المباشر
      if (channelData.livestream && channelData.playback_url) {
        streams.push({
          name: "[🟢 KICK LIVE]",
          title: `مباشر الان: ${channelData.livestream.session_title || 'بث مباشر'}`,
          url: channelData.playback_url
        });
      }

      // 2. الإعادات (VODs)
      if (channelData.previous_livestreams && channelData.previous_livestreams.length > 0) {
        channelData.previous_livestreams.slice(0, 5).forEach((vod, index) => {
          let streamUrl = vod.video?.video_url;
          
          if (streamUrl) {
            streams.push({
              name: `[🎬 REPLAY ${index + 1}]`,
              title: `إعادة: ${vod.session_title || 'بث سابق'}\n📅 ${vod.created_at ? vod.created_at.split('T')[0] : ''}`,
              url: streamUrl
            });
          }
        });
      }
    }
  } catch (err) {
    console.error("Proxy fetch error:", err.message);
  }

  // رابط طوارئ بديل في حال انقطاع البروكسي
  if (streams.length === 0) {
    streams.push({
      name: "[🔴 KICK OFFLINE]",
      title: "لا توجد إعادات متاحة حالياً أو القناة أوفلاين",
      url: `https://stream.kick.com/play/${channelName}.m3u8`
    });
  }

  return res.json({ streams });
});

/* -------------------------
   6. تشغيل الخادم
------------------------- */
app.use((req, res) => {
  res.status(200).json({ streams: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
