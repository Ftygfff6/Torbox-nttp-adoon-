const { Parser } = require("m3u8-parser"); // ✅ التصحيح هنا

app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const c = req.params.id.replace("kick:", "").trim();
  const streams = [];

  try {
    // ═══════════════════════════════════════
    // 1. البث المباشر مع كل الجودات
    // ═══════════════════════════════════════
    const liveRes = await axios.get(`https://kick.com/api/v2/channels/${c}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 8000
    });
    
    const pb = liveRes.data?.playback_url;
    const isLive = liveRes.data?.livestream !== null;

    if (isLive && pb) {
      try {
        const masterRes = await axios.get(pb, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          timeout: 8000
        });
        
        const parser = new Parser(); // ✅ التصحيح هنا
        parser.push(masterRes.data);
        parser.end();

        const variants = parser.manifest.playlists || [];
        
        // نرتب من الأعلى للأقل
        variants.sort((a, b) => (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0));

        if (variants.length > 0) {
          variants.forEach((v, i) => {
            const attrs = v.attributes || {};
            const resolution = attrs.RESOLUTION || "";
            const bandwidth = attrs.BANDWIDTH ? `${Math.round(attrs.BANDWIDTH / 1000)} kbps` : "";
            
            streams.push({
              name: `🟢 مباشر | ${resolution || `جودة ${i + 1}`}`,
              title: bandwidth,
              url: v.uri ? new URL(v.uri, pb).href : pb
            });
          });
        } else {
          streams.push({ name: "🟢 البث المباشر", url: pb });
        }
      } catch (e) {
        console.error("Live m3u8 parse error:", e.message);
        streams.push({ name: "🟢 البث المباشر", url: pb });
      }
    }

    // ═══════════════════════════════════════
    // 2. الإعادات (VODs)
    // ═══════════════════════════════════════
    try {
      const vodRes = await axios.get(
        `https://kick.com/api/v2/channels/${c}/videos`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          timeout: 8000
        }
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
        
        // رابط الإعادة (m3u8)
        const vodUrl = `https://stream.kick.com/${uuid}/media/hls/master.m3u8`;
        
        streams.push({
          name: `📼 ${title.substring(0, 45)}`,
          title: `⏱ ${durationMin} دقيقة | 👁 ${views.toLocaleString()} مشاهد${createdAt ? `\n📅 ${new Date(createdAt).toLocaleDateString("ar")}` : ""}`,
          url: vodUrl
        });
      });
    } catch (e) {
      console.error("VOD fetch error:", e.message);
    }

  } catch(e) {
    console.error("Main error:", e.message);
  }

  res.json({ streams });
});
