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
    <title>إعدادات إضافة YouTube Streamer</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0d0d0f; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #16161a; padding: 30px; border-radius: 16px; width: 90%; max-width: 460px; border: 1px solid #282830; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.6); }
      h2 { color: #ff0000; margin-bottom: 8px; font-size: 22px; }
      p { font-size: 13px; color: #aaa; margin-bottom: 20px; line-height: 1.5; }
      .input-group { text-align: right; margin-bottom: 15px; }
      label { font-size: 13px; color: #ccc; display: block; margin-bottom: 6px; }
      textarea { width: 100%; padding: 12px; background: #0d0d0f; border: 1px solid #333; color: #00ff66; border-radius: 8px; box-sizing: border-box; resize: vertical; min-height: 100px; font-family: monospace; font-size: 14px; direction: ltr; }
      button { width: 100%; padding: 14px; background: #ff0000; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; }
      button:hover { background: #cc0000; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🎬 YouTube Native Player</h2>
      <p>أدخل معرفات القنوات (Usernames / Handles) مفصولة بفواصل:</p>
      
      <div class="input-group">
        <label>أسماء القنوات (Handles):</label>
        <textarea id="channels" placeholder="abuabeer16, AboFlah, BanderitaX"></textarea>
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
          .map(c => c.trim().replace(/^@/, ''))
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
    id: "org.youtube.stremio.native",
    version: "4.0.0",
    name: "YouTube Native - صوت وصورة",
    description: "تشغيل مقاطع يوتيوب كاملة بالصوت والصورة مباشرة داخل مشغل Stremio",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    catalogs: [
      {
        type: "series",
        id: "yt_native_catalog",
        name: "🔴 YouTube Channels"
      }
    ],
    idPrefixes: ["ytnative:"]
  });
});

/* -------------------------
   3. Catalog
------------------------- */
app.get("/:config/catalog/series/yt_native_catalog.json", (req, res) => {
  const { config } = req.params;
  try {
    const rawChannels = decodeURIComponent(Buffer.from(config, 'base64').toString('utf-8'));
    const channelArray = rawChannels.split(',').map(c => c.trim()).filter(Boolean);

    const metas = channelArray.map(channel => ({
      id: `ytnative:${channel}`,
      type: "series",
      name: `@${channel}`,
      poster: `https://ui-avatars.com/api/?name=${channel}&background=0D0E12&color=FF0000&size=512&bold=true`,
      description: `تشغيل مقاطع ${channel} مباشرة داخل Stremio مع الصوت`
    }));

    res.json({ metas });
  } catch (e) {
    res.json({ metas: [] });
  }
});

/* -------------------------
   4. Meta
------------------------- */
app.get("/:config/meta/series/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("ytnative:")) return res.json({ meta: {} });

  const channelHandle = id.replace("ytnative:", "").trim();

  return res.json({
    meta: {
      id: `ytnative:${channelHandle}`,
      type: "series",
      name: `@${channelHandle}`,
      poster: `https://ui-avatars.com/api/?name=${channelHandle}&background=0D0E12&color=FF0000&size=512&bold=true`,
      background: `https://ui-avatars.com/api/?name=${channelHandle}&background=141414&color=FF0000&size=1024&bold=true`,
      description: `اختر المقطع للتشغيل المباشر داخل مشغل Stremio`
    }
  });
});

/* -------------------------
   5. Stream Handler (روابط Invidious / Piped المباشرة بالصوت والصورة)
------------------------- */
app.get("/:config/stream/series/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("ytnative:")) return res.json({ streams: [] });

  const channelHandle = id.replace("ytnative:", "").trim();

  try {
    // جلب أحدث فيديو عبر RSS Feed
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?user=${channelHandle}`;
    const response = await axios.get(rssUrl);
    
    const videoIdMatch = response.data.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
    const videoTitleMatch = response.data.match(/<title>(.*?)<\/title>/g);

    if (!videoIdMatch || !videoIdMatch[1]) {
      return res.json({ streams: [] });
    }

    const videoId = videoIdMatch[1];
    const title = videoTitleMatch && videoTitleMatch[1] 
      ? videoTitleMatch[1].replace(/<\/?title>/g, '') 
      : `@${channelHandle}`;

    // توجيه المشغل عبر Invidious Proxy Stream الذي يدمج الصوت والصورة تلقائياً بدقة عالية
    const streamUrl = `https://invidious.drgns.space/latest_version?id=${videoId}&italic=0&v=mp4&quality=1080p`;

    return res.json({
      streams: [
        {
          name: "🔴 [STREMIO 1080p / 4K]",
          title: `${title}\n(تشغيل مباشر داخل التطبيق - صوت وصورة)`,
          url: streamUrl,
          behaviorHints: {
            notSupported: false
          }
        }
      ]
    });
  } catch (error) {
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
  console.log(`🚀 YouTube Native Server running on port ${PORT}`);
});
