const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

app.get(["/", "/configure"], (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>Kick Live & VODs</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2>🟢 Kick Live & VODs Addon</h2>
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

app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.live.vods.guaranteed",
    version: "14.0.0",
    name: "Kick Live & VODs",
    description: "البث المباشر والإعادات المسجلة",
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
        description: `قناة ${c} - البث المباشر والإعادات`
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
      description: "اضغط لعرض البث المباشر وخيارات الإعادة المسجلة"
    }
  });
});

app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();
  const streams = [];

  try {
    // 1. جلب البث المباشر الأساسي
    const r = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 });
    const pb = r.data?.playback_url;
    
    if (pb) {
      streams.push({ name: "🟢 [LIVE AUTO]", title: `قناة: ${c.toUpperCase()} | البث المباشر الأساسي`, url: pb });
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
            if (u) streams.push({ name: `🟢 [LIVE ${h}p]`, title: `بث مباشر - جودة ${h}p`, url: u });
          }
        });
      } catch(err) {}
    }

    // 2. التحقق من وجود إعادات حقيقية، وإن لم توجد نضيف خيار إعادة توجيه يضمن ظهور خانة الإعادة
    const pastStreams = r.data?.previous_livestreams || [];
    if (pastStreams.length > 0) {
      pastStreams.forEach((vod, index) => {
        if (vod.video_url) {
          streams.push({
            name: `📼 [إعادة ${index + 1}]`,
            title: vod.session_title || `إعادة مسجلة رقم ${index + 1}`,
            url: vod.video_url
          });
        }
      });
    } else {
      // خيار إضافي يظهر للمستخدم ليؤكد أن النظام جاهز للإعادات فور توفرها من القناة
      streams.push({
        name: "📼 [إعادة البث]",
        title: `قناة: ${c.toUpperCase()} | (لا توجد إعادات مسجلة حالياً من المنصة)`,
        url: pb || "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4"
      });
    }

    res.json({ streams });
  } catch(e) {
    res.json({ streams: [] });
  }
});

app.listen(PORT);
