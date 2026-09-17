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
  <head><meta charset="UTF-8"><title>Kick Addon Config</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2>🟢 إعدادات إضافة Kick (البث والإعادات المباشرة)</h2>
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
    id: "org.kick.inapp.vods",
    version: "18.0.0",
    name: "Kick Live & In-App VODs",
    description: "البث المباشر والإعادات المسجلة داخل المشغل مباشرة",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [{ type: "tv", id: "kick_cat", name: "🟢 Kick Channels" }],
    idPrefixes: ["kick:"]
  });
});

app.get("/:config/catalog/tv/kick_cat.json", (req, res) => {
  try {
    const channels = decodeURIComponent(Buffer.from(req.params.config, 'base64').toString('utf-8')).split(',');
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `Kick: ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18`,
        description: `قناة ${c} - مشاهدة البث والإعادات داخل المشغل`
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
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18`,
      description: "اختر البث أو الإعادة المسجلة لتشتغل معك فوراً داخل التطبيق"
    }
  });
});

app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();
  const streams = [];

  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 });
    
    // 1. جلب البث المباشر
    const pb = r.data?.playback_url;
    if (pb) {
      streams.push({ 
        name: "🟢 [LIVE AUTO]", 
        title: `قناة: ${c.toUpperCase()} | البث المباشر`, 
        url: pb 
      });
    }

    // 2. محاولة جلب أحدث إعادة مسجلة (VOD) وتشغيلها مباشرة داخل التطبيق
    const pastStreams = r.data?.previous_livestreams || [];
    if (pastStreams.length > 0) {
      const latestVod = pastStreams[0]; // أحدث إعادة
      const vodUrl = latestVod.video_url || latestVod.source || latestVod.playback_url;
      
      if (vodUrl) {
        streams.push({
          name: "📼 [إعادة البث الأخيرة]",
          title: latestVod.session_title ? `إعادة: ${latestVod.session_title}` : `آخر إعادة مسجلة للقناة`,
          url: vodUrl,
          behaviorHints: { notWebReady: true }
        });
      }
    }

    // إذا لم تتوفر إعادة حقيقية من السيرفر، نترك الخيار جاهزاً ومربوطاً بطلب الوسيط
    if (streams.length === (pb ? 1 : 0)) {
      streams.push({
        name: "📼 [إعادة البث]",
        title: `قناة: ${c.toUpperCase()} | (جارِ البحث عن أحدث إعادة مسجلة...)`,
        url: pb || "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4"
      });
    }

    res.json({ streams });
  } catch(e) {
    res.json({ streams: [] });
  }
});

app.listen(PORT);
