const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

/* -------------------------
   1. صفحة الإعدادات (Configure)
------------------------- */
app.get(["/", "/configure"], (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعدادات إضافة Kick Live + Chat</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0b0e0f; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
      .card { background: #151a1c; padding: 30px; border-radius: 16px; width: 90%; max-width: 460px; border: 1px solid #232b2e; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.6); }
      h2 { color: #53fc18; margin-bottom: 8px; font-size: 22px; }
      p { font-size: 13px; color: #aaa; margin-bottom: 20px; line-height: 1.5; }
      .input-group { text-align: right; margin-bottom: 15px; }
      label { font-size: 13px; color: #ccc; display: block; margin-bottom: 6px; }
      textarea { width: 100%; padding: 12px; background: #0b0e0f; border: 1px solid #333; color: #53fc18; border-radius: 8px; box-sizing: border-box; resize: vertical; min-height: 100px; font-family: monospace; font-size: 14px; direction: ltr; }
      button { width: 100%; padding: 14px; background: #53fc18; border: none; color: #000; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; }
      button:hover { background: #42cb12; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>🟢 Kick Live + Real-Time Chat</h2>
      <p>أدخل أسماء قنوات Kick (Usernames) مفصولة بفواصل:</p>
      
      <div class="input-group">
        <label>أسماء القنوات (Usernames):</label>
        <textarea id="channels" placeholder="bo3omar22, abu_abeer, streamer_name"></textarea>
      </div>

      <button onclick="install()">تثبيت الإضافة في Stremio</button>
    </div>

    <script>
      function install() {
        const input = document.getElementById('channels').value.trim();
        if (!input) {
          alert("يرجى كتابة اسم قناة واحدة على الأقل!");
          return;
        }
        
        const channelsList = input
          .split(/[,\\s\\n]+/)
          .map(c => c.trim().toLowerCase())
          .filter(Boolean)
          .join(',');

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
   2. Manifest
------------------------- */
app.get("/:config/manifest.json", (req, res) => {
  res.json({
    id: "org.kick.live.chat",
    version: "3.0.0",
    name: "Kick Live + Chat Feed",
    description: "بث مباشر لقنوات Kick مع إظهار شات المحادثة الحي داخل تفاصيل القناة",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [
      {
        type: "tv",
        id: "kick_chat_catalog",
        name: "🟢 Kick - البث والشات"
      }
    ],
    idPrefixes: ["kick:"]
  });
});

/* -------------------------
   3. Catalog
------------------------- */
app.get("/:config/catalog/tv/kick_chat_catalog.json", (req, res) => {
  const { config } = req.params;
  try {
    const rawChannels = decodeURIComponent(Buffer.from(config, 'base64').toString('utf-8'));
    const channelArray = rawChannels.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);

    const metas = channelArray.map(channel => ({
      id: `kick:${channel}`,
      type: "tv",
      name: `Kick: ${channel}`,
      poster: `https://ui-avatars.com/api/?name=${channel}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      description: `البث المباشر والشات الحي للقناة ${channel}`
    }));

    res.json({ metas });
  } catch (e) {
    res.json({ metas: [] });
  }
});

/* -------------------------
   4. Meta (سحب الشات المباشر وعرضه داخل الوصف)
------------------------- */
app.get("/:config/meta/tv/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("kick:")) return res.json({ meta: {} });

  const channelSlug = id.replace("kick:", "").trim().toLowerCase();
  let chatLogText = "💬 لا توجد رسائل شات حالية أو البث أوفلاين.";

  try {
    // 1. جلب بيانات القناة والـ Chatroom ID
    const channelRes = await axios.get(`https://kick.com/api/v2/channels/${channelSlug}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      },
      timeout: 4000
    });

    const chatroomId = channelRes.data?.chatroom?.id;

    // 2. جلب آخر رسائل الشات الحية
    if (chatroomId) {
      const chatRes = await axios.get(`https://kick.com/api/v2/chatrooms/${chatroomId}/messages`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json"
        },
        timeout: 4000
      });

      const messages = chatRes.data?.data?.messages || [];
      if (messages.length > 0) {
        const recentMessages = messages.slice(-10).map(m => `👤 ${m.sender.username}: ${m.content}`).join("\n");
        chatLogText = `💬 **أحدث رسائل الشات المباشر:**\n\n${recentMessages}`;
      }
    }
  } catch (e) {
    console.error("Chat Fetch Error:", e.message);
  }

  return res.json({
    meta: {
      id: `kick:${channelSlug}`,
      type: "tv",
      name: `Kick: ${channelSlug}`,
      poster: `https://ui-avatars.com/api/?name=${channelSlug}&background=0B0E0F&color=53FC18&size=512&bold=true`,
      background: `https://ui-avatars.com/api/?name=${channelSlug}&background=151A1C&color=53FC18&size=1024&bold=true`,
      description: `${chatLogText}\n\nاختر الجودة أدناه لبدء المشاهدة.`
    }
  });
});

/* -------------------------
   5. Stream Handler (الجودات المتعددة)
------------------------- */
app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("kick:")) return res.json({ streams: [] });

  const channelSlug = id.replace("kick:", "").trim().toLowerCase();

  try {
    const response = await axios.get(`https://kick.com/api/v2/channels/${channelSlug}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json"
      },
      timeout: 5000
    });

    const channelData = response.data;

    if (channelData && channelData.playback_url) {
      const isLive = channelData.livestream !== null;
      const streamTitle = isLive ? channelData.livestream.session_title : "القناة أوفلاين حالياً";
      const masterPlaylistUrl = channelData.playback_url;

      const streams = [];

      streams.push({
        name: "🟢 [KICK AUTO]",
        title: `جودة تلقائية\n${streamTitle}`,
        url: masterPlaylistUrl
      });

      try {
        const playlistRes = await axios.get(masterPlaylistUrl, { timeout: 4000 });
        const lines = playlistRes.data.split("\n");
        const baseUrl = masterPlaylistUrl.substring(0, masterPlaylistUrl.lastIndexOf("/") + 1);

        const extractedQualities = [];

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith("#EXT-X-STREAM-INF:")) {
            const line = lines[i];
            const nextLine = lines[i + 1] ? lines[i + 1].trim() : "";

            const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            const frameRateMatch = line.match(/FRAME-RATE=([\d\.]+)/);

            let qualityLabel = "HD/SD";
            let height = 0;

            if (resMatch) {
              const resParts = resMatch[1].split("x");
              height = parseInt(resParts[1], 10);
              const fps = frameRateMatch ? Math.round(parseFloat(frameRateMatch[1])) : 0;
              qualityLabel = `${height}p${fps > 30 ? fps : ""}`;
            }

            let streamLink = nextLine;
            if (!streamLink.startsWith("http")) {
              streamLink = baseUrl + streamLink;
            }

            extractedQualities.push({
              height: height,
              label: qualityLabel,
              url: streamLink
            });
          }
        }

        extractedQualities.sort((a, b) => b.height - a.height);

        extractedQualities.forEach(q => {
          streams.push({
            name: `🟢 [${q.label}]`,
            title: `${channelSlug.toUpperCase()} - جودة ${q.label}\n${streamTitle}`,
            url: q.url
          });
        });

      } catch (e) {
        console.error("Master Playlist Error:", e.message);
      }

      return res.json({ streams });
    }

    return res.json({ streams: [] });
  } catch (error) {
    console.error("Kick Fetch Error:", error.message);
    res.json({ streams: [] });
  }
});

/* -------------------------
   6. تشغيل الخادم
------------------------- */
app.use((req, res) => {
  res.status(200).json({ streams: [] });
});

app.listen(PORT, () => {
  console.log(`🚀 Kick Addon with Live Chat running on port ${PORT}`);
});
