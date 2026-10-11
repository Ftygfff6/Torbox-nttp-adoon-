const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

// صفحة الإعدادات المحسنة
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>Kick Pro Live Addon</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2>🟢 إعدادات إضافة Kick للبث المباشر</h2>
    <p>أدخل أسماء قنوات Kick (مفصولة بفواصل):</p>
    <textarea id="ch" style="width:300px;height:80px;background:#151a1c;color:#53fc18;padding:10px;"></textarea><br><br>
    <button onclick="ins()" style="padding:10px 20px;background:#53fc18;border:none;font-weight:bold;cursor:pointer;">تثبيت في التطبيق</button>
    <script>
      function ins() {
        const v = document.getElementById('ch').value.trim();
        if(!v) return alert('أدخل قناة!');
        const list = v.split(/[,\\s\\n]+/).map(c => c.trim().toLowerCase()).filter(Boolean).join(',');
        window.location.href = 'stremio://' + window.location.host + '/' + btoa(encodeURIComponent(list)) + '/manifest.json';
      }
    </script>
  </body>
  </html>
  `);
});

app.get("/configure", (req, res) => {
  res.redirect("/");
});

app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.pro.live",
    version: "19.0.0",
    name: "Kick Pro Live",
    description: "البث المباشر لقنوات Kick بأعلى جودة واستقرار",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [{ type: "tv", id: "kick_live_cat", name: "🟢 Kick Live Channels" }],
    idPrefixes: ["kick:"]
  });
});

app.get("/:config/catalog/tv/kick_live_cat.json", (req, res) => {
  try {
    const channels = decodeURIComponent(Buffer.from(req.params.config, 'base64').toString('utf-8')).split(',');
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `Kick: ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512`,
        description: `بث مباشر حصري لقناة ${c.toUpperCase()} بجودات متعددة واستقرار تام.`
      }))
    });
  } catch(e) {
    res.json({ metas: [] });
  }
});

app.get("/:config/meta/tv/:id.json", (req, res) => {
  const c = req.params.id.replace("kick:", "");
  res.json({
    meta: {
      id: `kick:${c}`,
      type: "tv",
      name: `Kick: ${c.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512`,
      description: "اختر الجودة المناسبة لمشاهدة البث المباشر بدون تقطيع."
    }
  });
});

app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();
  const streams = [];

  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 });
    const pb = r.data?.playback_url;
    
    if (!pb) return res.json({ streams: [] });

    // 1. الخيار التلقائي السريع
    streams.push({ 
      name: "🟢 [KICK AUTO]", 
      title: `قناة: ${c.toUpperCase()} | البث المباشر (تلقائي)`, 
      url: pb 
    });

    // 2. استخراج الجودات المتاحة بدقة وترتيبها
    try {
      const pRes = await axios.get(pb, { timeout: 3000 });
      const lines = pRes.data.split("\n");
      const base = pb.substring(0, pb.lastIndexOf("/") + 1);
      
      lines.forEach((l, i) => {
        if (l.startsWith("#EXT-X-STREAM-INF:")) {
          const resM = l.match(/RESOLUTION=(\d+x\d+)/);
          const h = resM ? resM[1].split("x")[1] : "HD";
          let u = lines[i+1]?.trim();
          if (u && !u.startsWith("http")) u = base + u;
          if (u) {
            streams.push({ 
              name: `🟢 [${h}p]`, 
              title: `بث مباشر - جودة ${h}p | قناة: ${c.toUpperCase()}`, 
              url: u 
            });
          }
        }
      });
    } catch(err) {}

    res.json({ streams });
  } catch(e) {
    res.json({ streams: [] });
  }
});

app.listen(PORT);
