const express = require("express");
const axios = require("axios");
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.json());

// 1. الصفحة الرئيسية والتحويل لصفحة الإعدادات
app.get("/", (req, res) => {
  res.redirect("/configure");
});

// 2. واجهة إدخال مفتاح TorBox API
app.get("/configure", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TorBox Torrent Engine</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #141414; padding: 30px; border-radius: 16px; width: 100%; max-width: 420px; border: 1px solid #282828; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
      h2 { color: #e50914; margin-bottom: 5px; text-align: center; font-size: 22px; font-weight: 800; }
      p.sub { font-size: 12px; color: #888; text-align: center; margin-bottom: 25px; }
      label { display: block; text-align: right; margin-top: 15px; font-weight: 600; font-size: 13px; color: #ccc; }
      input[type="text"] { width: 100%; padding: 12px; margin-top: 6px; border-radius: 8px; border: 1px solid #333; background: #1f1f1f; color: #fff; box-sizing: border-box; outline: none; font-size: 13px; }
      input[type="text"]:focus { border-color: #e50914; }
      button { width: 100%; margin-top: 25px; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🌀 TorBox Torrent Direct</h2>
      <p class="sub">إضافة Stremio مخصصة لبث التورنت سحابياً عبر TorBox</p>

      <label>أدخل TorBox API Key الخاص بك:</label>
      <input type="text" id="tbKey" placeholder="TorBox API Key">

      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const tbKey = document.getElementById('tbKey').value.trim();
        if(!tbKey) { alert('يرجى إدخال مفتاح TorBox API Key'); return; }

        const configData = { tbKey };
        const encodedConfig = btoa(JSON.stringify(configData));

        const manifestUrl = window.location.origin + '/' + encodeURIComponent(encodedConfig) + '/manifest.json';
        const stremioLink = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
        window.location.href = stremioLink;
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

// 3. Manifest الخاص بالتورنت
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.torbox.torrent.only",
    version: "1.0.0",
    name: "TorBox Torrent Direct",
    description: "بث روابط التورنت المباشرة وسحابية عبر TorBox Debrid",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    behaviorHints: { configurable: true, configurationRequired: false }
  });
});

// 4. مشغل التورنت المباشر عبر API TorBox (حل مشكلة 404)
app.get("/play/torrent/:tbKey/:magnet", async (req, res) => {
  const { tbKey, magnet } = req.params;
  const decodedMagnet = decodeURIComponent(magnet);

  try {
    const formData = new URLSearchParams();
    formData.append("magnet", decodedMagnet);

    // إنشاء التورنت في سحابة TorBox
    const createRes = await axios.post("https://api.torbox.app/v1/api/torrents/createtorrent", formData, {
      headers: { 
        "Authorization": `Bearer ${tbKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    const torrentId = createRes.data?.data?.torrent_id || createRes.data?.detail?.id;

    // طلب رابط التحميل/البث المباشر
    if (torrentId) {
      const dlRes = await axios.get(`https://api.torbox.app/v1/api/torrents/requestdl?token=${tbKey}&torrent_id=${torrentId}&redirect=false`, {
        headers: { "Authorization": `Bearer ${tbKey}` }
      });
      if (dlRes.data?.data) return res.redirect(302, dlRes.data.data);
    }

    // محاولة طلب الرابط المباشر في حال كان الملف مضافاً مسبقاً (Cached)
    const directDl = await axios.get(`https://api.torbox.app/v1/api/torrents/requestdl?token=${tbKey}&magnet=${encodeURIComponent(decodedMagnet)}&redirect=false`, {
      headers: { "Authorization": `Bearer ${tbKey}` }
    });
    if (directDl.data?.data) return res.redirect(302, directDl.data.data);

    return res.status(404).send("Torrent is processing on TorBox cloud.");
  } catch (err) {
    return res.status(500).send("Error playing torrent stream.");
  }
});

// 5. محرك جلب مصادر التورنت للأفلام والمسلسلات
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

    const streams = [];
    const protocol = req.protocol;
    const hostHeader = req.get("host");

    // جلب التورنت من Torrentio
    const torrentRes = await axios.get(`https://torrentio.strem.fun/stream/${req.params.type}/${req.params.id}.json`, { timeout: 4000 }).catch(() => null);

    if (torrentRes?.data?.streams) {
      for (const item of torrentRes.data.streams.slice(0, 10)) {
        if (item.infoHash) {
          const magnet = `magnet:?xt=urn:btih:${item.infoHash}`;
          
          streams.push({
            name: `🌀 [TorBox Torrent]`,
            title: `🎬 ${item.title || 'Torrent Stream'}\n🚀 تشغيل سحابي مباشر عبر TorBox`,
            url: `${protocol}://${hostHeader}/play/torrent/${tbKey}/${encodeURIComponent(magnet)}`
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
