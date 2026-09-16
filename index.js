const express = require("express");
const cors = require("cors");

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
    <title>إعدادات إضافة YouTube 4K</title>
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
      <h2>🔴 YouTube 4K Addon</h2>
      <p>أدخل معرفات القنوات (Usernames / Handles) مفصولة بفواصل أو مسافات:</p>
      
      <div class="input-group">
        <label>أسماء القنوات:</label>
        <textarea id="channels" placeholder="AboFlah, BanderitaX, TEAMFALCONS"></textarea>
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
    id: "org.youtube.hd.addon",
    version: "1.0.0",
    name: "YouTube 4K - قنواتك",
    description: "تشغيل أحدث مقاطع قنوات يوتيوب بأعلى جودة 4K / 1080p",
    resources: ["catalog", "meta", "stream"],
    types: ["series"],
    catalogs: [
      {
        type: "series",
        id: "yt_hd_catalog",
        name: "🔴 YOUTUBE 4K / HD"
      }
    ],
    idPrefixes: ["ythd:"]
  });
});

/* -------------------------
   3. Catalog (عرض القنوات)
------------------------- */
app.get("/:config/catalog/series/yt_hd_catalog.json", (req, res) => {
  const { config } = req.params;
  try {
    const rawChannels = decodeURIComponent(Buffer.from(config, 'base64').toString('utf-8'));
    const channelArray = rawChannels.split(',').map(c => c.trim()).filter(Boolean);

    const metas = channelArray.map(channel => ({
      id: `ythd:${channel}`,
      type: "series",
      name: `@ ${channel.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${channel}&background=0D0E12&color=FF0000&size=512&bold=true`,
      description: `قناة ${channel} - مقاطع بجودة عالية 4K`
    }));

    res.json({ metas });
  } catch (e) {
    res.json({ metas: [] });
  }
});

/* -------------------------
   4. Meta Handler
------------------------- */
app.get("/:config/meta/series/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("ythd:")) return res.json({ meta: {} });

  const channelHandle = id.replace("ythd:", "").trim();

  return res.json({
    meta: {
      id: `ythd:${channelHandle}`,
      type: "series",
      name: `@ ${channelHandle.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${channelHandle}&background=0D0E12&color=FF0000&size=512&bold=true`,
      background: `https://ui-avatars.com/api/?name=${channelHandle}&background=141414&color=FF0000&size=1024&bold=true`,
      description: `تصفح أحدث مقاطع قناة @ ${channelHandle}`
    }
  });
});

/* -------------------------
   5. Stream Handler (روابط الجودة العالية)
------------------------- */
app.get("/:config/stream/series/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("ythd:")) return res.json({ streams: [] });

  const channelHandle = id.replace("ythd:", "").trim();
  const streams = [];

  // خيار تشغيل المقاطع الجديدة بأعلى جودة 4K / 1080p
  streams.push({
    name: "[🔴 YOUTUBE 4K / 1080p]",
    title: `تشغيل أحدث المقاطع بأعلى جودة لقناة @ ${channelHandle}`,
    externalUrl: `https://www.youtube.com/@${channelHandle}/videos`
  });

  return res.json({ streams });
});

/* -------------------------
   6. تشغيل الخادم
------------------------- */
app.use((req, res) => {
  res.status(200).json({ streams: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 YouTube 4K Addon running on port ${PORT}`);
});
