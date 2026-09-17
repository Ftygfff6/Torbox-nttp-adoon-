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
  <head><meta charset="UTF-8"><title>Kick VODs Addon</title></head>
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
    id: "org.kick.vods.fixed",
    version: "12.0.0",
    name: "Kick Live & VODs",
    description: "بث مباشر وإعادات قنوات Kick",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [
      { type: "tv", id: "kick_live_cat", name: "🟢 Kick - البث المباشر" },
      { type: "tv", id: "kick_vods_cat", name: "📼 Kick - الإعادات المسجلة" }
    ],
    idPrefixes: ["kick:"]
  });
});

app.get("/:config/catalog/tv/:id.json", async (req, res) => {
  const { config, id } = req.params;
  try {
    const channels = decodeURIComponent(Buffer.from(config, 'base64').toString('utf-8')).split(',');
    const metas = [];

    for (const c of channels) {
      try {
        const r = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 4000 });
        
        if (id === "kick_vods_cat") {
          const pastStreams = r.data?.previous_livestreams || [];
          if (pastStreams.length > 0) {
            pastStreams.forEach((vod, idx) => {
              metas.push({
                id: `kick_vod:${c}:${vod.id || idx}`,
                type: "tv",
                name: `${c.toUpperCase()} (إعادة)`,
                poster: vod.thumbnail?.url || `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18`,
                description: vod.session_title || 'إعادة بث مسجلة'
              });
            });
          }
        } else {
          metas.push({
            id: `kick:${c}`,
            type: "tv",
            name: `Kick Live: ${c}`,
            poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18`,
            description: `بث مباشر لقناة ${c}`
          });
        }
      } catch (err) {}
    }

    res.json({ metas });
  } catch(e) { 
    res.json({ metas: [] }); 
  }
});

app.get("/:config/meta/tv/:id.json", async (req, res) => {
  const id = req.params.id;
  
  if (id.startsWith("kick_vod:")) {
    const parts = id.split(":");
    const c = parts[1];
    return res.json({
      meta: {
        id: id,
        type: "tv",
        name: `${c.toUpperCase()} - إعادة بث`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18`,
        description: "عرض إعادات البث المسجلة من Kick"
      }
    });
  }

  const c = id.replace("kick:", "");
  res.json({ 
    meta: { 
      id: `kick:${c}`, 
      type: "tv", 
      name: `Kick Live: ${c}`, 
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18` 
    } 
  });
});

app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const id = req.params.id;

  if (id.startsWith("kick_vod:")) {
    const parts = id.split(":");
    const c = parts[1];
    const vodId = parts[2];

    try {
      const r = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 });
      const pastStreams = r.data?.previous_livestreams || [];
      const targetVod = pastStreams.find(v => String(v.id) === String(vodId)) || pastStreams[0];

      if (targetVod && targetVod.video_url) {
        return res.json({
          streams: [{
            name: "📼 [Kick VOD]",
            title: `إعادة: ${targetVod.session_title || c}`,
            url: targetVod.video_url
          }]
        });
      }
    } catch (e) {}

    return res.json({ streams: [] });
  }

  const c = id.replace("kick:", "").trim();
  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 });
    const pb = r.data?.playback_url;
    if (!pb) return res.json({ streams: [] });

    const streams = [{ name: "🟢 [KICK AUTO]", title: `قناة: ${c.toUpperCase()} | البث المباشر`, url: pb }];

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
          if (u) streams.push({ name: `🟢 [${h}p]`, title: `جودة ${h}p | قناة: ${c.toUpperCase()}`, url: u });
        }
      });
    } catch(err) {}

    res.json({ streams });
  } catch(e) {
    res.json({ streams: [] });
  }
});

app.listen(PORT);
