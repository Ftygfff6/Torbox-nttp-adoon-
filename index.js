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
  <head><meta charset="UTF-8"><title>Kick Multi-View Addon</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2>🟢 إعدادات إضافة Kick (البث المزدوج - Multi-View)</h2>
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
    id: "org.kick.multiview",
    version: "21.0.0",
    name: "Kick Multi-View Live",
    description: "البث المباشر لقنوات Kick مع ميزة تقسيم الشاشة (بثين في وقت واحد)",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [{ type: "tv", id: "kick_multi_cat", name: "🟢 Kick Multi-View" }],
    idPrefixes: ["kick:"]
  });
});

app.get("/:config/catalog/tv/kick_multi_cat.json", (req, res) => {
  try {
    const channels = decodeURIComponent(Buffer.from(req.params.config, 'base64').toString('utf-8')).split(',');
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `Kick Multi: ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512`,
        description: `شاهد قناة ${c.toUpperCase()} مع خيار التقسيم المزدوج للبثوث.`
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
      name: `Kick Multi: ${c.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512`,
      description: "يحتوي على خيار البث الفردي وخيار تشغيل (بثين في شاشة واحدة / Multi-View)."
    }
  });
});

// صفحة البث المزدوج (Multi-View Web Player) التي تعرض بثين جنباً إلى جنب
app.get("/multiview/:ch1/:ch2", async (req, res) => {
  const { ch1, ch2 } = req.params;
  try {
    const r1 = await axios.get(`https://kick.com/api/v2/channels/${ch1}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 4000 });
    const r2 = await axios.get(`https://kick.com/api/v2/channels/${ch2}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 4000 });
    
    const url1 = r1.data?.playback_url || "";
    const url2 = r2.data?.playback_url || "";

    res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>Kick Multi-View: ${ch1} vs ${ch2}</title>
        <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
        <style>
          body { margin: 0; background: #000; color: #fff; font-family: sans-serif; display: flex; height: 100vh; overflow: hidden; }
          .pane { flex: 1; position: relative; border-right: 2px solid #222; display: flex; flex-direction: column; }
          video { width: 100%; height: 100%; object-fit: contain; background: #111; }
          .label { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: #53fc18; padding: 5px 10px; border-radius: 4px; font-weight: bold; z-index: 10; }
        </style>
      </head>
      <body>
        <div class="pane">
          <div class="label">🟢 ${ch1.toUpperCase()}</div>
          <video id="v1" controls autoplay muted></video>
        </div>
        <div class="pane">
          <div class="label">🟢 ${ch2.toUpperCase()}</div>
          <video id="v2" controls autoplay muted></video>
        </div>
        <script>
          function loadStream(vidId, url) {
            const video = document.getElementById(vidId);
            if (!url) return;
            if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = url;
            } else if (Hls.isSupported()) {
              const hls = new Hls();
              hls.loadSource(url);
              hls.attachMedia(video);
            }
          }
          loadStream('v1', '${url1}');
          loadStream('v2', '${url2}');
        </script>
      </body>
      </html>
    `);
  } catch(e) {
    res.send("<h3>عذراً، حدث خطأ أثناء جلب البثين المزدوجين. تأكد من أن القنوات تبث حالياً.</h3>");
  }
});

app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();
  const streams = [];

  try {
    const configStr = decodeURIComponent(Buffer.from(req.params.config, 'base64').toString('utf-8'));
    const channels = configStr.split(',').map(x => x.trim()).filter(Boolean);
    
    const r = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 });
    const pb = r.data?.playback_url;
    
    if (pb) {
      // 1. خيار البث الفردي العادي
      streams.push({ 
        name: "🟢 [بث فردي]", 
        title: `قناة: ${c.toUpperCase()} | البث المباشر`, 
        url: pb 
      });
    }

    // 2. خيار البث المزدوج (إذا كانت هناك قناة أخرى في القائمة نقوم بدمجها معها كشاشة مقسمة)
    if (channels.length > 1) {
      const secondChan = channels.find(x => x !== c) || channels[0];
      const host = req.get('host');
      const protocol = req.protocol;
      
      streams.push({
        name: "🔲 [شاشة مقسمة Multi-View]",
        title: `عرض ${c.toUpperCase()} بجانب ${secondChan.toUpperCase()} في نفس الشاشة`,
        url: `${protocol}://${host}/multiview/${c}/${secondChan}`,
        behaviorHints: { notWebReady: true }
      });
    }

    res.json({ streams });
  } catch(e) {
    res.json({ streams: [] });
  }
});

app.listen(PORT);
