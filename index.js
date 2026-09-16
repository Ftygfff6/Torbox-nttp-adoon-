const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

/* -------------------------
   1. صفحة تعديل وإعدادات الإضافة
------------------------- */
app.get(["/", "/configure"], (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعدادات إضافة Kick</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0f0f11; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #1a1a1e; padding: 30px; border-radius: 16px; width: 90%; max-width: 440px; border: 1px solid #2a2a30; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
      h2 { color: #53fc18; margin-bottom: 8px; font-size: 22px; }
      p { font-size: 13px; color: #aaa; margin-bottom: 20px; line-height: 1.5; }
      .input-group { text-align: right; margin-bottom: 15px; }
      label { font-size: 13px; color: #ccc; display: block; margin-bottom: 6px; }
      textarea { width: 100%; padding: 12px; background: #0f0f11; border: 1px solid #333; color: #fff; border-radius: 8px; box-sizing: border-box; resize: vertical; min-height: 80px; font-family: inherit; }
      button { width: 100%; padding: 14px; background: #53fc18; border: none; color: #000; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; transition: 0.2s; }
      button:hover { background: #42cb12; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🟢 Kick Stremio Config</h2>
      <p>أدخل أسماء القنوات التي تتابعها في Kick (مفصولة بفواصل) لتظهر في كتالوج Stremio الخاص بك.</p>
      
      <div class="input-group">
        <label>أسماء القنوات (Usernames):</label>
        <textarea id="channels" placeholder="xqc, adinross, trainwreckstv"></textarea>
      </div>

      <button onclick="install()">تثبيت / تحديث الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const input = document.getElementById('channels').value.trim();
        if (!input) {
          alert("يرجى كتابة اسم قناة واحدة على الأقل!");
          return;
        }
        
        // تنظيف المدخلات وتحويلها إلى قائمة مفصولة
        const channelsList = input.split(',').map(c => c.trim().toLowerCase()).filter(Boolean).join(',');
        const encodedConfig = btoa(encodeURIComponent(channelsList));

        const manifestUrl = window.location.origin + '/' + encodedConfig + '/manifest.json';
        window.location.href = 'stremio://' + manifestUrl.replace(/^https?:\\/\\//, '');
      }
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

/* -------------------------
   2. Manifest الديناميكي
------------------------- */
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.custom.following",
    version: "1.3.0",
    name: "Kick - متابعاتك المباشرة",
    description: "بثوث وإعادات قنواتك المتابعة على منصة Kick",
    resources: ["catalog", "stream"],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: "kick_following",
        name: "قنوات Kick المتابعة"
      }
    ],
    idPrefixes: ["kick:"]
  });
});

/* -------------------------
   3. الكتالوج (Catalog) لعرض القنوات المتابعة
------------------------- */
app.get("/:config/catalog/tv/kick_following.json", (req, res) => {
  const { config } = req.params;

  try {
    const rawChannels = decodeURIComponent(Buffer.from(config, 'base64').toString('utf-8'));
    const channelArray = rawChannels.split(',').map(c => c.trim()).filter(Boolean);

    const metas = channelArray.map(channel => ({
      id: `kick:${channel}`,
      type: "tv",
      name: channel,
      poster: `https://ui-avatars.com/api/?name=${channel}&background=0D0E12&color=53FC18&size=512&bold=true`,
      description: `قناة ${channel} على منصة Kick`
    }));

    res.json({ metas });
  } catch (e) {
    res.json({ metas: [] });
  }
});

/* -------------------------
   4. Stream Handler (مباشر + إعادة)
------------------------- */
app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const { id } = req.params;

  if (!id.startsWith("kick:")) {
    return res.json({ streams: [] });
  }

  const channelName = id.replace("kick:", "").trim().toLowerCase();
  const streams = [];

  try {
    const channelRes = await axios.get(`https://kick.com/api/v1/channels/${channelName}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 4000
    }).catch(() => null);

    if (channelRes?.data) {
      const channelData = channelRes.data;

      // أ) خيار البث المباشر
      if (channelData.livestream && channelData.playback_url) {
        streams.push({
          name: "[🟢 KICK LIVE]",
          title: `مباشر الآن: ${channelData.user.username}\n🎮 ${channelData.livestream.session_title || 'بث مباشر'}`,
          url: channelData.playback_url
        });
      }

      // ب) خيار الإعادة (VOD)
      if (channelData.previous_livestreams && channelData.previous_livestreams.length > 0) {
        const latestVod = channelData.previous_livestreams[0];
        if (latestVod.video && latestVod.video.video_url) {
          streams.push({
            name: "[🎬 KICK REPLAY]",
            title: `إعادة أحدث بث: ${latestVod.session_title || 'البث المسجل'}\n📅 ${latestVod.created_at ? latestVod.created_at.split('T')[0] : 'سابق'}`,
            url: latestVod.video.video_url
          });
        }
      }
    }

    if (streams.length === 0) {
      streams.push({
        name: "[🔴 KICK OFFLINE]",
        title: `لا يوجد بث مباشر أو إعادة متاحة للقناة (${channelName}) حالياً`,
        externalUrl: `https://kick.com/${channelName}`
      });
    }

    return res.json({ streams });
  } catch (error) {
    console.error("Kick Stream Error:", error.message);
    return res.json({ streams: [] });
  }
});

/* -------------------------
   5. تشغيل السيرفر
------------------------- */
app.use((req, res) => {
  res.status(200).json({ streams: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 Kick Custom Addon running on port ${PORT}`);
});
