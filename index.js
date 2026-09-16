const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;
const TORBOX_API_KEY = process.env.TORBOX_API_KEY;
const NZBGEEK_API_KEY = process.env.NZBGEEK_API_KEY;

/* -------------------------
   1. الواجهة الرئيسية
------------------------- */
app.get(["/", "/configure"], (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TorBox Stremio Addon</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0f0f11; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1a1a1e; padding: 30px; border-radius: 16px; width: 90%; max-width: 420px; border: 1px solid #2a2a30; text-align: center; }
      h2 { color: #e50914; margin-bottom: 8px; font-size: 22px; }
      p { font-size: 14px; color: #aaa; margin-bottom: 20px; }
      .status { display: inline-block; padding: 6px 12px; background: ${TORBOX_API_KEY ? '#1b4332' : '#4a151b'}; color: ${TORBOX_API_KEY ? '#2ec4b6' : '#e63946'}; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 20px; }
      button { width: 100%; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🚀 TorBox Hybrid Engine</h2>
      <div class="status">${TORBOX_API_KEY ? '✔ السيرفر جاهز للعمل' : '✖ المفتاح غير مضاف'}</div>
      <p>اضغط أدناه لتثبيت الإضافة مباشرة داخل Stremio.</p>
      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const manifestUrl = window.location.origin + '/manifest.json';
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
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "org.torbox.hybrid.addon",
    version: "2.0.0",
    name: "TorBox Hybrid",
    description: "تشغيل مباشر عبر TorBox",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
  });
});

/* -------------------------
   3. Stream Handler
------------------------- */
app.get("/stream/:type/:id.json", async (req, res) => {
  if (!TORBOX_API_KEY) {
    return res.json({ streams: [] });
  }

  const { type, id } = req.params;
  const streams = [];

  try {
    // 1. جلب التورنت المتاح وتحويله عبر TorBox Torrent API القياسي
    const torrentRes = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`, { timeout: 3000 }).catch(() => null);

    if (torrentRes?.data?.streams) {
      for (const item of torrentRes.data.streams.slice(0, 10)) {
        if (item.infoHash) {
          // استخدام رابط التورنت المباشر لمنع أخطاء 422
          const directUrl = `https://api.torbox.app/v1/api/torrents/requestdl?token=${TORBOX_API_KEY}&magnet=${encodeURIComponent('magnet:?xt=urn:btih:' + item.infoHash)}&redirect=true`;

          streams.push({
            name: "[⚡ TorBox]",
            title: `${item.title || 'Fast Stream'}\n🚀 تشغيل مباشر بدون انتظار`,
            url: directUrl
          });
        }
      }
    }

    return res.json({ streams });
  } catch (error) {
    console.error("Stream Error:", error.message);
    return res.json({ streams: [] });
  }
});

/* -------------------------
   4. Handling 404 Errors Safely
------------------------- */
app.use((req, res) => {
  res.status(200).json({ streams: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 Addon running on port ${PORT}`);
});
