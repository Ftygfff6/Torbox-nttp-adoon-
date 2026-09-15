const express = require("express");
const axios = require("axios");
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.json());

app.get("/", (req, res) => res.redirect("/configure"));

// 1. واجهة الإعدادات لإدخال مفاتيح TorBox و NZBGeek
app.get("/configure", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TorBox Usenet Debrid</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #141414; padding: 30px; border-radius: 16px; width: 100%; max-width: 420px; border: 1px solid #282828; text-align: center; }
      h2 { color: #e50914; margin-bottom: 8px; font-size: 22px; font-weight: 800; }
      p { font-size: 12px; color: #aaa; margin-bottom: 20px; }
      label { display: block; text-align: right; margin-top: 15px; font-size: 13px; color: #ccc; }
      input[type="text"] { width: 100%; padding: 12px; margin-top: 6px; border-radius: 8px; border: 1px solid #333; background: #1f1f1f; color: #fff; box-sizing: border-box; outline: none; }
      button { width: 100%; margin-top: 25px; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>📦 TorBox Usenet Engine</h2>
      <p>جلب المصادر بنفس نمط Newznab / Usenet 2160p</p>
      
      <label>أدخل TorBox API Key:</label>
      <input type="text" id="tbKey" placeholder="TorBox API Key">

      <label>أدخل NZBGeek API Key (أو Indexer آخر):</label>
      <input type="text" id="geekKey" placeholder="NZBGeek API Key">

      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const tbKey = document.getElementById('tbKey').value.trim();
        const geekKey = document.getElementById('geekKey').value.trim();
        if(!tbKey || !geekKey) return alert('يرجى إدخال مفتاح TorBox و NZBGeek');
        
        const encoded = btoa(JSON.stringify({ tbKey, geekKey }));
        window.location.href = 'stremio://' + window.location.host + '/' + encodeURIComponent(encoded) + '/manifest.json';
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

// 2. Manifest
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.torbox.usenet.debrid",
    version: "40.0.0",
    name: "TorBox Usenet Debrid",
    description: "جلب مصادر Usenet / Newznab وتشغيلها سحابياً عبر TorBox",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
  });
});

// 3. محرك جلب روابط Usenet بالنسق الموضح في صورتك
app.get("/:config/stream/:type/:id.json", async (req, res) => {
  try {
    const rawConfig = req.params.config;
    let config = {};
    try { config = JSON.parse(Buffer.from(decodeURIComponent(rawConfig), 'base64').toString('utf-8')); } catch (e) {}

    const { tbKey, geekKey } = config;
    if (!tbKey || !geekKey) return res.json({ streams: [] });

    const { type, id } = req.params;
    const imdbId = id.split(":")[0];

    // جلب معلومات الفيلم من Cinemeta لمعرفة الاسم
    const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`, { timeout: 3000 }).catch(() => null);
    const title = metaRes?.data?.meta?.name;

    if (!title) return res.json({ streams: [] });

    // البحث في سيرفرات Newznab / NZBGeek
    const geekUrl = `https://api.nzbgeek.info/api?t=search&q=${encodeURIComponent(title)}&apikey=${geekKey}&o=json`;
    const geekRes = await axios.get(geekUrl, { timeout: 4000 }).catch(() => null);

    const streams = [];
    const items = geekRes?.data?.channel?.item;

    if (items) {
      const itemList = Array.isArray(items) ? items : [items];

      for (const item of itemList.slice(0, 10)) {
        const nzbLink = item.link || item.enclosure?.["@attributes"]?.url;
        const sizeBytes = item.enclosure?.["@attributes"]?.length;
        const sizeGb = sizeBytes ? (sizeBytes / (1024 ** 3)).toFixed(1) : "33.0";

        if (nzbLink) {
          // رابط تحويل مباشر عبر TorBox Usenet API
          const directPlayUrl = `https://api.torbox.app/v1/api/usenet/requestdl?token=${tbKey}&link=${encodeURIComponent(nzbLink)}&redirect=true`;

          streams.push({
            name: `Newznab 2160p [⌛ TB]`,
            title: `WEB-DL | HEVC | HDR | Atmos | DD+\nGB (42.6 Mbps) | NZBgeek\n${item.title}\nحجم GB ${sizeGb}`,
            url: directPlayUrl
          });
        }
      }
    }

    res.json({ streams });
  } catch (error) {
    res.json({ streams: [] });
  }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
