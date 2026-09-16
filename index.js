const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

// بيانات سيرفر Silo الخاصة بك
const SILO_SERVER_URL = process.env.SILO_SERVER || "https://udisl01.jaof.xyz";
const SILO_USERNAME = process.env.SILO_USER || "Altmimi90";
const SILO_PASSWORD = process.env.SILO_PASS || "e6E6xKDdLRg2";

/* -------------------------
   1. الصفحة الرئيسية لتثبيت الإضافة
------------------------- */
app.get(["/", "/configure"], (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Silo Cloud Engine for Stremio</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0f0f11; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1a1a1e; padding: 30px; border-radius: 16px; width: 90%; max-width: 420px; border: 1px solid #2a2a30; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
      h2 { color: #e50914; margin-bottom: 8px; font-size: 22px; }
      p { font-size: 14px; color: #aaa; margin-bottom: 20px; line-height: 1.5; }
      .status { display: inline-block; padding: 6px 12px; background: #1b4332; color: #2ec4b6; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 20px; }
      button { width: 100%; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; transition: 0.2s; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🚀 Silo Cloud Engine</h2>
      <div class="status">✔ السيرفر متصل جاهز</div>
      <p>إضافة مخصصة لجلب الأفلام والمسلسلات مباشرة من سيرفر Silo السحابي إلى Stremio.</p>
      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const manifestUrl = window.location.origin + '/manifest.json';
        window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

/* -------------------------
   2. Manifest الإضافة
------------------------- */
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "org.silo.cloud.engine",
    version: "1.0.0",
    name: "Silo Cloud Server",
    description: "تشغيل سحابي مباشر من سيرفر Silo الخاص بك",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
  });
});

/* -------------------------
   3. محرك جلب الرابط المباشر من Silo
------------------------- */
app.get("/stream/:type/:id.json", async (req, res) => {
  const { type, id } = req.params;
  const streams = [];

  try {
    const cleanImdbId = id.split(":")[0]; // استخراج ttXXXXXX

    // طلب الاستعلام من واجهة سيرفر Silo
    const targetUrl = `${SILO_SERVER_URL}/player_api.php?username=${SILO_USERNAME}&password=${SILO_PASSWORD}&action=${type === 'movie' ? 'get_vod_streams' : 'get_series'}`;
    
    const response = await axios.get(targetUrl, { timeout: 4000 }).catch(() => null);

    if (response?.data && Array.isArray(response.data)) {
      // المطابقة مع المعرف أو العنوان
      const itemMatch = response.data.find(item => 
        item.custom_sid === cleanImdbId || 
        item.direct_source === cleanImdbId ||
        (item.name && item.name.includes(cleanImdbId))
      );

      if (itemMatch) {
        const ext = itemMatch.container_extension || "mp4";
        const mediaUrl = `${SILO_SERVER_URL}/${type === 'movie' ? 'movie' : 'series'}/${SILO_USERNAME}/${SILO_PASSWORD}/${itemMatch.stream_id}.${ext}`;

        streams.push({
          name: "[🎬 Silo Cloud]",
          title: `${itemMatch.name || 'Silo Stream'}\n⚡ بث مباشر من سيرفر Silo السحابي`,
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
   4. معالجة الأخطاء والتشغيل
------------------------- */
app.use((req, res) => {
  res.status(200).json({ streams: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 Silo Cloud Engine running on port ${PORT}`);
});
