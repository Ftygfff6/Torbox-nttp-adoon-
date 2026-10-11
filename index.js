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
    id: "org.kick.pro
