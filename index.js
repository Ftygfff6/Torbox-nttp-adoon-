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

// 1. واجهة الإعدادات
app.get("/configure", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Source TorBox Engine</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #141414; padding: 30px; border-radius: 16px; width: 100%; max-width: 440px; border: 1px solid #282828; text-align: center; }
      h2 { color: #e50914; margin-bottom: 8px; font-size: 22px; font-weight: 800; }
      p { font-size: 12px; color: #aaa; margin-bottom: 20px; }
      label { display: block; text-align: right; margin-top: 15px; font-size: 13px; color: #ccc; }
      input[type="text"] { width: 100%; padding: 12px; margin-top: 6px; border-radius: 8px; border: 1px solid #333; background: #1f1f1f; color: #fff; box-sizing: border-box; outline: none; }
      input[type="text"]:focus { border-color: #e50914; }
      button { width: 100%; margin-top: 25px; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🔥 Multi-Source TorBox Engine</h2>
      <p>تجميع مصادر (Torrentio + Comet + MediaFusion) وتشغيلها لحظياً عبر TorBox</p>
      
      <label>أدخل TorBox API Key:</label>
      <input type="text" id="tbKey" placeholder="أدخل مفتاح TorBox API">

      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const tbKey = document.getElementById('tbKey').value.trim();
        if(!tbKey) { alert('يرجى إدخال مفتاح TorBox API'); return; }
        
        const encodedConfig = btoa(JSON.stringify({ tbKey }));
        const manifestUrl = window.location.origin + '/' + encodeURIComponent(encodedConfig) + '/manifest.json';
        window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
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
    id: "org.torbox.multisource.engine",
    version: "16.0.0",
    name: "TorBox Multi-Source",
    description: "مجمع مصادر التورنت (Torrentio, Comet, MediaFusion) مع بث سريع عبر TorBox",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
  });
});

// 3. محرك تجميع المصادر وتوجيهها لـ TorBox
app.get("/:config/stream/:type/:id.json", async (req, res) => {
  try {
    const rawConfig = req.params.config;
    let config = {};
    try {
      config = JSON.parse(Buffer.from(decodeURIComponent(rawConfig), 'base64').toString('utf-8'));
    } catch (e) {
      return res.json({ streams: [] });
    }

    const { tbKey } = config;
    if (!tbKey) return res.json({ streams: [] });

    const { type, id } = req.params;

    // جلب المصادر بالتوازي (Parallel Requests) لسرعة الأداء
    const sources = [
      { name: "Torrentio", url: `https://torrentio.strem.fun/stream/${type}/${id}.json` },
      { name: "Comet", url: `https://comet.elfhosted.com/stream/${type}/${id}.json` },
      { name: "MediaFusion", url: `https://mediafusion.elfhosted.com/stream/${type}/${id}.json` }
    ];

    const requests = sources.map(source => 
      axios.get(source.url, { timeout: 3500 })
        .then(res => ({ sourceName: source.name, streams: res.data?.streams || [] }))
        .catch(() => ({ sourceName: source.name, streams: [] }))
    );

    const results = await Promise.all(requests);
    const combinedStreams = [];
    const seenHashes = new Set();

    for (const result of results) {
      for (const item of result.streams) {
        let hash = item.infoHash;

        // استخراج الـ Hash لو كان داخل رابط الماجنت
        if (!hash && item.url && item.url.startsWith("magnet:")) {
          const match = item.url.match(/btih:([a-zA-F0-9]+)/);
          if (match) hash = match[1];
        }

        if (hash && !seenHashes.has(hash.toLowerCase())) {
          seenHashes.add(hash.toLowerCase());

          // رابط تحويل مباشر عبر TorBox API
          const directTorboxUrl = `https://api.torbox.app/v1/api/torrents/requestdl?token=${tbKey}&magnet=${encodeURIComponent('magnet:?xt=urn:btih:' + hash)}&redirect=true`;

          combinedStreams.push({
            name: `[⚡ TorBox | ${result.sourceName}]`,
            title: `${item.title || 'Direct Stream'}\n🚀 تشغيل مباشر وفوري من سحابة TorBox`,
            url: directTorboxUrl
          });
        }
      }
    }

    res.json({ streams: combinedStreams });
  } catch (error) {
    res.json({ streams: [] });
  }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
