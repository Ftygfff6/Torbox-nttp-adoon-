const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

// ==================== دالة جلب مع timeout ====================
function fetchWithTimeout(url, options = {}, timeout = 8000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeout)
    )
  ]);
}

// ==================== دالة جلب بيانات Kick (مباشر ثم وسيط) ====================
async function fetchKickChannel(slug) {
  const kickUrl = `https://kick.com/api/v2/channels/${slug}`;

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://kick.com/",
    "Origin": "https://kick.com"
  };

  // المحاولة 1: مباشر
  try {
    const res = await fetchWithTimeout(kickUrl, { headers }, 6000);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.log("Direct fetch failed:", e.message);
  }

  // المحاولة 2: allorigins
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(kickUrl)}`;
    const res = await fetchWithTimeout(proxyUrl, {}, 8000);
    if (res.ok) {
      const wrapper = await res.json();
      if (wrapper.contents) {
        return JSON.parse(wrapper.contents);
      }
    }
  } catch (e) {
    console.log("Proxy fetch failed:", e.message);
  }

  // المحاولة 3: r.jina.ai
  try {
    const jinaUrl = `https://r.jina.ai/${kickUrl}`;
    const res = await fetchWithTimeout(jinaUrl, {
      headers: { "Accept": "application/json" }
    }, 8000);
    if (res.ok) {
      const text = await res.text();
      const jsonStart = text.indexOf("{");
      if (jsonStart !== -1) {
        return JSON.parse(text.substring(jsonStart));
      }
    }
  } catch (e) {
    console.log("Jina fetch failed:", e.message);
  }

  return null;
}

// ==================== الصفحة الرئيسية ====================
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kick Stremio</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding:40px 20px;">
    <h2 style="color:#53fc18;">🟢 إضافة Kick</h2>
    <p>أدخل أسماء القنوات (مفصولة بفواصل أو مسافات):</p>
    <textarea id="ch" style="width:100%;max-width:400px;height:100px;background:#151a1c;color:#53fc18;padding:12px;border:1px solid #53fc18;border-radius:8px;font-size:16px;" placeholder="xqc, kaicenat, adinross"></textarea><br><br>
    <button onclick="ins()" style="padding:14px 28px;background:#53fc18;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:8px;font-size:16px;">📲 تثبيت في Stremio</button>
    <script>
      function ins() {
        const v = document.getElementById('ch').value.trim();
        if(!v) return alert('أدخل اسم قناة على الأقل!');
        const list = v.split(/[,\\s\\n]+/).map(c => c.trim().toLowerCase()).filter(Boolean).join(',');
        if(!list) return alert('أدخل اسم صحيح!');
        const payload = btoa(encodeURIComponent(JSON.stringify({ channels: list, quality: "all" })));
        window.location.href = 'stremio://' + window.location.host + '/' + payload + '/manifest.json';
      }
    </script>
  </body>
  </html>
  `);
});

app.get("/configure", (req, res) => res.redirect("/"));

// ==================== فك تشفير الإعدادات ====================
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

// ==================== Manifest ====================
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.live.vod.v31",
    version: "52.0.0",
    name: "Kick Live 🟢",
    description: "Kick Live Streams",
    logo: "https://kick.com/favicon.ico",
    resources: [
      "catalog",
      "meta",
      {
        name: "stream",
        types: ["tv"],
        idPrefixes: ["kick:"]
      }
    ],
    types: ["tv"],
    catalogs: [
      { type: "tv", id: "kick_live_cat", name: "🟢 Kick مباشر" }
    ],
    idPrefixes: ["kick:"]
  });
});

// ==================== Catalog ====================
app.get("/:config/catalog/tv/kick_live_cat.json", (req, res) => {
  try {
    const config = decodeConfig(req.params.config);
    const channels = config.channels ? config.channels.split(",").filter(Boolean) : [];
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `🔴 ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
        description: `Kick: ${c.toUpperCase()}`
      }))
    });
  } catch (e) {
    res.json({ metas: [] });
  }
});

// ==================== Meta ====================
app.get("/:config/meta/tv/kick:channel.json", (req, res) => {
  const c = req.params.channel;
  res.json({
    meta: {
      id: `kick:${c}`,
      type: "tv",
      name: `🔴 ${c.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      description: `Kick: ${c.toUpperCase()}`
    }
  });
});

// ==================== Streams (النسخة السريعة) ====================
app.get("/:config/stream/tv/kick:channel.json", async (req, res) => {
  const c = req.params.channel.trim().toLowerCase();
  const streams = [];

  const streamHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": "https://kick.com/",
    "Origin": "https://kick.com"
  };

  try {
    const data = await fetchKickChannel(c);
    const pb = data?.playback_url;

    if (pb) {
      // رابط Auto (الأساسي)
      streams.push({
        name: `🟢 Kick | Auto`,
        title: `📺 ${c.toUpperCase()}`,
        url: pb,
        behaviorHints: {
          notWebReady: true,
          proxyHeaders: { request: streamHeaders }
        }
      });

      // إضافة جودات شائعة كخيارات منفصلة
      // ملاحظة: كلها نفس الرابط، لكن بمسميات مختلفة
      // (Stremio يتعامل مع m3u8 تلقائياً ويختار الجودة)
      const qualities = ["1080p", "720p", "480p", "360p", "160p"];
      qualities.forEach(q => {
        streams.push({
          name: `🟢 Kick | ${q}`,
          title: `📊 ${q} | ${c.toUpperCase()}`,
          url: pb,
          behaviorHints: {
            notWebReady: true,
            proxyHeaders: { request: streamHeaders }
          }
        });
      });
    }
  } catch (e) {
    console.error("Stream error:", e.message);
  }

  res.json({ streams });
});

// ==================== Keep-Alive ====================
setInterval(() => {
  fetch(`http://localhost:${PORT}/`, { timeout: 5000 }).catch(() => {});
  console.log("🔄 Keep-alive ping");
}, 10 * 60 * 1000); // كل 10 دقائق

// ==================== تشغيل الخادم ====================
app.listen(PORT, () => {
  console.log(`🟢 Kick Addon running on port ${PORT}`);
});
