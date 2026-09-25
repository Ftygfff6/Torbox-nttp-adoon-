const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

// دالة مساعدة لتشفير/فك تشفير الإعدادات
const encodeConfig = (channels) => Buffer.from(encodeURIComponent(channels)).toString("base64");
const decodeConfig = (config) => decodeURIComponent(Buffer.from(config, "base64").toString("utf-8"));

// صفحة الإعداد
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>Kick Addon Setup</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2 style="color:#53fc18;">🟢 إعدادات إضافة Kick (بث مباشر + إعادات)</h2>
    <p>أدخل أسماء القنوات (مفصولة بفواصل):</p>
    <textarea id="ch" style="width:300px;height:80px;background:#151a1c;color:#53fc18;padding:10px;border:1px solid #53fc18;border-radius:6px;"></textarea><br><br>
    <button onclick="ins()" style="padding:10px 20px;background:#53fc18;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:6px;">تثبيت في التطبيق</button>
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

app.get("/configure", (req, res) => res.redirect("/"));

// المانيفست
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.direct.live.vod",
    version: "31.0.0",
    name: "Kick Live & Replays",
    description: "بث مباشر وإعادات قنوات Kick داخل Stremio",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [{ type: "tv", id: "kick_cat", name: "🟢 Kick Channels" }],
    idPrefixes: ["kick:"]
  });
});

// الكاتالوج
app.get("/:config/catalog/tv/kick_cat.json", (req, res) => {
  try {
    const channels = decodeConfig(req.params.config).split(",");
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `Kick: ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512`,
        description: `قناة ${c.toUpperCase()} على Kick`
      }))
    });
  } catch(e) { res.json({ metas: [] }); }
});

// الميتا
app.get("/:config/meta/tv/:id.json", (req, res) => {
  const c = req.params.id.replace("kick:", "");
  res.json({
    meta: {
      id: `kick:${c}`,
      type: "tv",
      name: `Kick: ${c.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512`
    }
  });
});

// الستريم (المباشر + الإعادات)
app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();
  const streams = [];

  try {
    // 1. جلب حالة البث المباشر
    const liveRes = await axios.get(`https://kick.com/api/v2/channels/${c}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 8000
    });
    const isLive = liveRes.data?.livestream !== null;
    const pb = liveRes.data?.playback_url;

    if (isLive && pb) {
      streams.push({
        name: "🟢 البث المباشر",
        title: `مباشر الآن | ${c.toUpperCase()}`,
        url: pb
      });
    }

    // 2. جلب الإعادات (VODs) - آخر 10 فيديوهات
    const vodRes = await axios.get(`https://kick.com/api/v2/channels/${c}/videos`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 8000
    });
    
    // الـ API يرجع مصفوفة مباشرة
    const vods = Array.isArray(vodRes.data) ? vodRes.data : (vodRes.data?.data || []);

    vods.slice(0, 10).forEach(v => {
      const vid = v.video || {};
      const uuid = vid.uuid;
      if (!uuid) return;

      // بناء رابط الإعادة يدوياً
      const watchUrl = `https://kick.com/${c}/videos/${uuid}`;
      const title = v.session_title || "بث سابق";
      const durationMin = v.duration ? Math.round(v.duration / 60000) : 0;
      const views = v.views || 0;

      streams.push({
        name: `📼 ${title.substring(0, 45)}...`,
        title: `⏱ ${durationMin} د | 👁 ${views} | ${new Date(v.created_at).toLocaleDateString('ar')}`,
        url: watchUrl
      });
    });

    res.json({ streams });
  } catch(e) {
    console.error(e.message);
    res.json({ streams: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Addon running on port ${PORT}`);
});
