const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { Parser } = require("m3u8-parser");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>Kick Stremio Addon</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2 style="color:#53fc18;">🟢 إعدادات إضافة Kick</h2>
    <p>أدخل أسماء القنوات (مفصولة بفواصل):</p>
    <textarea id="ch" style="width:300px;height:80px;background:#151a1c;color:#53fc18;padding:10px;border:1px solid #53fc18;border-radius:6px;" placeholder="abu_abeer16, xqc"></textarea><br><br>
    
    <button onclick="ins()" style="padding:10px 20px;background:#53fc18;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:6px;">تثبيت في التطبيق</button>
    
    <script>
      function ins() {
        const v = document.getElementById('ch').value.trim();
        if(!v) return alert('أدخل قناة!');
        const list = v.split(/[,\\s\\n]+/).map(c => c.trim().toLowerCase()).filter(Boolean).join(',');
        const payload = btoa(encodeURIComponent(JSON.stringify({ channels: list, quality: "all" })));
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
    id: "org.kick.live.vod.v31",
    version: "51.0.0",
    name: "Kick Live 🟢",
    description: "Kick Live Streams with Quality Options",
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
        description: `Kick stream for ${c.toUpperCase()}`
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
      description: `Kick stream for ${c.toUpperCase()}`
    }
  });
});

app.get("/:config/stream/tv/kick:channel.json", async (req, res) => {
  const c = req.params.channel.trim().toLowerCase();
  const streams = [];

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Referer": "https://kick.com/",
      "Origin": "https://kick.com"
    };

    const apiRes = await fetch(`https://kick.com/api/v2/channels/${c}`, { headers, timeout: 8000 });
    if (apiRes.ok) {
      const data = await apiRes.json();
      const pb = data?.playback_url;

      if (pb) {
        const m3u8Res = await fetch(pb, { headers, timeout: 8000 });
        if (m3u8Res.ok) {
          const masterBody = await m3u8Res.text();
          const parser = new Parser();
          parser.push(masterBody);
          parser.end();

          let variants = parser.manifest.playlists || [];
          
          variants.sort((a, b) => {
            const resA = a.attributes?.RESOLUTION?.height || 0;
            const resB = b.attributes?.RESOLUTION?.height || 0;
            if (resB !== resA) return resB - resA;
            return (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0);
          });

          streams.push({
            name: "🟢 Kick | Auto",
            title: `Live: ${c.toUpperCase()}`,
            url: pb,
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

          variants.forEach((v) => {
            const attrs = v.attributes || {};
            const height = attrs.RESOLUTION ? `${attrs.RESOLUTION.height}p` : "Quality";
            const bandwidth = attrs.BANDWIDTH ? `${Math.round(attrs.BANDWIDTH / 1000)} kbps` : "";
            const streamUrl = v.uri ? new URL(v.uri, pb).href : pb;

            streams.push({
              name: `🟢 Kick | ${height}`,
              title: bandwidth ? `📊 ${bandwidth} | Live` : "Live",
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
          });
        }
      }
    }
  } catch (e) {
    console.error("Error fetching stream:", e.message);
  }

  res.json({ streams });
});

app.listen(PORT, () => {
  console.log(`🟢 Kick Addon running on port ${PORT}`);
});
