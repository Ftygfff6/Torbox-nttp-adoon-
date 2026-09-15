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
      .toggle-box { display: flex; align-items: center; justify-content: space-between; margin-top: 20px; background: #2b2b2b; padding: 12px; border-radius: 5px; }
      button { width: 100%; margin-top: 25px; padding: 12px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 5px; cursor: pointer; font-size: 16px; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>⚙️ إعدادات TorBox & NZB</h2>
      
      <label>مفتاح TorBox API Key:</label>
      <input type="text" id="torboxKey" placeholder="أدخل مفتاح TorBox الخاص بك">

      <div class="toggle-box">
        <span>🚀 تفعيل TorBox Pro (1Gbps/Usenet):</span>
        <input type="checkbox" id="isPro" checked>
      </div>

      <label>رابط موقع NZB Indexer إضافي (اختياري):</label>
      <input type="text" id="indexerUrl" placeholder="https://nzbgeek.info مثلاً">

      <label>مفتاح API الخاص بالـ Indexer (اختياري):</label>
      <input type="text" id="indexerKey" placeholder="أدخل مفتاح الفهرس">

      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const tbKey = document.getElementById('torboxKey').value.trim();
        const isPro = document.getElementById('isPro').checked;
        const indUrl = encodeURIComponent(document.getElementById('indexerUrl').value.trim());
        const indKey = document.getElementById('indexerKey').value.trim();

        if(!tbKey) { alert('يرجى إدخل مفتاح TorBox API'); return; }

        const configStr = \`tbKey=\${tbKey}|pro=\${isPro}|indUrl=\${indUrl}|indKey=\${indKey}\`;
        const manifestUrl = window.location.origin + '/' + btoa(configStr) + '/manifest.json';
        window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

// 2. ملف التعريف Manifest الديناميكي
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.my.torbox.custom.usenet",
    version: "1.2.0",
    name: "TorBox & Usenet Multi-Source",
    description: "بث سحابي ومباشر عبر TorBox Pro ومصادر Usenet NZB",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    behaviorHints: { configurable: true, configurationRequired: false }
  });
});

// 3. معالج البث المباشر Stream Handler
app.get("/:config/stream/:type/:id.json", async (req, res) => {
  try {
    const rawConfig = Buffer.from(req.params.config, 'base64').toString('utf-8');
    const params = new URLSearchParams(rawConfig.replace(/\|/g, '&'));
    
    const tbKey = params.get('tbKey');
    const isPro = params.get('pro') === 'true';
    const indUrl = decodeURIComponent(params.get('indUrl') || '');
    const indKey = params.get('indKey');

    const streams = [];

    // جلب ملفات TorBox المكتملة
    if (tbKey) {
      const mylist = await axios.get("https://api.torbox.app/v1/api/usenet/mylist?list=true", {
        headers: { Authorization: `Bearer ${tbKey}` }
      });

      if (mylist.data?.success && mylist.data?.data) {
        for (const item of mylist.data.data) {
          if (item.download_state === "completed" && item.files) {
            for (const file of item.files) {
              streams.push({
                name: isPro ? "⚡ TorBox Pro (1Gbps)" : "📦 TorBox Cloud",
                title: `[سحابي جاهز]\n💾 ${file.short_name || file.name}\n📊 ${(file.size / (1024 ** 3)).toFixed(2)} GB`,
                url: `https://api.torbox.app/v1/api/usenet/requestdl?token=${tbKey}&usenet_id=${item.id}&file_id=${file.id}`
              });
            }
          }
        }
      }
    }

    // جلب مصادر إضافية من موقع NZB/Indexer خارجي
    if (indUrl && indKey) {
      const searchRes = await axios.get(`${indUrl}/api/v1/search?apikey=${indKey}&query=${req.params.id}`);
      if (searchRes.data && Array.isArray(searchRes.data)) {
        for (const result of searchRes.data.slice(0, 5)) {
          streams.push({
            name: "🌐 Usenet NZB",
            title: `[جلب فوراط عبر TorBox]\n📄 ${result.title}\n📦 ${(result.size / (1024 ** 3)).toFixed(2)} GB`,
            url: `https://api.torbox.app/v1/api/usenet/create?token=${tbKey}&link=${encodeURIComponent(result.downloadUrl)}`
          });
        }
      }
    }

    res.json({ streams });
  } catch (error) {
    console.error("Stream error:", error.message);
    res.json({ streams: [] });
  }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
