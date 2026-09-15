const express = require("express");
const axios = require("axios");
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(express.json());

// 1. الصفحة الرئيسية والصفحة التي تحتوي على الإعدادات
app.get("/", (req, res) => {
  res.redirect("/configure");
});

app.get("/configure", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TorBox Ultimate + Sports</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #141414; padding: 30px; border-radius: 16px; width: 100%; max-width: 450px; border: 1px solid #282828; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
      h2 { color: #e50914; margin-bottom: 5px; text-align: center; font-size: 22px; font-weight: 800; }
      p.sub { font-size: 12px; color: #888; text-align: center; margin-bottom: 25px; }
      .section-title { font-size: 13px; color: #e50914; font-weight: bold; margin-top: 20px; border-bottom: 1px solid #222; padding-bottom: 6px; text-align: right; }
      label { display: block; text-align: right; margin-top: 12px; font-weight: 600; font-size: 12px; color: #aaa; }
      input[type="text"] { width: 100%; padding: 12px; margin-top: 5px; border-radius: 8px; border: 1px solid #333; background: #1f1f1f; color: #fff; box-sizing: border-box; outline: none; font-size: 13px; }
      input[type="text"]:focus { border-color: #e50914; }
      button { width: 100%; margin-top: 28px; padding: 14px; background: #e50914; border: none; color: #fff; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; }
      button:hover { background: #b80710; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🔥 TorBox All-In-One</h2>
      <p class="sub">أفلام ومسلسلات (4K/Usenet) + جدول بث المباريات المباشرة</p>

      <div class="section-title">🔑 بيانات TorBox والأفلام</div>
      <label>TorBox API Key:</label>
      <input type="text" id="tbKey" placeholder="أدخل TorBox API Key">

      <label>NZBGeek API Key (اختياري):</label>
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

// 2. Manifest الموحد
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.torbox.allinone.engine",
    version: "10.0.0",
    name: "TorBox All-In-One (Movies + Sports)",
    description: "أفلام ومسلسلات 4K بجميع المصادر + بث مباشر للمباريات والقنوات الرياضية",
    resources: ["catalog", "stream", "meta"],
    types: ["movie", "series", "tv"],
    idPrefixes: ["tt", "match_"],
    catalogs: [
      {
        type: "tv",
        id: "live_matches",
        name: "⚽ جدول المباريات المباشرة"
      }
    ],
    behaviorHints: { configurable: true, configurationRequired: false }
  });
});

// 3. كتالوج المباريات المباشرة
app.get("/:config/catalog/tv/live_matches.json", (req, res) => {
  const metas = [
    {
      id: "match_bein_1",
      type: "tv",
      name: "⚽ beIN Sports Premium HD",
      poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/BeIN_Sports_logo.svg/512px-BeIN_Sports_logo.svg.png",
      description: "بث مباشر لمباريات اليوم"
    },
    {
      id: "match_sky_1",
      type: "tv",
      name: "⚽ Sky Sports Main Event (4K/HD)",
      poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Sky_Sports_logo_2017.svg/512px-Sky_Sports_logo_2017.svg.png",
      description: "التغطية البريطانية المباشرة"
    }
  ];
  res.json({ metas });
});

// 4. Meta للمباريات
app.get("/:config/meta/tv/:id.json", (req, res) => {
  res.json({
    meta: {
      id: req.params.id,
      type: "tv",
      name: "بث مباشر للمباراة القادمة",
      poster: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=500",
      description: "اختر أحد المصادر بالأسفل لمشاهدة البث المباشر."
    }
  });
});

// 5. مشغل Usenet
app.get("/play/usenet/:tbKey/:nzbUrl", async (req, res) => {
  const { tbKey, nzbUrl } = req.params;
  const decodedNzb = decodeURIComponent(nzbUrl);

  try {
    const formData = new URLSearchParams();
    formData.append("link", decodedNzb);

    const createRes = await axios.post("https://api.torbox.app/v1/api/usenet/createusenet", formData, {
      headers: { "Authorization": `Bearer ${tbKey}`, "Content-Type": "application/x-www-form-urlencoded" }
    });

    const usenetId = createRes.data?.data?.usenet_id || createRes.data?.detail?.id;

    if (usenetId) {
      const dlRes = await axios.get(`https://api.torbox.app/v1/api/usenet/requestdl?token=${tbKey}&usenet_id=${usenetId}&redirect=false`, {
        headers: { "Authorization": `Bearer ${tbKey}` }
      });
      if (dlRes.data?.data) return res.redirect(302, dlRes.data.data);
    }

    const directDl = await axios.get(`https://api.torbox.app/v1/api/usenet/requestdl?token=${tbKey}&link=${encodeURIComponent(decodedNzb)}&redirect=false`, {
      headers: { "Authorization": `Bearer ${tbKey}` }
    });
    if (directDl.data?.data) return res.redirect(302, directDl.data.data);

    return res.status(404).send("File process pending on TorBox Cloud.");
  } catch (err) {
    return res.status(500).send("Error fetching Usenet file.");
  }
});

// 6. مشغل Torrent
app.get("/play/torrent/:tbKey/:magnet", async (req, res) => {
  const { tbKey, magnet } = req.params;
  const decodedMagnet = decodeURIComponent(magnet);

  try {
    const formData = new URLSearchParams();
    formData.append("magnet", decodedMagnet);

    const createRes = await axios.post("https://api.torbox.app/v1/api/torrents/createtorrent", formData, {
      headers: { "Authorization": `Bearer ${tbKey}`, "Content-Type": "application/x-www-form-urlencoded" }
    });

    const torrentId = createRes.data?.data?.torrent_id || createRes.data?.detail?.id;

    if (torrentId) {
      const dlRes = await axios.get(`https://api.torbox.app/v1/api/torrents/requestdl?token=${tbKey}&torrent_id=${torrentId}&redirect=false`, {
        headers: { "Authorization": `Bearer ${tbKey}` }
      });
      if (dlRes.data?.data) return res.redirect(302, dlRes.data.data);
    }

    const directDl = await axios.get(`https://api.torbox.app/v1/api/torrents/requestdl?token=${tbKey}&magnet=${encodeURIComponent(decodedMagnet)}&redirect=false`, {
      headers: { "Authorization": `Bearer ${tbKey}` }
    });
    if (directDl.data?.data) return res.redirect(302, directDl.data.data);

    return res.status(404).send("File process pending on TorBox Cloud.");
  } catch (err) {
    return res.status(500).send("Error fetching Torrent file.");
  }
});

// 7. معالج الروابط (Streams)
app.get("/:config/stream/:type/:id.json", async (req, res) => {
  try {
    const { type, id } = req.params;

    if (type === "tv" && id.startsWith("match_")) {
      return res.json({
        streams: [
          {
            name: "⚡ Stream 1 (1080p 60fps)",
            title: "🌐 المصدر الأول: سيرفر أجنبي مباشر - FHD",
            url: "https://stream.ec/live/stream1/index.m3u8"
          },
          {
            name: "⚡ Stream 2 (720p HQ)",
            title: "🌐 المصدر الثاني: سيرفر مباشر ثابت",
            url: "https://stream.ec/live/stream2/index.m3u8"
          }
        ]
      });
    }

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
    const parts = id.split(":");
    const imdbId = parts[0];

    if (tbKey && geekKey) {
      const metaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`, { timeout: 3000 }).catch(() => null);
      const meta = metaRes?.data?.meta;

      if (meta && meta.name) {
        let searchQuery = `${meta.name} 2160p OR 4K OR Remux`;
        if (type === "series" && parts.length >= 3) {
          searchQuery = `${meta.name} S${String(parts[1]).padStart(2, '0')}E${String(parts[2]).padStart(2, '0')} 2160p OR 4K`;
        }

        const geekRes = await axios.get(`https://api.nzbgeek.info/api?t=search&q=${encodeURIComponent(searchQuery)}&apikey=${geekKey}&o=json`, { timeout: 4000 }).catch(() => null);

        if (geekRes?.data?.channel?.item) {
          const items = Array.isArray(geekRes.data.channel.item) ? geekRes.data.channel.item : [geekRes.data.channel.item];
          items.sort((a, b) => parseInt(b.enclosure?.["@attributes"]?.length || 0) - parseInt(a.enclosure?.["@attributes"]?.length || 0));

          for (const item of items.slice(0, 5)) {
            const nzbLink = item.link || item.enclosure?.["@attributes"]?.url;
            const sizeBytes = item.enclosure?.["@attributes"]?.length;
            const sizeGb = sizeBytes ? (sizeBytes / (1024 ** 3)).toFixed(2) : "HQ";

            if (nzbLink) {
              streams.push({
                name: `⚡ Usenet [4K/HQ]`,
                title: `🎬 ${item.title}\n💾 الحجم: ${sizeGb} GB | 🚀 TorBox Direct`,
                url: `${protocol}://${hostHeader}/play/usenet/${tbKey}/${encodeURIComponent(nzbLink)}`
              });
            }
          }
        }
      }
    }

    if (tbKey) {
      const torrentRes = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`, { timeout: 4000 }).catch(() => null);

      if (torrentRes?.data?.streams) {
        const torrents = torrentRes.data.streams.filter(s => s.title && (s.title.includes("4k") || s.title.includes("2160p") || s.title.includes("REMUX")));
        const listToUse = torrents.length > 0 ? torrents : torrentRes.data.streams;

        for (const item of listToUse.slice(0, 5)) {
          if (item.infoHash) {
            const magnet = `magnet:?xt=urn:btih:${item.infoHash}`;
            streams.push({
              name: `🌀 Torrent [4K/UHD]`,
              title: `🎬 ${item.title || 'TorBox Stream'}\n🚀 TorBox Direct Cloud`,
              url: `${protocol}://${hostHeader}/play/torrent/${tbKey}/${encodeURIComponent(magnet)}`
            });
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
