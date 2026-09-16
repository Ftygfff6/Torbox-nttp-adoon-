const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

/* -------------------------
   1. واجهة الإعدادات والمدخلات
------------------------- */
app.get(["/", "/configure"], (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Silo Cloud Engine Configuration</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0f0f11; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1a1a1e; padding: 30px; border-radius: 16px; width: 90%; max-width: 420px; border: 1px solid #2a2a30; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
      h2 { color: #e50914; margin-bottom: 8px; font-size: 22px; }
      p { font-size: 13px; color: #aaa; margin-bottom: 20px; }
      .input-group { text-align: right; margin-bottom: 12px; }
      label { font-size: 12px; color: #ccc; display: block; margin-bottom: 4px; }
      input { width: 100%; padding: 10px; background: #0f0f11; border: 1px solid #333; color: #fff; border-radius: 6px; box-sizing: border-box; }
      button { width: 100%; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; margin-top: 10px; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🚀 Silo Cloud Engine</h2>
      <p>أدخل بيانات السيرفر السحابي الخاص بك لتوليد رابط التثبيت</p>
      
      <div class="input-group">
        <label>رابط السيرفر (Server URL)</label>
        <input type="text" id="url" placeholder="https://udisl01.jaof.xyz" value="https://udisl01.jaof.xyz">
      </div>

      <div class="input-group">
        <label>البورت (Port)</label>
        <input type="text" id="port" placeholder="443" value="443">
      </div>

      <div class="input-group">
        <label>اسم المستخدم (Username)</label>
        <input type="text" id="user" placeholder="Altmimi90" value="Altmimi90">
      </div>

      <div class="input-group">
        <label>كلمة المرور (Password)</label>
        <input type="password" id="pass" placeholder="e6E6xKDdLRg2" value="e6E6xKDdLRg2">
      </div>

      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const url = encodeURIComponent(document.getElementById('url').value.trim());
        const port = encodeURIComponent(document.getElementById('port').value.trim());
        const user = encodeURIComponent(document.getElementById('user').value.trim());
        const pass = encodeURIComponent(document.getElementById('pass').value.trim());

        if (!url || !user || !pass) {
          alert("يرجى ملء جميع البيانات المطلوبة!");
          return;
        }

        const config = \`url=\${url}&port=\${port}&user=\${user}&pass=\${pass}\`;
        const manifestUrl = window.location.origin + '/' + btoa(config) + '/manifest.json';
        window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

/* -------------------------
   2. Manifest مخصص مع الإعدادات
------------------------- */
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.silo.cloud.engine",
    version: "1.1.0",
    name: "Silo Cloud Server",
    description: "تشغيل سحابي مباشر من سيرفر Silo الخاص بك",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
  });
});

/* -------------------------
   3. Stream Handler ببيانات المستخدم
------------------------- */
app.get("/:config/stream/:type/:id.json", async (req, res) => {
  const { config, type, id } = req.params;
  const streams = [];

  try {
    // فك تشفير الإعدادات
    const decoded = Buffer.from(config, 'base64').toString('utf-8');
    const params = new URLSearchParams(decoded);

    let serverUrl = params.get('url');
    const port = params.get('port');
    const user = params.get('user');
    const pass = params.get('pass');

    if (port && !serverUrl.includes(':' + port) && !serverUrl.startsWith('https')) {
      serverUrl = `${serverUrl}:${port}`;
    }

    const cleanImdbId = id.split(":")[0];
    const targetUrl = `${serverUrl}/player_api.php?username=${user}&password=${pass}&action=${type === 'movie' ? 'get_vod_streams' : 'get_series'}`;

    const response = await axios.get(targetUrl, { timeout: 4000 }).catch(() => null);

    if (response?.data && Array.isArray(response.data)) {
      const match = response.data.find(item => 
        item.custom_sid === cleanImdbId || 
        item.direct_source === cleanImdbId ||
        (item.name && item.name.includes(cleanImdbId))
      );

      if (match) {
        const ext = match.container_extension || "mp4";
        const mediaUrl = `${serverUrl}/${type === 'movie' ? 'movie' : 'series'}/${user}/${pass}/${match.stream_id}.${ext}`;

        streams.push({
          name: "[🎬 Silo Cloud]",
          title: `${match.name || 'Silo Stream'}\n⚡ بث مباشر من سيرفر Silo`,
          url: mediaUrl
        });
      }
    }

    return res.json({ streams });
  } catch (error) {
    console.error("Silo Engine Error:", error.message);
    return res.json({ streams: [] });
  }
});

/* -------------------------
   4. معالجة المسارات العامة والتشغيل
------------------------- */
app.use((req, res) => {
  res.status(200).json({ streams: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 Configurable Silo Engine running on port ${PORT}`);
});
