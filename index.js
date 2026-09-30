const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { Parser } = require("m3u8-parser");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

// ═══════════════════════════════════════════
// الصفحة الرئيسية
// ═══════════════════════════════════════════
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>Kick Addon</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2 style="color:#53fc18;">🟢 إعدادات إضافة Kick</h2>
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

// ═══════════════════════════════════════════
// دالة مساعدة لفك التشفير
// ═══════════════════════════════════════════
function decodeConfig(config) {
  try {
    return decodeURIComponent(Buffer.from(config, "base64").toString("utf-8"));
  } catch (e) {
    return "";
  }
}

// ═══════════════════════════════════════════
// Manifest
// ═══════════════════════════════════════════
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.live.vod.v2",
    version: "33.0.0",
    name: "Kick Live & Replays 🟢",
    description: "بث مباشر وإعادات قنوات Kick مع اختيار الجودة يدوياً",
    logo: "https://kick.com/favicon.ico",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: "kick_direct_cat",
        name: "🟢 Kick Direct"
      }
    ],
    idPrefixes: ["kick:"]
  });
});

// ═══════════════════════════════════════════
// Catalog
// ═══════════════════════════════════════════
app.get("/:config/catalog/tv/kick_direct_cat.json", (req, res) => {
  try {
    const channelsStr = decodeConfig(req.params.config);
    const channels = channelsStr.split(",").filter(Boolean);
    
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `Kick: ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
        description: `قناة ${c.toUpperCase()} على Kick`
      }))
    });
  } catch (e) {
    res.json({ metas: [] });
  }
});

// ═══════════════════════════════════════════
// Meta
// ═══════════════════════════════════════════
app.get("/:config/meta/tv/:id.json", (req, res) => {
  const c = req.params.id.replace("kick:", "");
  res.json({
    meta: {
      id: `kick:${c}`,
      type: "tv",
      name: `Kick: ${c.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      description: `قناة ${c.toUpperCase()} على Kick`
    }
  });
});

// ═══════════════════════════════════════════
// Stream (بث مباشر + جودات + إعادات)
// ═══════════════════════════════════════════
app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim().toLowerCase();
  const streams = [];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://kick.com/"
  };

  // ═══ 1. البث المباشر مع كل الجودات ═══
  try {
    const liveRes = await axios.get(
      `https://kick.com/api/v2/channels/${c}`,
      { headers, timeout: 8000 }
    );

    const pb = liveRes.data?.playback_url;
    const isLive = liveRes.data?.livestream !== null && liveRes.data?.livestream !== undefined;
    const viewers = liveRes.data?.livestream?.viewer_count || 0;

    if (isLive && pb) {
      try {
        const masterRes = await axios.get(pb, { headers, timeout: 8000 });
        const parser = new Parser();
        parser.push(masterRes.data);
        parser.end();

        const variants = parser.manifest.playlists || [];
        variants.sort((a, b) => (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0));

        if (variants.length > 0) {
          variants.forEach((v, i) => {
            const attrs = v.attributes || {};
            const resolution = attrs.RESOLUTION || `${i + 1}`;
            const bandwidth = attrs.BANDWIDTH ? `${Math.round(attrs.BANDWIDTH / 1000)} kbps` : "";
            
            streams.push({
              name: `🟢 مباشر | ${resolution}`,
              title: `${bandwidth} | 👁 ${viewers.toLocaleString()} مشاهد`,
              url: v.uri ? new URL(v.uri, pb).href : pb
            });
          });
        } else {
          streams.push({
            name: "🟢 البث المباشر",
            title: `👁 ${viewers.toLocaleString()} مشاهد`,
            url: pb
          });
        }
      } catch (e) {
        console.error("m3u8 parse failed:", e.message);
        streams.push({ name: "🟢 البث المباشر", url: pb });
      }
    }
  } catch (e) {
    console.error("Live fetch failed:", e.message);
  }

  // ═══ 2. الإعادات (VODs) ═══
  try {
    const vodRes = await axios.get(
      `https://kick.com/api/v2/channels/${c}/videos`,
      { headers, timeout: 8000 }
    );

    const vods = Array.isArray(vodRes.data)
      ? vodRes.data
      : (vodRes.data?.data || []);

    vods.slice(0, 15).forEach(v => {
      const uuid = v.video?.uuid || v.uuid;
      if (!uuid) return;

      const title = v.session_title || v.video?.session_title || "بث سابق";
      const durationMs = v.duration || v.video?.duration || 0;
      const durationMin = Math.round(durationMs / 60000);
      const views = v.views || v.video?.views || 0;
      const createdAt = v.created_at || v.video?.created_at;

      const vodUrl = `https://stream.kick.com/${uuid}/media/hls/master.m3u8`;

      streams.push({
        name: `📼 ${title.substring(0, 45)}`,
        title: `⏱ ${durationMin} د | 👁 ${views.toLocaleString()}${createdAt ? ` | 📅 ${new Date(createdAt).toLocaleDateString("ar")}` : ""}`,
        url: vodUrl
      });
    });
  } catch (e) {
    console.error("VOD fetch failed:", e.message);
  }

  res.json({ streams });
});

// ═══════════════════════════════════════════
// تشغيل السيرفر
// ═══════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`🟢 Kick Addon running on port ${PORT}`);
});
