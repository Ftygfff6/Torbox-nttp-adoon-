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
    id: "org.kick.live.vod.v5",
    version: "36.0.0",
    name: "Kick Live & Replays 🟢",
    description: "بث مباشر وإعادات قنوات Kick مع اختيار الجودة يدوياً",
    logo: "https://kick.com/favicon.ico",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: "kick_live_cat",
        name: "🟢 Kick مباشر"
      },
      {
        type: "tv",
        id: "kick_vod_cat",
        name: "📼 Kick إعادات"
      }
    ],
    idPrefixes: ["kick:", "kickvod:"]
  });
});

// ═══════════════════════════════════════════
// Catalog - البث المباشر
// ═══════════════════════════════════════════
app.get("/:config/catalog/tv/kick_live_cat.json", (req, res) => {
  try {
    const channelsStr = decodeConfig(req.params.config);
    const channels = channelsStr.split(",").filter(Boolean);
    
    res.json({
      metas: channels.map(c => ({
        id: `kick:${c}`,
        type: "tv",
        name: `🔴 مباشر: ${c.toUpperCase()}`,
        poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
        description: `البث المباشر لقناة ${c.toUpperCase()}`
      }))
    });
  } catch (e) {
    res.json({ metas: [] });
  }
});

// ═══════════════════════════════════════════
// Catalog - الإعادات
// ═══════════════════════════════════════════
app.get("/:config/catalog/tv/kick_vod_cat.json", async (req, res) => {
  try {
    const channelsStr = decodeConfig(req.params.config);
    const channels = channelsStr.split(",").filter(Boolean);
    const allVods = [];

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": "https://kick.com/",
      "Origin": "https://kick.com"
    };

    for (const c of channels) {
      try {
        const vodRes = await axios.get(
          `https://kick.com/api/v2/channels/${c}/videos`,
          { headers, timeout: 8000 }
        );

        const vods = Array.isArray(vodRes.data) ? vodRes.data : (vodRes.data?.data || []);
        
        vods.slice(0, 20).forEach(v => {
          const uuid = v.video?.uuid || v.uuid;
          if (!uuid) return;

          const title = v.session_title || v.video?.session_title || "بث سابق";
          const createdAt = v.created_at || v.video?.created_at;
          const durationMs = v.duration || v.video?.duration || 0;
          const durationMin = Math.round(durationMs / 60000);
          const views = v.views || v.video?.views || 0;

          allVods.push({
            id: `kickvod:${c}:${uuid}`,
            type: "tv",
            name: `📼 ${c.toUpperCase()}: ${title.substring(0, 40)}`,
            poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
            description: `⏱ ${durationMin} دقيقة | 👁 ${views.toLocaleString()} | 📅 ${createdAt ? new Date(createdAt).toLocaleDateString("ar") : ""}`
          });
        });
      } catch (e) {
        console.error(`VOD fetch failed for ${c}:`, e.message);
      }
    }

    res.json({ metas: allVods });
  } catch (e) {
    res.json({ metas: [] });
  }
});

// ═══════════════════════════════════════════
// Meta - البث المباشر
// ═══════════════════════════════════════════
app.get("/:config/meta/tv/kick:channel.json", (req, res) => {
  const c = req.params.channel;
  res.json({
    meta: {
      id: `kick:${c}`,
      type: "tv",
      name: `🔴 ${c.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      description: `البث المباشر لقناة ${c.toUpperCase()}`
    }
  });
});

// ═══════════════════════════════════════════
// Meta - الإعادات
// ═══════════════════════════════════════════
app.get("/:config/meta/tv/kickvod:channel:uuid.json", (req, res) => {
  const { channel, uuid } = req.params;
  res.json({
    meta: {
      id: `kickvod:${channel}:${uuid}`,
      type: "tv",
      name: `📼 إعادة: ${channel.toUpperCase()}`,
      poster: `https://ui-avatars.com/api/?name=${channel}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      description: `إعادة بث لقناة ${channel.toUpperCase()}`
    }
  });
});

