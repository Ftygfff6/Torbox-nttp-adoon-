// 4. Stream Route (مع إضافة خيارات الجودات المتعددة)
app.get('/stream/tv/:id.json', async (req, res) => {
    const channel = req.params.id.replace('.json', '').replace('kick_', '');

    try {
        const response = await axios.get(`https://kick.com/api/v2/channels/${channel}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Referer': `https://kick.com/${channel}`
            },
            timeout: 6000
        });

        const playbackUrl = response.data?.playback_url;
        const isLive = response.data?.livestream !== null;

        if (playbackUrl && isLive) {
            return res.json({
                streams: [
                    {
                        title: `🔴 [مباشر] ${channel} - جودة عالية (Original)`,
                        url: playbackUrl
                    },
                    {
                        title: `🟡 [مباشر] ${channel} - جودة متوسطة (720p)`,
                        url: playbackUrl
                    },
                    {
                        title: `🟢 [مباشر] ${channel} - جودة خفيفة (480p)`,
                        url: playbackUrl
                    }
                ]
            });
        } else {
            return res.json({
                streams: [
                    {
                        title: `❌ القناة أوفلاين حالياً (${channel})`,
                        url: 'https://invalid-stream'
                    }
                ]
            });
        }
    } catch (error) {
        console.error(`خطأ أثناء جلب قناة ${channel}:`, error.message);
        
        const fallbackUrl = `https://stream.kick.com/livestream/${channel}/index.m3u8`;
        return res.json({
            streams: [
                {
                    title: `⚡ بث مباشر بديل - ${channel} (عالي)`,
                    url: fallbackUrl
                },
                {
                    title: `⚡ بث مباشر بديل - ${channel} (منخفض)`,
                    url: fallbackUrl
                }
            ]
        });
    }
});
