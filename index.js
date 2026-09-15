const express = require("express");
const axios = require("axios");
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.json());

// 1. واجهة الإعدادات مع إدخال كافة بيانات اتصال NNTP
app.get("/configure", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعدادات استضافة TorBox NNTP الكاملة</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f0f; color: #fff; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1a1a1a; padding: 25px; border-radius: 12px; width: 100%; max-width: 440px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); border: 1px solid #2a2a2a; }
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
      <h2>🌐 TorBox NNTP Full Server</h2>
      <p class="sub">إعداد استضافة Usenet الكاملة وتثبيتها في Stremio</p>
      
      <div class="section-title">🔑 المفاتيح الأساسية (API Keys)</div>
      <label>TorBox API Key:</label>
      <input type="text" id="tbKey" placeholder="أدخل TorBox API Key">

      <label>NZBGeek API Key:</label>
      <input type="text" id="geekKey" placeholder="أدخل NZBGeek API Key">

      <div class="section-title">⚡ بيانات اتصال سيرفر NNTP</div>
      <label>Host:</label>
      <input type="text" id="host" value="nntp.torbox.app">

      <label>Port:</label>
      <input type="text" id="port" value="563">

      <label>Username (إسم المستخدم):</label>
      <input type="text" id="username" placeholder="أدخل Username المخصص لسيرفر NNTP">

      <label>Password (كلمة المرور):</label>
      <input type="password" id="password" placeholder="أدخل Password المخصص لسيرفر NNTP">

      <label>Connections (عدد الاتصالات):</label>
      <input type="text" id="connections" value="10">

      <button onclick="install()">تثبيت الإضافة في Stremio مباشرة</button>
    </div>

    <script>
      function install() {
        const tbKey = document.getElementById('tbKey').value.trim();
        const geekKey = document.getElementById('geekKey').value.trim();
        const host = document.getElementById('host').value.trim();
        const port = document.getElementById('port').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const connections = document.getElementById('connections').value.trim();

        if(!tbKey) { alert('يرجى إدخال مفتاح TorBox API Key'); return; }
        if(!geekKey) { alert('يرجى إدخال مفتاح NZBGeek API Key'); return; }

        const configData = { tbKey, geekKey, host, port, username, password, connections };
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

// 2. ملف Manifest لـ Stremio
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.torbox.nntp.fullserver",
    version: "3.0.0",
    name: "TorBox NNTP Direct Host",
    description: "ربط استضافة NNTP الكاملة مع NZBGeek لخدمة Stremio",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    behaviorHints: { configurable: true, configurationRequired: false }
  });
});

// 3. معالج البحث والبث مع تضمين بيانات السيرفر
app.get("/:config/stream/:type/:id.json", async (req, res) => {
  try {
    const rawConfig = req.params.config;
    let config = {};

    try {
      config = JSON.parse(Buffer.from(decodeURIComponent(rawConfig), 'base64').toString('utf-8'));
    } catch (e) {
      return res.json({ streams: [] });
    }

    const { tbKey, geekKey, host, connections } = config;
    const streams = [];
    const parts = req.params.id.split(":");
    const imdbId = parts[0];

    if (tbKey && geekKey) {
      const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${req.params.type}/${imdbId}.json`);
      const meta = metaRes.data?.meta;

      if (meta && meta.name) {
        let searchQuery = meta.name;
        if (req.params.type === "series" && parts.length >= 3) {
          const season = String(parts[1]).padStart(2, '0');
          const episode = String(parts[2]).padStart(2, '0');
          searchQuery += ` S${season}E${episode}`;
        }

        const geekApiUrl = `https://api.nzbgeek.info/api?t=search&q=${encodeURIComponent(searchQuery)}&apikey=${geekKey}&o=json`;
        const geekRes = await axios.get(geekApiUrl, { timeout: 6000 }).catch(() => null);

        if (geekRes?.data?.channel?.item) {
          const items = Array.isArray(geekRes.data.channel.item) ? geekRes.data.channel.item : [geekRes.data.channel.item];

          for (const item of items.slice(0, 10)) {
            const title = item.title || "NZB Stream";
            const nzbDownloadLink = item.link || item.enclosure?.["@attributes"]?.url;
            
            let sizeStr = "";
            if (item.enclosure?.["@attributes"]?.length) {
              sizeStr = `\n💾 الحجم: ${(item.enclosure["@attributes"].length / (1024 ** 3)).toFixed(2)} GB`;
            }

            if (nzbDownloadLink) {
              streams.push({
                name: "⚡ TorBox NNTP",
                title: `🌐 Host: ${host || 'nntp.torbox.app'} [Conn: ${connections || 10}]\n📦 ${title}${sizeStr}`,
                url: `https://api.torbox.app/v1/api/usenet/create?token=${tbKey}&link=${encodeURIComponent(nzbDownloadLink)}`
              });
            }
          }
        }
      }
    }

    res.json({ streams });
  } catch (error) {
    console.error("NNTP Full Stream Error:", error.message);
    res.json({ streams: [] });
  }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
