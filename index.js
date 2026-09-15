const express = require("express");
const axios = require("axios");
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.json());

// 1. واجهة الإعدادات لإدخال مفاتيح API
app.get("/configure", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TorBox Dual-Engine (Torrent + Usenet)</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f0f; color: #fff; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1a1a1a; padding: 25px; border-radius: 12px; width: 100%; max-width: 440px; border: 1px solid #2a2a2a; box-shadow: 0 8px 24px rgba(0,0,0,0.6); }
      h2 { color: #e50914; margin-bottom: 5px; text-align: center; font-size: 20px; }
      p.sub { font-size: 12px; color: #aaa; text-align: center; margin-bottom: 20px; }
      .section-title { font-size: 13px; color: #e50914; font-weight: bold; margin-top: 15px; border-bottom: 1px solid #333; padding-bottom: 4px; text-align: right; }
      label { display: block; text-align: right; margin-top: 10px; font-weight: 600; font-size: 12px; color: #ccc; }
      input[type="text"] { width: 100%; padding: 10px; margin-top: 4px; border-radius: 6px; border: 1px solid #333; background: #242424; color: #fff; box-sizing: border-box; outline: none; font-size: 13px; }
      button { width: 100%; margin-top: 25px; padding: 12px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 15px; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🚀 TorBox Dual-Engine</h2>
      <p class="sub">إضافة Stremio لمصادر التورنت واليوزنت عبر سحابة TorBox</p>

      <div class="section-title">🔑 بيانات TorBox الرئيسية</div>
      <label>TorBox API Key:</label>
      <input type="text" id="tbKey" placeholder="أدخل TorBox API Key الخاص بك">

      <div class="section-title">⚡ بيانات محرك Usenet</div>
      <label>NZBGeek API Key:</label>
      <input type="text" id="geekKey" placeholder="أدخل NZBGeek API Key">

      <button onclick="install()">تثبيت الإضافة في Stremio</button>
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

// 2. ملف Manifest
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.torbox.dualengine.addon",
    version: "7.0.0",
    name: "TorBox (Torrent + Usenet)",
    description: "توفر نسخ التورنت واليوزنت جنبًا إلى جنب للبث السحابي المباشر",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    behaviorHints: { configurable: true, configurationRequired: false }
  });
});

// 3. مشغل روابط التورنت المباشر (Torrent Engine)
app.get("/play/torrent/:tbKey/:magnet", async (req, res) => {
  const { tbKey, magnet } = req.params;
  const decodedMagnet = decodeURIComponent(magnet);

  try {
    const formData = new URLSearchParams();
    formData.append("magnet", decodedMagnet);
    formData.append("seed", "1");

    const createRes = await axios.post("https://api.torbox.app/v1/api/torrents/createtorrent", formData, {
      headers: { "Authorization": `Bearer ${tbKey}`, "Content-Type": "application/x-www-form-urlencoded" }
    });

    const torrentId = createRes.data?.detail?.id || createRes.data?.data?.torrent_id;

    if (torrentId) {
      const dlRes = await axios.get(`https://api.torbox.app/v1/api/torrents/requestdl?token=${tbKey}&torrent_id=${torrentId}&redirect=false`, {
        headers: { "Authorization": `Bearer ${tbKey}` }
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

// 4. مشغل روابط اليوزنت المباشر (Usenet Engine)
app.get("/play/usenet/:tbKey/:nzbUrl", async (req, res) => {
  const { tbKey, nzbUrl } = req.params;
  const decodedNzb = decodeURIComponent(nzbUrl);

  try {
    const formData = new URLSearchParams();
    formData.append("link", decodedNzb);

    const createRes = await axios.post("https://api.torbox.app/v1/api/usenet/createusenet", formData, {
      headers: { "Authorization": `Bearer ${tbKey}`, "Content-Type": "application/x-www-form-urlencoded" }
    });

    const usenetId = createRes.data?.detail?.id || createRes.data?.data?.usenet_id;

    if (usenetId) {
      const dlRes = await axios.get(`https://api.torbox.app/v1/api/usenet/requestdl?token=${tbKey}&usenet_id=${usenetId}&redirect=false`, {
        headers: { "Authorization": `Bearer ${tbKey}` }
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

// 5. محرك البحث وتجهيز قائمة المصادر (Torrent vs Usenet)
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

    // القسم الأول: جلب نتائج التورنت (نسخة التورنت)
    if (tbKey) {
      const torrentSearchUrl = `https://torrentio.strem.fun/stream/${req.params.type}/${req.params.id}.json`;
      const torrentRes = await axios.get(torrentSearchUrl, { timeout: 4500 }).catch(() => null);

      if (torrentRes?.data?.streams) {
        for (const item of torrentRes.data.streams.slice(0, 5)) {
          if (item.infoHash) {
            const magnet = `magnet:?xt=urn:btih:${item.infoHash}`;
            
            streams.push({
              name: "🌀 [نسخة تورنت - TorBox]",
              title: `🚀 تشغيل سحابي سريع\n📦 ${item.title || 'Torrent Stream'}`,
              url: `${protocol}://${hostHeader}/play/torrent/${tbKey}/${encodeURIComponent(magnet)}`
            });
          }
        }
      }
    }

    // القسم الثاني: جلب نتائج اليوزنت من NZBGeek (نسخة اليوزنت)
    if (tbKey && geekKey) {
      const parts = req.params.id.split(":");
      const imdbId = parts[0];
      const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${req.params.type}/${imdbId}.json`).catch(() => null);
      const meta = metaRes?.data?.meta;

      if (meta && meta.name) {
        let searchQuery = meta.name;
        if (req.params.type === "series" && parts.length >= 3) {
          searchQuery += ` S${String(parts[1]).padStart(2, '0')}E${String(parts[2]).padStart(2, '0')}`;
        }

        const geekRes = await axios.get(`https://api.nzbgeek.info/api?t=search&q=${encodeURIComponent(searchQuery)}&apikey=${geekKey}&o=json`, { timeout: 4500 }).catch(() => null);

        if (geekRes?.data?.channel?.item) {
          const items = Array.isArray(geekRes.data.channel.item) ? geekRes.data.channel.item : [geekRes.data.channel.item];
          for (const item of items.slice(0, 5)) {
            const nzbLink = item.link || item.enclosure?.["@attributes"]?.url;
            let sizeStr = item.enclosure?.["@attributes"]?.length ? `\n💾 ${(item.enclosure["@attributes"].length / (1024 ** 3)).toFixed(2)} GB` : "";

            if (nzbLink) {
              streams.push({
                name: "⚡ [نسخة يوزنت - NZBGeek]",
                title: `🌐 تشغيل سحابي عبر Usenet\n📦 ${item.title || searchQuery}${sizeStr}`,
                url: `${protocol}://${hostHeader}/play/usenet/${tbKey}/${encodeURIComponent(nzbLink)}`
              });
            }
          }
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
