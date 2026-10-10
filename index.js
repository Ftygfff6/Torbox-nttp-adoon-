// ═══════════════════════════════════════════
// Stream - مباشر (طريقة HLS المباشرة)
// ═══════════════════════════════════════════
app.get("/:config/stream/tv/kick:channel.json", async (req, res) => {
  const c = req.params.channel.trim().toLowerCase();
  const config = decodeConfig(req.params.config);
  const selectedQuality = config.quality || "all";
  const streams = [];

  // جلب بيانات القناة
  const data = await fetchKickChannel(c);
  
  // إذا نجح جلب رابط البث من الـ API
  let masterUrl = data?.playback_url;

  // إذا فشل الـ API بسبب الحظر، نستخدم رابط الـ HLS المباشر للقناة
  if (!masterUrl) {
    masterUrl = `https://stream.kick.com/ivs/v1/160088099270/channel/${c}/m3u8/master.m3u8`;
  }

  try {
    const response = await fetch(masterUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://kick.com/",
        "Origin": "https://kick.com"
      }
    });

    if (response.ok) {
      const masterBody = await response.text();
      const parser = new Parser();
      parser.push(masterBody);
      parser.end();

      let variants = parser.manifest.playlists || [];
      variants.sort((a, b) => (b.attributes?.BANDWIDTH || 0) - (a.attributes?.BANDWIDTH || 0));

      variants.forEach((v) => {
        const attrs = v.attributes || {};
        const height = attrs.RESOLUTION ? `${attrs.RESOLUTION.height}` : "";
        const resolutionLabel = attrs.RESOLUTION ? `${attrs.RESOLUTION.height}p` : "تلقائي";
        const bandwidth = attrs.BANDWIDTH ? `${Math.round(attrs.BANDWIDTH / 1000)} kbps` : "";
        const streamUrl = v.uri ? new URL(v.uri, masterUrl).href : masterUrl;

        if (selectedQuality === "all" || height.includes(selectedQuality)) {
          streams.push({
            name: `🟢 Kick | ${resolutionLabel}`,
            title: bandwidth ? `📊 ${bandwidth}` : "بث مباشر",
            url: streamUrl,
            behaviorHints: {
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                  "Referer": "https://kick.com/",
                  "Origin": "https://kick.com"
                }
              }
            }
          });
        }
      });
    }
  } catch (e) {
    console.error("Stream fetch failed:", e.message);
  }

  // خيار احتياطي في حال لم تتعرف الإضافة على الجودات وكانت القناة أونلاين
  if (streams.length === 0) {
    streams.push({
      name: "🟢 Kick | بث مباشر",
      title: `قناة ${c.toUpperCase()}`,
      url: masterUrl,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: {
          request: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": "https://kick.com/",
            "Origin": "https://kick.com"
          }
        }
      }
    });
  }

  res.json({ streams });
});
