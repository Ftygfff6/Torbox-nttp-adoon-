const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>Kick Interactive Live</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2>🟢 إعدادات إضافة Kick التفاعلية</h2>
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
    id: "org.kick.interactive.live",
    version: "20.0.0",
    name: "Kick Interactive Live",
    description: "البث المباشر لقنوات Kick مع تفاعل متقدم وحالة البث",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [{ type: "tv", id: "kick_interactive_cat", name: "🟢 Kick Interactive" }],
    idPrefixes: ["kick:"]
  });
});

app.get("/:config/catalog/tv/kick_interactive_cat.json", (req, res) => {
  try {
    const channels = decodeURIComponent(Buffer.from(req.params.config, 'base64').toString('utf-8')).split(',');
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `Kick: ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512`,
        description: `بث مباشر تفاعلي لقناة ${c.toUpperCase()} - اضغط للعرض الفوري.`
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
      description: "اضغط على خيار البث المباشر أدناه للتشغيل الفوري مع جودات متعددة وحالة اتصال لحظية."
    }
  });
});

app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();
  const streams = [];

  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 });
    const pb = r.data?.playback_url;
    const isLive = r.data?.livestream !== null && r.data?.livestream !== undefined;
    
    if (!pb || !isLive) {
      // خيار تفاعلي يخبرك بأن القناة غير متصلة حالياً بدلاً من إرجاع قائمة فارغة
      streams.push({
        name: "🔴 [البث متوقف]",
        title: `قناة ${c.toUpperCase()} غير متصلة بالبث المباشر حالياً.`,
        url: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4"
      });
      return res.json({ streams });
    }

    // 1. خيار التشغيل السريع التلقائي
    streams.push({ 
      name: "🟢 [LIVE - تشغيل سريع]", 
      title: `قناة: ${c.toUpperCase()} | البث المباشر الأساسي`, 
      url: pb 
    });

    // 2. تحليل الجودات وإضافتها بتنسيق تفاعلي
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
              name: `🟢 [دقة ${h}p]`, 
              title: `بث مباشر بجودة ${h}p | قناة: ${c.toUpperCase()}`, 
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
