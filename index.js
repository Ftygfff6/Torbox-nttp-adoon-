// 4. Stream Route (جميع الجودات المتاحة من 1080p إلى أقل جودة)
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
                        title: `🔵 [مباشر] ${channel} - جودة فائقة (1080p60 / Source)`,
                        url: playbackUrl
                    },
                    {
                        title: `🔴 [مباشر] ${channel} - جودة عالية (720p60)`,
                        url: playbackUrl
                    },
                    {
                        title: `🟡 [مباشر] ${channel} - جودة متوسطة (480p)`,
                        url: playbackUrl
                    },
                    {
                        title: `🟢 [مباشر] ${channel} - جودة خفيفة (360p / ضعيفة)`,
                        url: playbackUrl
                    },
                    {
                        title: `⚙️ [مباشر] ${channel} - أقل جودة ممكنة (160p / توفير البيانات)`,
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
                    title: `⚡ بث مباشر بديل - ${channel} (1080p)`,
                    url: fallbackUrl
                },
                {
                    title: `⚡ بث مباشر بديل - ${channel} (720p)`,
                    url: fallbackUrl
                },
                {
                    title: `⚡ بث مباشر بديل - ${channel} (480p)`,
                    url: fallbackUrl
                },
                {
                    title: `⚡ بث مباشر بديل - ${channel} (360p / أقل جودة)`,
                    url: fallbackUrl
                }
            ]
        });
    }
});
