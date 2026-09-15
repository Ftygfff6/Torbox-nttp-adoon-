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
    <title>TorBox Direct Fix</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #141414; padding: 30px; border-radius: 16px; width: 100%; max-width: 420px; border: 1px solid #282828; text-align: center; }
      h2 { color: #e50914; margin-bottom: 10px; }
      label { display: block; text-align: right; margin-top: 15px; font-size: 13px; color: #ccc; }
      input[type="text"] { width: 100%; padding: 12px; margin-top: 6px; border-radius: 8px; border: 1px solid #333; background: #1f1f1f; color: #fff; box-sizing: border-box; outline: none; }
      button { width: 100%; margin-top: 25px; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🚀 TorBox Direct Player</h2>
      <p style="font-size:12px; color:#888;">إصلاح التشغيل المباشر 100% لتطبيق Stremio</p>
      <label>أدخل TorBox API Key:</label>
      <input type="text" id="tbKey" placeholder="TorBox API Key">
      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>
    <script>
      function install() {
        const tbKey = document.getElementById('tbKey').value.trim();
        if(!tbKey) return alert('أدخل المفتاح أولاً');
        const encoded = btoa(JSON.stringify({ tbKey }));
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
    id: "org.torbox.directplayer.fix",
    version: "12.0.0",
    name: "TorBox Direct Player",
    description: "البث المباشر الفوري بدون أخطاء تشغيل",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
  });
});

// 3. مشغل البث التلقائي المعالج
app.get("/play/:tbKey/:hash", async (req, res) => {
  const { tbKey, hash } = req.params;
  
  try {
    // الاستعلام عن قائمة التورنت الموجودة في حسابك بـ TorBox
    const listRes = await axios.get(`https://api.torbox.app/v1/api/torrents/mylist?token=${tbKey}`, { timeout: 4000 }).catch(() => null);
    const myTorrents = listRes?.data?.data || [];
    
    let target = myTorrents.find(t => t.hash && t.hash.toLowerCase() === hash.toLowerCase());

    if (!target) {
      // إذا لم يكن موجهاً للحساب، يتم إضافته فوراً
      const formData = new URLSearchParams();
      formData.append("magnet", `magnet:?xt=urn:btih:${hash}`);
      const createRes = await axios.post("https://api.torbox.app/v1/api/torrents/createtorrent", formData, {
        headers: { "Authorization": `Bearer ${tbKey}`, "Content-Type": "application/x-www-form-urlencoded" }
      });
      target = createRes?.data?.data;
    }

    const torrentId = target?.torrent_id || target?.id;

    if (torrentId) {
      const dlRes = await axios.get(`https://api.torbox.app/v1/api/torrents/requestdl?token=${tbKey}&torrent_id=${torrentId}&redirect=false`);
      if (dlRes?.data?.data) {
        return res.redirect(302, dlRes.data.data);
      }
    }

    return res.status(404).send("الملف جاري معالجته في سحابة TorBox، يرجى المحاولة بعد قليل.");
  } catch (err) {
    return res.status(500).send("خطأ في جلب رابط التشغيل.");
  }
});

// 4. محرك البحث والتشغيل
app.get("/:config/stream/:type/:id.json", async (req, res) => {
  try {
    const rawConfig = req.params.config;
    let config = {};
    try { config = JSON.parse(Buffer.from(decodeURIComponent(rawConfig), 'base64').toString('utf-8')); } catch (e) {}

    const { tbKey } = config;
    if (!tbKey) return res.json({ streams: [] });

    const protocol = req.protocol;
    const hostHeader = req.get("host");

    const torrentRes = await axios.get(`https://torrentio.strem.fun/stream/${req.params.type}/${req.params.id}.json`, { timeout: 4000 }).catch(() => null);
    const streams = [];

    if (torrentRes?.data?.streams) {
      for (const item of torrentRes.data.streams.slice(0, 8)) {
        if (item.infoHash) {
          streams.push({
            name: `🚀 [TorBox Direct]`,
            title: `🎬 ${item.title || 'Direct Stream'}\n⚡ تشغيل مباشر بدقة عالية`,
            url: `${protocol}://${hostHeader}/play/${tbKey}/${item.infoHash}`
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