// ═══════════════════════════════════════════
// Stream - البث المباشر
// ═══════════════════════════════════════════
app.get("/:config/stream/tv/kick:channel.json", async (req, res) => {
  const c = req.params.channel.trim().toLowerCase();
  const streams = [];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://kick.com/",
    "Origin": "https://kick.com"
  };

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
          variants.forEach((v) => {
            const attrs = v.attributes || {};
            const resolution = attrs.RESOLUTION ? `${attrs.RESOLUTION.height}p` : "جودة غير معروفة";
            const bandwidth = attrs.BANDWIDTH ? `${Math.round(attrs.BANDWIDTH / 1000)} kbps` : "";
            const streamUrl = v.uri ? new URL(v.uri, pb).href : pb;

            streams.push({
              name: `🟢 مباشر | ${resolution}`,
              title: `${bandwidth} | 👁 ${viewers.toLocaleString()} مشاهد`,
              url: streamUrl,
              behaviorHints: {
                notWebReady: true,
                proxyHeaders: {
                  request: { "Referer": "https://kick.com/", "Origin": "https://kick.com" }
                }
              }
            });
          });
        }
      } catch (e) {
        console.error("m3u8 parse failed:", e.message);
      }
    }
  } catch (e) {
    console.error("Live fetch failed:", e.message);
  }

  res.json({ streams });
});

// ═══════════════════════════════════════════
// Stream - الإعادات
// ═══════════════════════════════════════════
app.get("/:config/stream/tv/kickvod:channel:uuid.json", async (req, res) => {
  const { channel, uuid } = req.params;
  const streams = [];

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://kick.com/",
    "Origin": "https://kick.com"
  };

  // رابط الإعادات الرسمي (سيتم جلبه من الـ API)
  let vodMaster = null;

  try {
    // جلب تفاصيل الإعادات للحصول على رابط المصدر (source)
    const vodInfoRes = await axios.get(
      `https://kick.com/api/v2/video/${uuid}`,
      { headers, timeout: 8000 }
    );
    
    // الرابط موجود في حقل source
    vodMaster = vodInfoRes.data?.source || null;
  } catch (e) {
    console.error("Failed to fetch VOD info, trying default:", e.message);
  }

  // إذا فشل جلب الرابط الرسمي، نستخدم الرابط الافتراضي كاحتياط
  if (!vodMaster) {
    vodMaster = `https://stream.kick.com/${uuid}/media/hls/master.m3u8`;
  }

  try {
    const masterRes = await axios.get(vodMaster, { headers, timeout: 8000 });
    const parser = new Parser();
    parser.push(masterRes.data);
    parser.end();

    const variants = parser.manifest.playlists || [];
    variants.sort((a, b) => (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0));

    if (variants.length > 0) {
      variants.forEach((v) => {
        const attrs = v.attributes || {};
        const resolution = attrs.RESOLUTION ? `${attrs.RESOLUTION.height}p` : "جودة غير معروفة";
        const streamUrl = v.uri ? new URL(v.uri, vodMaster).href : vodMaster;

        streams.push({
          name: `📼 إعادة | ${resolution}`,
          title: `قناة ${channel.toUpperCase()} | (جودة مثبتة)`,
          url: streamUrl,
          behaviorHints: {
            notWebReady: true,
            proxyHeaders: {
              request: { "Referer": "https://kick.com/", "Origin": "https://kick.com" }
            }
          }
        });
      });
    } else {
      streams.push({
        name: "📼 الإعادة",
        url: vodMaster,
        behaviorHints: {
          notWebReady: true,
          proxyHeaders: {
            request: { "Referer": "https://kick.com/", "Origin": "https://kick.com" }
          }
        }
      });
    }
  } catch (e) {
    console.error("VOD stream failed:", e.message);
    streams.push({
      name: "📼 الإعادة (رابط مباشر)",
      url: vodMaster,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: {
          request: { "Referer": "https://kick.com/", "Origin": "https://kick.com" }
        }
      }
    });
  }

  res.json({ streams });
});

// ═══════════════════════════════════════════
// تشغيل السيرفر
// ═══════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`🟢 Kick Addon running on port ${PORT}`);
});
