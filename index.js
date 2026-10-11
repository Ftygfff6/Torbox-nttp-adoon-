const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 7000;

app.get("/", function(req, res) {
  res.send(
    '<!DOCTYPE html>' +
    '<html lang="ar" dir="rtl">' +
    '<head><meta charset="UTF-8"><title>Kick Pro Live</title></head>' +
    '<body style="background:#0b0e0f;color:#fff;font-family:sans-serif;text-align:center;padding-top:50px;">' +
    '<h2>🟢 إعدادات إضافة Kick للبث المباشر</h2>' +
    '<p>أدخل أسماء قنوات Kick (مفصولة بفواصل):</p>' +
    '<textarea id="ch" style="width:300px;height:80px;background:#151a1c;color:#53fc18;padding:10px;border:1px solid #53fc18;border-radius:6px;"></textarea><br><br>' +
    '<button onclick="ins()" style="padding:10px 20px;background:#53fc18;color:#000;border:none;font-weight:bold;cursor:pointer;border-radius:6px;">تثبيت في التطبيق</button>' +
    '<script>' +
    'function ins() {' +
    '  var v = document.getElementById("ch").value.trim();' +
    '  if(!v) { return alert("أدخل قناة!"); }' +
    '  var list = v.split(/[,\\s\\n]+/).map(function(c){ return c.trim().toLowerCase(); }).filter(Boolean).join(",");' +
    '  var encoded = btoa(encodeURIComponent(list));' +
    '  window.location.href = "stremio://" + window.location.host + "/" + encoded + "/manifest.json";' +
    '}' +
    '</script>' +
    '</body>' +
    '</html>'
  );
});

app.get("/configure", function(req, res) {
  res.redirect("/");
});

app.get("/:config/manifest.json", function(req, res) {
  res.json({
    id: "org.kick.pro.live",
    version: "20.0.0",
    name: "Kick Pro Live",
    description: "البث المباشر لقنوات Kick بأعلى جودة واستقرار",
    resources: ["catalog", "meta", "stream"],
    types: ["tv"],
    catalogs: [{ type: "tv", id: "kick_live_cat", name: "🟢 Kick Live Channels" }],
    idPrefixes: ["kick:"]
  });
});

app.get("/:config/catalog/tv/kick_live_cat.json", function(req, res) {
  try {
    var channels = decodeURIComponent(Buffer.from(req.params.config, "base64").toString("utf-8")).split(",");
    var metas = channels.map(function(c) {
      return {
        id: "kick:" + c,
        type: "tv",
        name: "Kick: " + c.toUpperCase(),
        poster: "https://ui-avatars.com/api/?name=" + c + "&background=0B0E0F&color=53FC18&size=512",
        description: "بث مباشر حصري لقناة " + c.toUpperCase() + " بجودات متعددة واستقرار تام."
      };
    });
    res.json({ metas: metas });
  } catch(e) {
    res.json({ metas: [] });
  }
});

app.get("/:config/meta/tv/:id.json", function(req, res) {
  var c = req.params.id.replace("kick:", "");
  res.json({
    meta: {
      id: "kick:" + c,
      type: "tv",
      name: "Kick:
