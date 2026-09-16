const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;
const TORBOX_API_KEY = process.env.TORBOX_API_KEY;

if (!TORBOX_API_KEY) {
  console.warn("⚠️ TORBOX_API_KEY is not configured");
}

/* -------------------------
   1. الواجهة الرئيسية وصفحة التثبيت
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
      .card { background: #1a1a1e; padding: 30px; border-radius: 16px; width: 90%; max-width: 400px; border: 1px solid #2a2a30; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
      h2 { color: #e50914; margin-bottom: 8px; font-size: 22px; }
      p { font-size: 14px; color: #aaa; margin-bottom: 25px; line-height: 1.5; }
      .status { display: inline-block; padding: 6px 12px; background: ${TORBOX_API_KEY ? '#1b4332' : '#4a151b'}; color: ${TORBOX_API_KEY ? '#2ec4b6' : '#e63946'}; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 20px; }
      button { width: 100%; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; transition: 0.2s; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🚀 TorBox Debrid Engine</h2>
      <div class="status">${TORBOX_API_KEY ? '✔ مفتاح API مرتبط بنجاح' : '✖ المفتاح غير مضاف في Render'}</div>
      <p>اضغط على الزر أدناه لتثبيت الإضافة مباشرة داخل تطبيق Stremio.</p>
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
   2. Stremio Manifest
------------------------- */
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "org.torbox.debrid.engine",
    version: "1.0.0",
    name: "TorBox Engine",
    description: "تشغيل مباشر للسيرفرات السحابية عبر TorBox",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
  });
});

/* -------------------------
   3. Stremio Stream Handler
------------------------- */
app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    if (!TORBOX_API_KEY) {
      return res.json({ streams: [] });
    }

    const { type, id } = req.params;

    // جلب التورنت والمصادر لعنوان IMDb
    const torrentRes = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`, { timeout: 5000 }).catch(() => null);
    
    if (!torrentRes?.data?.streams) {
      return res.json({ streams: [] });
    }

    const streams = [];

    for (const item of torrentRes.data.streams.slice(0, 10)) {
      if (item.infoHash) {
        const directUrl = `https://api.torbox.app/v1/api/torrents/requestdl?token=${TORBOX_API_KEY}&magnet=${encodeURIComponent('magnet:?xt=urn:btih:' + item.infoHash)}&redirect=true`;

        streams.push({
          name: "[⚡ TorBox]",
          title: `${item.title || 'Fast Stream'}\n⚡ تشغيل مباشر عبر TorBox`,
          url: directUrl
        });
      }
    }

    res.json({ streams });
  } catch (error) {
    console.error("Stream error:", error.message);
    res.json({ streams: [] });
  }
});

/* -------------------------
   4. Health check
------------------------- */
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    torboxConfigured: Boolean(TORBOX_API_KEY),
  });
});

/* -------------------------
   Start
------------------------- */
app.listen(PORT, () => {
  console.log(`🚀 TorBox addon running on port ${PORT}`);
});
