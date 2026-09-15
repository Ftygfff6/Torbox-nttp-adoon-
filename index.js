const express = require("express");
const axios = require("axios");
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.json());

// 1. واجهة الإعدادات المحسّنة
app.get("/configure", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TorBox Ultra Engine v8.0</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #141414; padding: 30px; border-radius: 16px; width: 100%; max-width: 450px; border: 1px solid #282828; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
      h2 { color: #e50914; margin-bottom: 5px; text-align: center; font-size: 22px; font-weight: 800; }
      p.sub { font-size: 12px; color: #888; text-align: center; margin-bottom: 25px; }
      .section-title { font-size: 13px; color: #e50914; font-weight: bold; margin-top: 20px; border-bottom: 1px solid #222; padding-bottom: 6px; text-align: right; }
      label { display: block; text-align: right; margin-top: 12px; font-weight: 600; font-size: 12px; color: #aaa; }
      input[type="text"] { width: 100%; padding: 12px; margin-top: 5px; border-radius: 8px; border: 1px solid #333; background: #1f1f1f; color: #fff; box-sizing: border-box; outline: none; font-size: 13px; transition: border 0.2s; }
      input[type="text"]:focus { border-color: #e50914; }
      button { width: 100%; margin-top: 28px; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; transition: background 0.2s; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🚀 TorBox Ultra Engine</h2>
      <p class="sub">أسرع وأقوى محرك للبث المباشر (Usenet + Torrent) عبر TorBox</p>

      <div class="section-title">🔑 مفتاح TorBox API الرئيسي</div>
      <label>TorBox API Key:</label>
      <input type="text" id="tbKey" placeholder="أدخل TorBox API Key">

      <div class="section-title">⚡ محرك Usenet (NZBGeek)</div>
      <label>NZBGeek API Key:</label>
      <input type="text" id="geekKey" placeholder="أدخل NZBGeek API Key">

      <button onclick="install()">تثبيت الإضافة الفائقة في Stremio</button>
    </div>

    <script>
      function install() {
        const tbKey = document.getElementById('tbKey').value.trim();
        const geekKey = document.getElementById('geekKey').value.trim();

        if(!tbKey) { alert('يرجى إدخال مفتاح TorBox API Key'); return; }

        const configData = { tbKey, geekKey };
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

// 2. Manifest
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.torbox.ultra.engine",
    version: "8.0.0",
    name: "TorBox Ultra (Fastest Cloud Stream)",
    description: "أسرع وأعلى جودة لبث ملفات Usenet والتورنت سحابياً عبر TorBox",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    behaviorHints: { configurable: true, configurationRequired: false }
  });
});

// 3. معالج تشغيل Usenet الفوري السريع
app.get("/play/usenet/:tbKey/:nzbUrl", async (req, res) => {
  const { tbKey, nzbUrl } = req.params;
  const decodedNzb = decodeURIComponent(nzbUrl);

  try {
    const formData = new URLSearchParams();
    formData.append("link", decodedNzb);

    const createRes = await axios.post("https://api.torbox.app/v1/api/usenet/createusenet", formData, {
      headers: { "Authorization": `Bearer ${tbKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 3000
    });

    const usenetId = createRes.data?.detail?.id || createRes.data?.data?.usenet_id;

    if (usenetId) {
      const dlRes = await axios.get(`https://api.torbox.app/v1/api/usenet/requestdl?token=${tbKey}&usenet_id=${usenetId}&redirect=false`, {
        headers: { "Authorization": `Bearer ${tbKey}` },
        timeout: 3000
      }).catch(() => null);

      if (dlRes?.data?.data) {
        return res.redirect(302, dlRes.data.data);
      }
    }
    return res.redirect(302, `https://api.torbox.app/v1/api/usenet/requestdl?token=${tbKey}&link=${encodeURIComponent(decodedNzb)}`);
  } catch (err) {
    return res.redirect(302, `https://api.torbox.app/v1/api/usenet/requestdl?token=${tbKey}&link=${encodeURIComponent(decodedNzb)}`);
  }
});

// 4. معالج تشغيل التورنت الفوري السريع
app.get("/play/torrent/:tbKey/:magnet", async (req, res) => {
  const { tbKey, magnet } = req.params;
  const decodedMagnet = decodeURIComponent(magnet);

  try {
    const formData = new URLSearchParams();
    formData.append("magnet", decodedMagnet);
    formData.append("seed", "1");

    const createRes = await axios.post("https://api.torbox.app/v1/api/torrents/createtorrent", formData, {
      headers: { "Authorization": `Bearer ${tbKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 3000
    });

    const torrentId = createRes.data?.detail?.id || createRes.data?.data?.torrent_id;

    if (torrentId) {
      const dlRes = await axios.get(`https://api.torbox.app/v1/api/torrents/requestdl?token=${tbKey}&torrent_id=${torrentId}&redirect=false`, {
        headers: { "Authorization": `Bearer ${tbKey}` },
        timeout: 3000
      }).catch(() => null);

      if (dlRes?.data?.data) {
        return res.redirect(302, dlRes.data.data);
      }
    }
    return res.redirect(302, `https://api.torbox.app/v1/api/torrents/requestdl?token=${tbKey}&magnet=${encodeURIComponent(decodedMagnet)}`);
  } catch (err) {
    return res.redirect(302, `https://api.torbox.app/v1/api/torrents/requestdl?token=${tbKey}&magnet=${encodeURIComponent(decodedMagnet)}`);
  }
});

// 5. محرك البحث المتوازي عالي السرعة والجودة
app.get("/:config/stream/:type/:id.json", async (req, res) => {
  try {
    const rawConfig = req.params.config;
    let config = {};

    try {
      config = JSON.parse(Buffer.from(decodeURIComponent(rawConfig), 'base64').toString('utf-8'));
    } catch (e) {
      return res.json({ streams: [] });
    }

    const { tbKey, geekKey } = config;
    const streams = [];
    const protocol = req.protocol;
    const hostHeader = req.get("host");
    const parts = req.params.id.split(":");
    const imdbId = parts[0];

    // إعداد طلبات البحث بشكل متوازٍ لتوفير الوقت
    const promises = [];

    // طلب التورنت
    const torrentPromise = axios.get(`https://torrentio.strem.fun/stream/${req.params.type}/${req.params.id}.json`, { timeout: 3500 })
      .catch(() => null);
    promises.push(torrentPromise);

    // طلب Usenet إذا توفر المفتاح
    let geekPromise = Promise.resolve(null);
    if (geekKey) {
      geekPromise = axios.get(`https://v3-cinemeta.strem.io/meta/${req.params.type}/${imdbId}.json`, { timeout: 2500 })
        .then(async (metaRes) => {
          const meta = metaRes?.data?.meta;
          if (meta && meta.name) {
            let searchQuery = meta.name;
            if (req.params.type === "series" && parts.length >= 3) {
              searchQuery += ` S${String(parts[1]).padStart(2, '0')}E${String(parts[2]).padStart(2, '0')}`;
            }
            return axios.get(`https://api.nzbgeek.info/api?t=search&q=${encodeURIComponent(searchQuery)}&apikey=${geekKey}&o=json`, { timeout: 3500 });
          }
          return null;
        }).catch(() => null);
      promises.push(geekPromise);
    }

    const [torrentRes, geekRes] = await Promise.all(promises);

    // 1. معالجة مصادر Usenet الفائقة (NZBGeek)
    if (geekRes?.data?.channel?.item) {
      const items = Array.isArray(geekRes.data.channel.item) ? geekRes.data.channel.item : [geekRes.data.channel.item];
      for (const item of items.slice(0, 5)) {
        const nzbLink = item.link || item.enclosure?.["@attributes"]?.url;
        let sizeGb = item.enclosure?.["@attributes"]?.length ? (item.enclosure["@attributes"].length / (1024 ** 3)).toFixed(2) : "";

        if (nzbLink) {
          streams.push({
            name: "⚡ [Usenet 4K/HQ]",
            title: `💎 TorBox Ultra Fast Stream\n📦 ${item.title}${sizeGb ? `\n💾 ${sizeGb} GB` : ""}`,
            url: `${protocol}://${hostHeader}/play/usenet/${tbKey}/${encodeURIComponent(nzbLink)}`
          });
        }
      }
    }

    // 2. معالجة مصادر التورنت عالية الجودة
    if (torrentRes?.data?.streams) {
      for (const item of torrentRes.data.streams.slice(0, 5)) {
        if (item.infoHash) {
          const magnet = `magnet:?xt=urn:btih:${item.infoHash}`;
          streams.push({
            name: "🌀 [Torrent Ultra]",
            title: `🚀 TorBox Cloud Direct\n📦 ${item.title || 'High Quality Stream'}`,
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
