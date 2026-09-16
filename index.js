/* -------------------------
   5. Stream Handler (مضمون للإعادات والمباشر)
------------------------- */
app.get("/:config/stream/tv/:id.json", async (req, res) => {
  const { id } = req.params;
  if (!id.startsWith("kick:")) return res.json({ streams: [] });

  const channelName = id.replace("kick:", "").trim().toLowerCase();
  const streams = [];

  try {
    // 1. طلب بيانات البث المباشر للقناة
    const channelPromise = axios.get(`https://kick.com/api/v2/channels/${channelName}`, {
      headers: KICK_HEADERS,
      timeout: 4000
    }).catch(() => null);

    // 2. طلب قائمة الإعادات (VODs) بشكل منفصل ومباشر
    const vodsPromise = axios.get(`https://kick.com/api/v1/channels/${channelName}/videos`, {
      headers: KICK_HEADERS,
      timeout: 4000
    }).catch(() => null);

    const [channelRes, vodsRes] = await Promise.all([channelPromise, vodsPromise]);

    // أ) معالجة البث المباشر
    if (channelRes?.data?.livestream && channelRes.data.playback_url) {
      streams.push({
        name: "[🟢 KICK LIVE]",
        title: `مباشر الان: ${channelRes.data.livestream.session_title || 'بث مباشر'}\n👁️ المشاهدين: ${channelRes.data.livestream.viewer_count || 0}`,
        url: channelRes.data.playback_url
      });
    }

    // ب) معالجة الإعادات المسجلة (VODs)
    let vodsList = [];
    if (Array.isArray(vodsRes?.data)) {
      vodsList = vodsRes.data;
    } else if (channelRes?.data?.previous_livestreams) {
      vodsList = channelRes.data.previous_livestreams;
    }

    if (vodsList.length > 0) {
      // أخذ أحدث 5 إعادات مسجلة
      vodsList.slice(0, 5).forEach((vod, idx) => {
        const vodTitle = vod.session_title || vod.title || `إعادة رقم ${idx + 1}`;
        const vodDate = vod.created_at ? vod.created_at.split('T')[0] : '';
        
        // استخراج رابط التشغيل
        let playUrl = vod.source || vod.video?.video_url;

        if (playUrl && playUrl.endsWith('.m3u8')) {
          streams.push({
            name: `[🎬 REPLAY ${idx + 1}]`,
            title: `إعادة: ${vodTitle}\n📅 ${vodDate}`,
            url: playUrl
          });
        } else if (vod.slug || vod.id) {
          // رابط بديل في حال عدم توفر M3U8 مباشر
          const vodSlug = vod.slug || vod.id;
          streams.push({
            name: `[🎬 REPLAY ${idx + 1}]`,
            title: `إعادة: ${vodTitle}\n📅 ${vodDate}`,
            externalUrl: `https://kick.com/${channelName}?video=${vodSlug}`
          });
        }
      });
    }

    // ج) خيار احتياطي للمتصفح إذا لم يُعثر على شيء
    if (streams.length === 0) {
      streams.push({
        name: "[🔗 KICK WEB]",
        title: `فتح أرشيف قناة ${channelName} على موقع Kick`,
        externalUrl: `https://kick.com/${channelName}/videos`
      });
    }

    return res.json({ streams });

  } catch (error) {
    console.error(`Error loading streams for ${channelName}:`, error.message);
    return res.json({
      streams: [{
        name: "[🔗 KICK WEB]",
        title: `فتح قناة ${channelName} في المتصفح`,
        externalUrl: `https://kick.com/${channelName}`
      }]
    });
  }
});
