app.get("/:config/stream/tv/:id.json", async function(req, res) {
  var c = req.params.id.replace("kick:", "").trim();
  var streams = [];

  try {
    var r = await axios.get("https://kick.com/api/v2/channels/" + c, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 5000 });
    var pb = r.data && r.data.playback_url;
    
    // إذا لم يكن هناك رابط بث مباشر، نظهر رسالة واضحة في القائمة بدلاً من الشاشة الفارغة
    if (!pb) {
      streams.push({
        name: "🔴 [البث متوقف]",
        title: "قناة " + c.toUpperCase() + " غير متصلة بالبث المباشر حالياً.",
        url: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4"
      });
      return res.json({ streams: streams });
    }

    streams.push({ 
      name: "🟢 [KICK AUTO]", 
      title: "قناة: " + c.toUpperCase() + " | البث المباشر (تلقائي)", 
      url: pb 
    });

    try {
      var pRes = await axios.get(pb, { timeout: 3000 });
      var lines = pRes.data.split("\n");
      var base = pb.substring(0, pb.lastIndexOf("/") + 1);
      
      lines.forEach(function(l, i) {
        if (l.indexOf("#EXT-X-STREAM-INF:") === 0) {
          var resM = l.match(/RESOLUTION=(\d+x\d+)/);
          var h = resM ? resM[1].split("x")[1] : "HD";
          var u = lines[i+1] ? lines[i+1].trim() : "";
          if (u && u.indexOf("http") !== 0) { u = base + u; }
          if (u) {
            streams.push({ 
              name: "🟢 [" + h + "p]", 
              title: "بث مباشر - جودة " + h + "p | قناة: " + c.toUpperCase(), 
              url: u 
            });
          }
        }
      });
    } catch(err) {}

    res.json({ streams: streams });
  } catch(e) {
    streams.push({
      name: "🔴 [خطأ في الاتصال]",
      title: "تعذر الوصول لقناة " + c.toUpperCase() + " حالياً.",
      url: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4"
    });
    res.json({ streams: streams });
  }
});
