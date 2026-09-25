const { parse } = require("m3u8-parser"); // تحتاج تسوي install

app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();
  const streams = [];

  try {
    // 1. المباشر
    const liveRes = await axios.get(`https://kick.com/api/v2/channels/${c}`, {
      headers: { "User-Agent": "Mozilla/5.0" }, timeout: 8000
    });
    const pb = liveRes.data?.playback_url;
    const isLive = liveRes.data?.livestream !== null;

    if (isLive && pb) {
      // 🔥 هنا التحليل: نجيب كل الجودات من ملف الـ M3U8
      const masterRes = await axios.get(pb, {
        headers: { "User-Agent": "Mozilla/5.0" }, timeout: 8000
      });
      
      const parser = new parse.Parser();
      parser.push(masterRes.data);
      parser.end();

      const variants = parser.manifest.playlists || [];
      
      // نرتب من الأعلى للأقل
      variants.sort((a, b) => (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0));

      variants.forEach((v, i) => {
        const attrs = v.attributes || {};
        const res = attrs.RESOLUTION || "";
        const bw = attrs.BANDWIDTH ? `${Math.round(attrs.BANDWIDTH / 1000)} kbps` : "";
        
        streams.push({
          name: `🟢 مباشر | ${res || `جودة ${i + 1}`}`,
          title: bw,
          url: v.uri ? new URL(v.uri, pb).href : pb
        });
      });
      
      // لو ما فيه variants، نرجع الرابط الأصلي
      if (variants.length === 0) {
        streams.push({ name: "🟢 البث المباشر", url: pb });
      }
    }

    // 2. الإعادات (نفس الفكرة لو تبي تجيب جوداتها)
    // بس VOD روابطها غالباً ما تكون M3U8 مباشر
    // نقدر نجرب نجيب master.m3u8 ونحللها بنفس الطريقة
    
  } catch(e) {
    console.error(e.message);
  }

  res.json({ streams });
});
