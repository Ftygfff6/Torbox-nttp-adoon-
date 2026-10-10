
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { Parser } = require("m3u8-parser");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

async function fetchKickChannel(channel) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://kick.com/",
    "Origin": "https://kick.com"
  };
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${channel}`, { headers, timeout: 8000 });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>Kick Stremio Addon</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2 style="color:#53fc18;">🟢 إعدادات إضافة Kick</h2>
    <p>أدخل أسماء القنوات (مفصولة بفواصل):</p>
    <textarea id="ch" style="width:300px;height:80px;background:#151a1c;color:#53fc18;padding:10px;border:1px solid #53fc18;border-radius:6px;" placeholder="xqc, trainwreckstv"></textarea><br><br>
    
    <label>الجودة المفضلة:</label><br>
    <select id="qual" style="padding:8px;background:#151a1c;color:#53fc18;border:1px solid #53fc18;margin-top:5px;border-radius:6px;">
      <option value="all">عرض جميع الجودات</option>
      <option value="1080">1080p</option>
      <option value="720">720p</option>
      <option value="480">480p</option>
    </select><br><br>

    <button onclick="ins()" style="padding:10px 20px;background:#53fc18;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:6px;">تثبيت في التطبيق</button>
    
    <script>
      function ins() {
        const v = document.getElementById('ch').value.trim();
        const q = document.getElementById('qual').value;
        if(!v) return alert('أدخل قناة!');
        const list = v.split(/[,\\s\\n]+/).map(c => c.trim().toLowerCase()).filter(Boolean).join(',');
        const payload = btoa(encodeURIComponent(JSON.stringify({ channels: list, quality: q })));
        window.location.href = 'stremio://' + window.location.host + '/' + payload + '/manifest.json';
      }
    </script>
  </body>
  </html>
  `);
});

app.get("/configure", (req, res) => res.redirect("/"));

function decodeConfig(config) {
  try {
    const decoded = decodeURIComponent(Buffer.from(config, "base64").toString("utf-8"));
    return JSON.parse(decoded);
  } catch (e) {
    try {
      const oldStr = decodeURIComponent(Buffer.from(config, "base64").toString("utf-8"));
      return { channels: oldStr, quality: "all" };
    } catch (err) {
      return { channels: "", quality: "all" };
    }
  }
}

app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.live.vod.v25",
    version: "45.0.0",
    name: "Kick Live 🟢",
    description: "بث مباشر Kick مع تحديد الجودة",
    logo: "https://kick.com/favicon.ico",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [{ type: "tv", id: "kick_live_cat", name: "🟢 Kick مباشر" }],
    idPrefixes: ["kick:"]
  });
});

app.get("/:config/catalog/tv/kick_live_cat.json", (req, res) => {
  try {
    const config = decodeConfig(req.params.config);
    const channels = config.channels ? config.channels.split(",").filter(Boolean) : [];
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `🔴 مباشر: ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
        description: `البث المباشر لقناة ${c.toUpperCase()}`
      }))
    });
  } catch (e) {
    res.json({ metas: [] });
  }
});

app.get("/:config/meta/tv/kick:channel.json", (req, res) => {
  const c = req.params.channel;
  res.json({
    meta: {
      id: `kick:${c}`,
      type: "tv",
      name: `🔴 ${c.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      description: `البث المباشر لقناة ${c.toUpperCase()}`
    }
  });
});

app.get("/:config/stream/tv/kick:channel.json", async (req, res) => {
  const c = req.params.channel.trim().toLowerCase();
  const config = decodeConfig(req.params.config);
  const selectedQuality = config.quality || "all";
  const streams = [];

  const data = await fetchKickChannel(c);
  let masterUrl = data?.playback_url || `https://stream.kick.com/ivs/v1/160088099270/channel/${c}/m3u8/master.m3u8`;

  try {
    const response = await fetch(masterUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://kick.com/",
        "Origin": "https://kick.com"
      }
    });

    if (response.ok) {
      const masterBody = await response.text();
      const parser = new Parser();
      parser.push(masterBody);
      parser.end();

      let variants = parser.manifest.playlists || [];
      variants.sort((a, b) => (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0));

      variants.forEach((v) => {
        const attrs = v.attributes || {};
        const height = attrs.RESOLUTION ? `${attrs.RESOLUTION.height}` : "";
        const resolutionLabel = attrs.RESOLUTION ? `${attrs.RESOLUTION.height}p` : "تلقائي";
        const bandwidth = attrs.BANDWIDTH ? `${Math.round(attrs.BANDWIDTH / 1000)} kbps` : "";
        const streamUrl = v.uri ? new URL(v.uri, masterUrl).href : masterUrl;

        if (selectedQuality === "all" || height.includes(selectedQuality)) {
          streams.push({
            name: `🟢 Kick | ${resolutionLabel}`,
            title: bandwidth ? `📊 ${bandwidth}` : "بث مباشر",
            url: streamUrl,
            behaviorHints: {
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "User-Agent": "Mozilla/5.0",
                  "Referer": "https://kick.com/",
                  "Origin": "https://kick.com"
                }
              }
            }
          });
        }
      });
    }
  } catch (e) {}

  if (streams.length === 0) {
    streams.push({
      name: "🟢 Kick | بث مباشر",
      title: `قناة ${c.toUpperCase()}`,
      url: masterUrl,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: {
          request: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://kick.com/",
            "Origin": "https://kick.com"
          }
        }
      }
    });
  }

  res.json({ streams });
});

app.listen(PORT, () => {
  console.log(`🟢 Kick Addon running on port ${PORT}`);
});
