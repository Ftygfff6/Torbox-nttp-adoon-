const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json());

// 1. صفحة الإعدادات والتكوين التفاعلية
app.get("/configure", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <title>إعدادات إضافة TorBox Usenet</title>
    <style>
      body { font-family: sans-serif; background: #141414; color: #fff; padding: 20px; display: flex; justify-content: center; }
      .card { background: #1f1f1f; padding: 25px; border-radius: 10px; width: 100%; max-width: 450px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
      h2 { text-align: center; color: #e50914; }
      label { display: block; margin-top: 15px; font-weight: bold; }
      input[type="text"] { width: 100%; padding: 10px; margin-top: 5px; border-radius: 5px; border: 1px solid #333; background: #2b2b2b; color: #fff; box-sizing: border-box; }
      button { width: 100%; margin-top: 25px; padding: 12px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 5px; cursor: pointer; font-size: 16px; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>⚙️ إعدادات TorBox Usenet Direct</h2>
      
      <label>مفتاح TorBox API Key:</label>
      <input type="text" id="torboxKey" placeholder="أدخل مفتاح TorBox الخاص بك">

      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const tbKey = document.getElementById('torboxKey').value.trim();

        if(!tbKey) { alert('يرجى إدخال مفتاح TorBox API'); return; }

        const configStr = \`tbKey=\${tbKey}\`;
        const manifestUrl = window.location.origin + '/' + btoa(configStr) + '/manifest.json';
        window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

// 2. ملف التعريف Manifest
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.my.torbox.usenet.only",
    version: "1.3.0",
    name: "TorBox Usenet Finder",
    description: "جلب روابط Usenet & NZB المباشرة عبر TorBox",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    behaviorHints: { configurable: true, configurationRequired: false }
  });
});

// 3. معالج البث المباشر (Usenet Only)
app.get("/:config/stream/:type/:id.json", async (req, res) => {
  try {
    const rawConfig = Buffer.from(req.params.config, 'base64').toString('utf-8');
    const params = new URLSearchParams(rawConfig);
    const tbKey = params.get('tbKey');

    const streams = [];
    const imdbId = req.params.id.split(":")[0];

    if (tbKey) {
      // 1. جلب اسم المحتوى من Cinematic API عبر IMDb ID
      const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${req.params.type}/${imdbId}.json`);
      const meta = metaRes.data?.meta;

      if (meta && meta.name) {
        let searchQuery = meta.name;
        
        // إذا كان مسلسلاً، نحدد الموسم والحلقة S01E01
        if (req.params.type === "series" && req.params.id.includes(":")) {
          const parts = req.params.id.split(":");
          const season = String(parts[1]).padStart(2, '0');
          const episode = String(parts[2]).padStart(2, '0');
          searchQuery += ` S${season}E${episode}`;
        }

        // 2. البحث في شبكة Usenet مباشرة عبر TorBox Search API
        const searchRes = await axios.get(`https://api.torbox.app/v1/api/usenet/search?query=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${tbKey}` }
        });

        if (searchRes.data?.success && Array.isArray(searchRes.data?.data)) {
          for (const result of searchRes.data.data.slice(0, 10)) {
            const sizeGB = result.size ? (result.size / (1024 ** 3)).toFixed(2) : "N/A";
            streams.push({
              name: "⚡ TorBox Usenet",
              title: `🌐 NZB: ${result.name || result.title}\n💾 الحجم: ${sizeGB} GB`,
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
