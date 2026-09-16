const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;
const TORBOX_API_KEY = process.env.TORBOX_API_KEY;
const NZBGEEK_API_KEY = process.env.NZBGEEK_API_KEY;

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
    <title>TorBox & NZBGeek Addon</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0f0f11; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1a1a1e; padding: 30px; border-radius: 16px; width: 90%; max-width: 420px; border: 1px solid #2a2a30; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
      h2 { color: #e50914; margin-bottom: 8px; font-size: 22px; }
      p { font-size: 14px; color: #aaa; margin-bottom: 20px; line-height: 1.5; }
      .status { display: inline-block; padding: 6px 12px; background: ${TORBOX_API_KEY ? '#1b4332' : '#4a151b'}; color: ${TORBOX_API_KEY ? '#2ec4b6' : '#e63946'}; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 20px; }
      button { width: 100%; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; transition: 0.2s; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🚀 TorBox Hybrid Engine</h2>
      <div class="status">${TORBOX_API_KEY ? '✔ الخدمات متصلة بنجاح' : '✖ مفتاح API غير مضاف'}</div>
      <p>الإضافة تدمج مصادر Torrent و NZBGeek وتعمل مباشرة داخل Stremio.</p>
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
    id: "org.torbox.hybrid.engine",
    version: "1.0.0",
    name: "TorBox Hybrid (NZB + Torrent)",
    description: "بث سحابي مباشر ومصادر متكاملة من NZBGeek والتورنت عبر TorBox",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
  });
});

/* -------------------------
   3. Stream Handler
------------------------- */
app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    if (!TORBOX_API_KEY) {
      return res.json({ streams: [] });
    }

    const { type, id } = req.params;
    const streams = [];

    // أ) جلب نتائج NZBGeek (Usenet) إذا كان المفتاح موجوداً
    if (NZBGEEK_API_KEY) {
      try {
        const imdbNumeric = id.replace("tt", "").split(":")[0];
        const nzbUrl = `https://api.nzbgeek.info/api?t=movie&imdbid=${imdbNumeric}&apikey=${NZBGEEK_API_KEY}&o=json`;
        const nzbRes = await axios.get(nzbUrl, { timeout: 4000 }).catch(() => null);

        if (nzbRes?.data?.channel?.item) {
          const items = Array.isArray(nzbRes.data.channel.item) 
            ? nzbRes.data.channel.item 
            : [nzbRes.data.channel.item];

          for (const item of items.slice(0, 5)) {
            const downloadLink = item.link || item.enclosure?.["@attributes"]?.url;
            if (downloadLink) {
              const directUrl = `https://api.torbox.app/v1/api/usenet/requestdl?token=${TORBOX_API_KEY}&link=${encodeURIComponent(downloadLink)}&redirect=true`;
              
              streams.push({
                name: "[⚡ TorBox Usenet]",
                title: `${item.title || 'NZB Content'}\n📦 NZBGeek | تشغيل مباشر`,
                url: directUrl
              });
            }
          }
        }
      } catch (e) {
        console.error("NZBGeek Error:", e.message);
      }
    }

    // ب) جلب نتائج Torrentio كاحتياطي وتحويلها عبر TorBox
    try {
      const torrentRes = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`, { timeout: 4000 }).catch(() => null);
      if (torrentRes?.data?.streams) {
        for (const item of torrentRes.data.streams.slice(0, 8)) {
          if (item.infoHash) {
            const directUrl = `https://api.torbox.app/v1/api/torrents/requestdl?token=${TORBOX_API_KEY}&magnet=${encodeURIComponent('magnet:?xt=urn:btih:' + item.infoHash)}&redirect=true`;

            streams.push({
              name: "[⚡ TorBox Torrent]",
              title: `${item.title || 'Fast Stream'}\n🚀 Torrent | تشغيل مباشر عبر TorBox`,
              url: directUrl
            });
          }
        }
      }
    } catch (e) {
      console.error("Torrent Error:", e.message);
    }

    res.json({ streams });
  } catch (error) {
    console.error("Stream Handler Error:", error.message);
    res.json({ streams: [] });
  }
});

/* -------------------------
   4. Start Server
------------------------- */
app.listen(PORT, () => {
  console.log(`🚀 TorBox Hybrid addon running on port ${PORT}`);
});
