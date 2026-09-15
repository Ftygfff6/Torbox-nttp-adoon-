const express = require("express");
const axios = require("axios");
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.json());

// 1. صفحة إدخال بيانات استضافة TorBox NNTP و NZBGeek
app.get("/configure", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعدادات استضافة TorBox Usenet</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f0f; color: #fff; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 90vh; margin: 0; }
      .card { background: #1a1a1a; padding: 25px; border-radius: 12px; width: 100%; max-width: 420px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); border: 1px solid #2a2a2a; }
      h2 { color: #e50914; margin-bottom: 5px; text-align: center; font-size: 20px; }
      p.sub { font-size: 12px; color: #aaa; text-align: center; margin-bottom: 20px; }
      .section-title { font-size: 13px; color: #e50914; font-weight: bold; margin-top: 15px; border-bottom: 1px solid #333; padding-bottom: 4px; text-align: right; }
      label { display: block; text-align: right; margin-top: 10px; font-weight: 600; font-size: 12px; color: #ccc; }
      input[type="text"], input[type="password"] { width: 100%; padding: 10px; margin-top: 4px; border-radius: 6px; border: 1px solid #333; background: #242424; color: #fff; box-sizing: border-box; outline: none; font-size: 13px; }
      input:focus { border-color: #e50914; }
      button { width: 100%; margin-top: 25px; padding: 12px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 15px; transition: 0.2s; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🌐 TorBox NNTP + NZBGeek</h2>
      <p class="sub">ربط استضافة Usenet المباشرة وتثبيتها في Stremio</p>
      
      <div class="section-title">🔑 بيانات TorBox API Key</div>
      <label>مفتاح TorBox API Key:</label>
      <input type="text" id="tbKey" placeholder="أدخل API Key الخاص بك">

      <div class="section-title">📡 بيانات NZBGeek Indexer</div>
      <label>مفتاح NZBGeek API Key:</label>
      <input type="text" id="geekKey" placeholder="مثال: 1a2b3c4d5e...">

      <div class="section-title">⚡ بيانات سيرفر TorBox NNTP Host (اختياري)</div>
      <label>Host:</label>
      <input type="text" id="host" value="nntp.torbox.app">
      <label>Port:</label>
      <input type="text" id="port" value="563">

      <button onclick="install()">تثبيت الإضافة في Stremio مباشرة</button>
    </div>

    <script>
      function install() {
        const tbKey = document.getElementById('tbKey').value.trim();
        const geekKey = document.getElementById('geekKey').value.trim();
        const host = document.getElementById('host').value.trim();
        const port = document.getElementById('port').value.trim();

        if(!tbKey) { alert('يرجى إدخال مفتاح TorBox API Key'); return; }
        if(!geekKey) { alert('يرجى إدخال مفتاح NZBGeek API Key'); return; }

        const configData = { tbKey, geekKey, host, port };
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

// 2. ملف الـ Manifest لـ Stremio
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.torbox.nntp.geek",
    version: "2.5.0",
    name: "TorBox NNTP + NZBGeek",
    description: "استضافة Usenet المباشرة المربوطة بـ NZBGeek و TorBox",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    behaviorHints: { configurable: true, configurationRequired: false }
  });
});

// 3. محرك البحث والربط بين NZBGeek و TorBox
app.get("/:config/stream/:type/:id.json", async (req, res) => {
  try {
    const rawConfig = req.params.config;
    let config = {};

    try {
      config = JSON.parse(Buffer.from(decodeURIComponent(rawConfig), 'base64').toString('utf-8'));
    } catch (e) {
      return res.json({ streams: [] });
    }

    const { tbKey, geekKey, host } = config;
    const streams = [];
    const parts = req.params.id.split(":");
    const imdbId = parts[0];

    if (tbKey && geekKey) {
      // 1. جلب عنوان المحتوى عبر IMDb
      const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${req.params.type}/${imdbId}.json`);
      const meta = metaRes.data?.meta;

      if (meta && meta.name) {
        let searchQuery = meta.name;
        if (req.params.type === "series" && parts.length >= 3) {
          const season = String(parts[1]).padStart(2, '0');
          const episode = String(parts[2]).padStart(2, '0');
          searchQuery += ` S${season}E${episode}`;
        }

        // 2. البحث المباشر في NZBGeek API
        const geekApiUrl = `https://api.nzbgeek.info/api?t=search&q=${encodeURIComponent(searchQuery)}&apikey=${geekKey}&o=json`;
        const geekRes = await axios.get(geekApiUrl, { timeout: 6000 }).catch(() => null);

        if (geekRes?.data?.channel?.item) {
          const items = Array.isArray(geekRes.data.channel.item) ? geekRes.data.channel.item : [geekRes.data.channel.item];

          for (const item of items.slice(0, 10)) {
            const title = item.title || "NZB Stream";
            const nzbDownloadLink = item.link || item.enclosure?.["@attributes"]?.url;
            
            // استخراج الحجم إن وجد
            let sizeStr = "";
            if (item.enclosure?.["@attributes"]?.length) {
              sizeStr = `\n💾 الحجم: ${(item.enclosure["@attributes"].length / (1024 ** 3)).toFixed(2)} GB`;
            }

            if (nzbDownloadLink) {
              streams.push({
                name: "⚡ TorBox NNTP",
                title: `🌐 NZBGeek | ${host || 'nntp.torbox.app'}\n📦 ${title}${sizeStr}`,
                url: `https://api.torbox.app/v1/api/usenet/create?token=${tbKey}&link=${encodeURIComponent(nzbDownloadLink)}`
              });
            }
          }
        }
      }
    }

    res.json({ streams });
  } catch (error) {
    console.error("NNTP Stream Error:", error.message);
    res.json({ streams: [] });
  }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
