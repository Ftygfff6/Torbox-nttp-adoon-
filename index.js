const express = require("express");
const axios = require("axios");
const app = express();

// تفعيل CORS يدوياً لضمان توافق Stremio
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.json());

// 1. صفحة الإعدادات
app.get("/configure", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعدادات إضافة TorBox Usenet</title>
    <style>
      body { font-family: sans-serif; background: #141414; color: #fff; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 80vh; margin: 0; }
      .card { background: #1f1f1f; padding: 25px; border-radius: 10px; width: 100%; max-width: 400px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); text-align: center; }
      h2 { color: #e50914; margin-bottom: 20px; }
      label { display: block; text-align: right; margin-top: 15px; font-weight: bold; font-size: 14px; }
      input[type="text"] { width: 100%; padding: 12px; margin-top: 5px; border-radius: 5px; border: 1px solid #333; background: #2b2b2b; color: #fff; box-sizing: border-box; outline: none; }
      button { width: 100%; margin-top: 25px; padding: 12px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 5px; cursor: pointer; font-size: 16px; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>⚡ TorBox Usenet Direct</h2>
      <label>مفتاح TorBox API Key:</label>
      <input type="text" id="torboxKey" placeholder="أدخل المفتاح هنا">
      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const tbKey = document.getElementById('torboxKey').value.trim();
        if(!tbKey) { alert('يرجى إدخال مفتاح TorBox API'); return; }
        
        const manifestUrl = window.location.origin + '/' + encodeURIComponent(tbKey) + '/manifest.json';
        const stremioLink = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
        window.location.href = stremioLink;
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

// 2. ملف التعريف Manifest
app.get("/:tbKey/manifest.json", (req, res) => {
  res.json({
    id: "org.my.torbox.usenet.v2",
    version: "2.0.0",
    name: "TorBox Usenet Direct",
    description: "مصدر Usenet و NZB المباشر عبر TorBox Pro",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    behaviorHints: { configurable: true, configurationRequired: false }
  });
});

// 3. معالج جلب الروابط من شبكة Usenet
app.get("/:tbKey/stream/:type/:id.json", async (req, res) => {
  try {
    const tbKey = req.params.tbKey;
    const streams = [];
    const parts = req.params.id.split(":");
    const imdbId = parts[0];

    if (tbKey) {
      const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${req.params.type}/${imdbId}.json`);
      const meta = metaRes.data?.meta;

      if (meta && meta.name) {
        let query = meta.name;
        if (req.params.type === "series" && parts.length >= 3) {
          const season = String(parts[1]).padStart(2, '0');
          const episode = String(parts[2]).padStart(2, '0');
          query += ` S${season}E${episode}`;
        }

        const searchUrl = `https://nzbindex.com/rss/?q=${encodeURIComponent(query)}&sort=age`;
        const nzbSearch = await axios.get(`https://api.allorigins.win/raw?url=${encodeURIComponent(searchUrl)}`, { timeout: 4000 }).catch(() => null);

        if (nzbSearch && nzbSearch.data) {
          const items = nzbSearch.data.split("<item>").slice(1, 6);
          for (const item of items) {
            const titleMatch = item.match(/<title>(.*?)<\/title>/);
            const linkMatch = item.match(/<enclosure url="(.*?)"/);

            if (titleMatch && linkMatch) {
              const rawTitle = titleMatch[1].replace("<![CDATA[", "").replace("]]>", "").trim();
              const nzbUrl = linkMatch[1];

              streams.push({
                name: "⚡ TorBox Usenet",
                title: `🌐 Usenet NZB\n📁 ${rawTitle}`,
                url: `https://api.torbox.app/v1/api/usenet/create?token=${tbKey}&link=${encodeURIComponent(nzbUrl)}`
              });
            }
          }
        }
      }
    }

    res.json({ streams });
  } catch (error) {
    console.error("Usenet Error:", error.message);
    res.json({ streams: [] });
  }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
