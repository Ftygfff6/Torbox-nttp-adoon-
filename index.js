app.get("/:config/stream/tv/kick:channel.json", async (req, res) => {
  const c = req.params.channel.trim().toLowerCase();
  const streams = [];

  // رابط الـ HLS المباشر للقناة (لا يحتاج API ولا يتعرض للحظر السريع)
  const masterUrl = `https://stream.kick.com/ivs/v1/160088099270/channel/${c}/m3u8/master.m3u8`;

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Referer": "https://kick.com/",
      "Origin": "https://kick.com"
    };

    const m3u8Res = await fetch(masterUrl, { headers, timeout: 8000 });
    
    if (m3u8Res.ok) {
      const masterBody = await m3u8Res.text();
      const parser = new Parser();
      parser.push(masterBody);
      parser.end();

      let variants = parser.manifest.playlists || [];
      
      // ترتيب الجودات من الأعلى للأقل دقة
      variants.sort((a, b) => {
        const resA = a.attributes?.RESOLUTION?.height || 0;
        const resB = b.attributes?.RESOLUTION?.height || 0;
        if (resB !== resA) return resB - resA;
        return (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0);
      });

      // 1. خيار التلقائي (Auto)
      streams.push({
        name: `🟢 Kick | تلقائي (Auto)`,
        title: `بث مباشر: ${c.toUpperCase()}`,
        url: masterUrl,
        behaviorHints: {
          notWebReady: true,
          proxyHeaders: {
            request: {
              "User-Agent": "Mozilla/5.0",
              "Referer": "https://kick.com/",
              "Origin": "https://kick.com"
            }
          }
        }
      });

      // 2. الجودات المتاحة مرتبة
      variants.forEach((v) => {
        const attrs = v.attributes || {};
        const height = attrs.RESOLUTION ? `${attrs.RESOLUTION.height}p` : "مخصص";
        const bandwidth = attrs.BANDWIDTH ? `${Math.round(attrs.BANDWIDTH / 1000)} kbps` : "";
        const streamUrl = v.uri ? new URL(v.uri, masterUrl).href : masterUrl;

        streams.push({
          name: `🟢 Kick | ${height}`,
          title: bandwidth ? `📊 ${bandwidth} | بث مباشر` : `بث مباشر`,
          url: streamUrl,
          behaviorHints: {
            notWebReady: true,
            proxyHeaders: {
              request: {
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://kick.com/",
                "Origin": "https://kick.com"
              }
            }
          }
        });
      });
    }
  } catch (e) {
    console.error("Direct HLS fetch error:", e.message);
  }

  // إذا لم يتم جلب الجودات، نضع رابطاً مباشراً احتياطياً لضمان عدم ظهور "لا توجد نتائج"
  if (streams.length === 0) {
    streams.push({
      name: `🟢 Kick | بث مباشر (رابط احتياطي)`,
      title: `قناة ${c.toUpperCase()}`,
      url: masterUrl,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: {
          request: {
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://kick.com/",
            "Origin": "https://kick.com"
          }
        }
      }
    });
  }

  res.json({ streams });
});
