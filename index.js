const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

// تخزين مؤقت لرسائل الشات لكل قناة
const chatCache = {};

// دالة لجلب شات Kick وتحويله إلى صيغة WebVTT للترجمة
async function fetchChatAsSubtitles(channel) {
  try {
    // جلب معلومات القناة لمعرفة معرف غرفة الشات (chatroom id)
    const r = await axios.get(`https://kick.com/api/v2/channels/${channel}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 4000 });
    const chatroomId = r.data?.chatroom?.id;
    if (!chatroomId) return "WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\n[لا يوجد شات متاح حالياً]";

    // جلب آخر الرسائل من روم الشات
    const chatRes = await axios.get(`https://kick.com/api/v2/chatrooms/${chatroomId}/messages`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 4000 });
    const messages = chatRes.data?.data?.messages || [];

    let vtt = "WEBVTT\n\n";
    let startTime = 0;

    if (messages.length === 0) {
      vtt += "1\n00:00:00.000 --> 00:10:00.000\n[انتظار رسائل الشات...]\n\n";
    } else {
      messages.slice(-15).forEach((msg, index) => {
        const user = msg.sender?.username || "مستخدم";
        const text = msg.content || "";
        const timeSec = index * 3; // توزيع الرسائل زمنياً
        const start = formatTime(timeSec);
        const end = formatTime(timeSec + 4);
        
        vtt += `${index + 1}\n${start} --> ${end}\n${user}: ${text}\n\n`;
      });
    }

    return vtt;
  } catch (e) {
    return "WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\n[خطأ في جلب الشات]";
  }
}

function formatTime(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}.000`;
}

app.get(["/", "/configure"], (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>Kick Chat Addon</title></head>
  <body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2>🟢 Kick Chat Subtitles Addon</h2>
    <p>أدخل أسماء قنوات Kick لعرض الشات كترجمة:</p>
    <textarea id="ch" style="width:300px;height:80px;background:#151a1c;color:#53fc18;padding:10px;"></textarea><br><br>
    <button onclick="ins()" style="padding:10px 20px;background:#53fc18;border:none;font-weight:bold;cursor:pointer;">تثبيت في Stremio</button>
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
    id: "org.kick.chat.subtitles",
    version: "8.0.0",
    name: "Kick Chat as Subtitles",
    description: "بث مباشر مع شات يظهر كترجمة في Stremio",
    resources: ["catalog", "meta", "stream", "subtitles"],
    types: ["tv"],
    catalogs: [{ type: "tv", id: "kick_cat", name: "🟢 Kick Chat Live" }],
    idPrefixes: ["kick:"]
  });
});

app.get("/:config/catalog/tv/kick_cat.json", (req, res) => {
  try {
    const channels = decodeURIComponent(Buffer.from(req.params.config, 'base64').toString('utf-8')).split(',');
    res.json({ metas: channels.map(c => ({ id: `kick:${c}`, type: "tv", name: `Kick: ${c}`, poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18` })) });
  } catch(e) { res.json({ metas: [] }); }
});

app.get("/:config/meta/tv/:id.json", (req, res) => {
  const c = req.params.id.replace("kick:", "");
  res.json({ meta: { id: `kick:${c}`, type: "tv", name: `Kick: ${c}`, poster: `https://ui-avatars.com/api/?name=${c}&background=0B0E0F&color=53FC18` } });
});

// نقطة نهاية خاصة لتزويد Stremio بملف الترجمة (الشات)
app.get("/:config/subtitles/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();
  const vttData = await fetchChatAsSubtitles(c);
  
  res.json({
    subtitles: [
      {
        id: `chat_${c}`,
        url: `data:text/vtt;base64,${Buffer.from(vttData).toString('base64')}`,
        lang: "ara",
        name: "💬 شات Kick (مباشر)"
      }
    ]
  });
});

app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();

  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/${c}`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 });
    const pb = r.data?.playback_url;
    if (!pb) return res.json({ streams: [] });

    const streams = [{ 
      name: "🟢 [KICK CHAT]", 
      title: `قناة: ${c.toUpperCase()} | (فعّل الترجمة لرؤية الشات)`, 
      url: pb,
      behaviorHints: { notWebReady: true }
    }];

    try {
      const pRes = await axios.get(pb, { timeout: 3000 });
      const lines = pRes.data.split("\n");
      const base = pb.substring(0, pb.lastIndexOf("/") + 1);
      
      lines.forEach((l, i) => {
        if (l.startsWith("#EXT-X-STREAM-INF:")) {
          const resM = l.match(/RESOLUTION=(\d+x\d+)/);
          const h = resM ? resM.1.split("x")[1] : "HD";
          let u = lines[i+1]?.trim();
          if (u && !u.startsWith("http")) u = base + u;
          if (u) {
            streams.push({ 
              name: `🟢 [${h}p]`, 
              title: `جودة ${h}p | (فعّل الترجمة لرؤية الشات)`, 
              url: u,
              behaviorHints: { notWebReady: true }
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
