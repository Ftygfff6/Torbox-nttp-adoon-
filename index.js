const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

// الهيدرز لتجاوز الحظر
const KICK_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
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
    version: "1.6.0",
    name: "Kick - متابعاتك",
    description: "بثوث وإعادات قنوات Kick المتابعة",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: "kick_following",
        name: "Kick - قنواتك المتابعة"
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
   5. Stream Handler (مباشر + إعادات VOD)
------------------------- */
app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("kick:")) return res.json({ streams: [] });

  const channelName = id.replace("kick:", "").trim().toLowerCase();
  const streams = [];

  try {
    const channelPromise = axios.get(`https://kick.com/api/v2/channels/${channelName}`, {
      headers: KICK_HEADERS,
      timeout: 4000
    }).catch(() => null);

    const vodsPromise = axios.get(`https://kick.com/api/v1/channels/${channelName}/videos`, {
      headers: KICK_HEADERS,
      timeout: 4000
    }).catch(() => null);

    const [channelRes, vodsRes] = await Promise.all([channelPromise, vodsPromise]);

    // البث المباشر
    if (channelRes?.data?.livestream && channelRes.data.playback_url) {
      streams.push({
        name: "[🟢 KICK LIVE]",
        title: `مباشر الان: ${channelRes.data.livestream.session_title || 'بث مباشر'}\n👁️ المشاهدين: ${channelRes.data.livestream.viewer_count || 0}`,
        url: channelRes.data.playback_url
      });
    }

    // الإعادات المسجلة
    let vodsList = [];
    if (Array.isArray(vodsRes?.data)) {
      vodsList = vodsRes.data;
    } else if (channelRes?.data?.previous_livestreams) {
      vodsList = channelRes.data.previous_livestreams;
    }

    if (vodsList.length > 0) {
      vodsList.slice(0, 5).forEach((vod, idx) => {
        const vodTitle = vod.session_title || vod.title || `إعادة رقم ${idx + 1}`;
        const vodDate = vod.created_at ? vod.created_at.split('T')[0] : '';
        let playUrl = vod.source || vod.video?.video_url;

        if (playUrl && playUrl.endsWith('.m3u8')) {
          streams.push({
            name: `[🎬 REPLAY ${idx + 1}]`,
            title: `إعادة: ${vodTitle}\n📅 ${vodDate}`,
            url: playUrl
          });
        } else if (vod.slug || vod.id) {
          const vodSlug = vod.slug || vod.id;
          streams.push({
            name: `[🎬 REPLAY ${idx + 1}]`,
            title: `إعادة: ${vodTitle}\n📅 ${vodDate}`,
            externalUrl: `https://kick.com/${channelName}?video=${vodSlug}`
          });
        }
      });
    }

    if (streams.length === 0) {
      streams.push({
        name: "[🔗 KICK WEB]",
        title: `فتح أرشيف قناة ${channelName} على موقع Kick`,
        externalUrl: `https://kick.com/${channelName}/videos`
      });
    }

    return res.json({ streams });

  } catch (error) {
    console.error(`Error loading streams for ${channelName}:`, error.message);
    return res.json({
      streams: [{
        name: "[🔗 KICK WEB]",
        title: `فتح قناة ${channelName} في المتصفح`,
        externalUrl: `https://kick.com/${channelName}`
      }]
    });
  }
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
