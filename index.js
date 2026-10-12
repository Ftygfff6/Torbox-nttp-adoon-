const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const CHANNELS = [
    { id: "We11y", name: "We11y" },
    { id: "ogabdullah", name: "ogabdullah" },
    { id: "TheWitty21", name: "TheWitty21" },
    { id: "PLAYAWAY", name: "PLAYAWAY" },
    { id: "abu_abeer16", name: "abu_abeer16" },
    { id: "ko3ib", name: "ko3ib" },
    { id: "LLE", name: "LLE" },
    { id: "ibrahim_dos", name: "ibrahim_dos" },
    { id: "Aziz", name: "Aziz" }
 { id: "Abo_Fawzi18", name: "Abo_Fawzi18" }
];

app.get('/manifest.json', (req, res) => {
    res.json({
        "id": "org.faisal.kickaddon",
        "version": "1.0.0",
        "name": "Kick Live - Faisal",
        "description": "إضافة قنوات كيك المباشرة المخصصة",
        "resources": ["catalog", "meta", "stream"],
        "types": ["tv"],
        "catalogs": [
            {
                "type": "tv",
                "id": "kick_catalog",
                "name": "🔴 قنوات كيك المباشرة"
            }
        ],
        "idPrefixes": ["kick_"]
    });
});

app.get('/catalog/tv/kick_catalog.json', (req, res) => {
    const metas = CHANNELS.map(ch => ({
        id: `kick_${ch.id}`,
        type: 'tv',
        name: ch.name,
        poster: 'https://kick.com/favicon.ico',
        posterShape: 'square',
        description: `بث مباشر لقناة ${ch.name} على Kick`
    }));
    res.json({ metas });
});

app.get('/meta/tv/:id.json', (req, res) => {
    const cleanId = req.params.id.replace('.json', '').replace('kick_', '');
    res.json({
        meta: {
            id: `kick_${cleanId}`,
            type: 'tv',
            name: cleanId,
            poster: 'https://kick.com/favicon.ico',
            description: `تفاصيل القناة ${cleanId}`
        }
    });
});

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
                        title: `🔵 [مباشر] ${channel} - جودة فائقة (1080p)`,
                        url: playbackUrl
                    },
                    {
                        title: `🔴 [مباشر] ${channel} - جودة عالية (720p)`,
                        url: playbackUrl
                    },
                    {
                        title: `🟡 [مباشر] ${channel} - جودة متوسطة (480p)`,
                        url: playbackUrl
                    },
                    {
                        title: `🟢 [مباشر] ${channel} - أقل جودة (360p / توفير البيانات)`,
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
                    title: `⚡ بث بديل - ${channel} (1080p)`,
                    url: fallbackUrl
                },
                {
                    title: `⚡ بث بديل - ${channel} (720p)`,
                    url: fallbackUrl
                },
                {
                    title: `⚡ بث بديل - ${channel} (480p)`,
                    url: fallbackUrl
                },
                {
                    title: `⚡ بث بديل - ${channel} (360p)`,
                    url: fallbackUrl
                }
            ]
        });
    }
});

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
    console.log(`Kick Stremio Addon active on port ${PORT}`);
});
