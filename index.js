const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();

app.use(cors());
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
      button { width: 100%; margin-top: 25px; padding: 12px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 5px; cursor: pointer; font-size: 16px; transition: 0.2s; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>⚙️ TorBox Usenet Direct</h2>
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
    id: "org.my.torbox.usenet.direct",
    version: "1.4.0",
    name: "TorBox Usenet Finder",
    description: "جلب روابط Usenet & NZB المباشرة عبر TorBox",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    behaviorHints: { configurable: true, configurationRequired: false }
  });
});

// 3. جلب الروابط من Usenet
app.get("/:tbKey/stream/:type/:id.json", async (req, res) => {
  try {
    const tbKey = req.params.tbKey;
    const streams = [];
    const imdbId = req.params.id.split(":")[0];

    if (tbKey) {
      // جلب اسم العنوان عبر Cinemeta
      const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${req.params.type}/${imdbId}.json`);
      const meta = metaRes.data?.meta;

      if (meta && meta.name) {
        let searchQuery = meta.name;
        
        if (req.params.type === "series" && req.params.id.includes(":")) {
          const parts = req.params.id.split(":");
          const season = String(parts[1]).padStart(2, '0');
          const episode = String(parts[2]).padStart(2, '0');
          searchQuery += ` S${season}E${episode}`;
        }

        // البحث في Usenet عبر TorBox
        const searchRes = await axios.get(`https://api.torbox.app/v1/api/usenet/search?query=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${tbKey}` }
        });

        if (searchRes.data?.success && Array.isArray(searchRes.data?.data)) {
          for (const result of searchRes.data.data.slice(0, 10)) {
            const sizeGB = result.size ? (result.size / (1024 ** 3)).toFixed(2) : "N/A";
            streams.push({
              name: "⚡ TorBox Usenet",
              title: `🌐 ${result.name || result.title}\n💾 الحجم: ${sizeGB} GB`,
              url: `https://api.torbox.app/v1/api/usenet/create?token=${tbKey}&link=${encodeURIComponent(result.download_url || result.link)}`
            });
          }
        }
      }
    }

    res.json({ streams });
  } catch (error) {
    console.error("Usenet Stream error:", error.message);
    res.json({ streams: [] });
  }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

