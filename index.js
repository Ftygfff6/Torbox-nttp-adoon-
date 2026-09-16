const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

/* -------------------------
   1. صفحة الإعدادات (Configure)
------------------------- */
app.get(["/", "/configure"], (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعدادات إضافة Kick Live Streamer</title>
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
      <h2>🟢 Kick Live Streamer</h2>
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
   2. Manifest
------------------------- */
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.live.streamer",
    version: "1.0.0",
    name: "Kick Live Streams",
    description: "متابعة وتحديث البث المباشر لقنوات Kick داخل Stremio",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: "kick_live_catalog",
        name: "🟢 Kick - البث المباشر"
      }
    ],
    idPrefixes: ["kick:"]
  });
});

/* -------------------------
   3. Catalog
------------------------- */
app.get("/:config/catalog/tv/kick_live_catalog.json", (req, res) => {
  const { config } = req.params;
  try {
    const rawChannels = decodeURIComponent(Buffer.from(config, 'base64').toString('utf-8'));
    const channelArray = rawChannels.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);

    const metas = channelArray.map(channel => ({
      id: `kick:${channel}`,
      type: "tv",
      name: `Kick: ${channel}`,
      poster: `https://ui-avatars.com/api/?name=${channel}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      description: `بث مباشر لقناة ${channel} على منصة Kick`
    }));

    res.json({ metas });
  } catch (e) {
    res.json({ metas: [] });
  }
});

/* -------------------------
   4. Meta
------------------------- */
app.get("/:config/meta/tv/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("kick:")) return res.json({ meta: {} });

  const channelSlug = id.replace("kick:", "").trim().toLowerCase();

  return res.json({
    meta: {
      id: `kick:${channelSlug}`,
      type: "tv",
      name: `Kick Channel: ${channelSlug}`,
      poster: `https://ui-avatars.com/api/?name=${channelSlug}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      background: `https://ui-avatars.com/api/?name=${channelSlug}&background=151A1C&color=53FC18&size=1024&bold=true`,
      description: `صفحة البث المباشر للقناة ${channelSlug}`
    }
  });
});

/* -------------------------
   5. Stream Handler (سحب رابط البث المباشر HLS)
------------------------- */
app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("kick:")) return res.json({ streams: [] });

  const channelSlug = id.replace("kick:", "").trim().toLowerCase();

  try {
    // الاستعلام عن بيانات القناة والبث المباشر عبر Kick API
    const response = await axios.get(`https://kick.com/api/v2/channels/${channelSlug}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      },
      timeout: 5000
    });

    const channelData = response.data;

    if (channelData && channelData.playback_url) {
      const isLive = channelData.livestream !== null;
      const streamTitle = isLive ? channelData.livestream.session_title : "القناة أوفلاين حالياً";

      return res.json({
        streams: [
          {
            name: "🟢 [KICK LIVE]",
            title: `${channelSlug.toUpperCase()}\n${streamTitle}`,
            url: channelData.playback_url
          }
        ]
      });
    }

    return res.json({ streams: [] });
  } catch (error) {
    console.error("Kick Fetch Error:", error.message);
    res.json({ streams: [] });
  }
});

/* -------------------------
   6. تشغيل الخادم
------------------------- */
app.use((req, res) => {
  res.status(200).json({ streams: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 Kick Live Addon running on port ${PORT}`);
});
