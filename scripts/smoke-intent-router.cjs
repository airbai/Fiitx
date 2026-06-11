#!/usr/bin/env node

const assert = require("node:assert/strict");
const { routeIntent } = require("../electron/services/intent-router.cjs");

function assertIntent(prompt, expected) {
  const actual = routeIntent({ prompt });
  assert.equal(actual.mode, expected.mode, `${prompt}: mode`);
  assert.equal(actual.modality, expected.modality, `${prompt}: modality`);
  return actual;
}

const results = [
  assertIntent("帮我做一个勾股定理的演示动画，html代码形式，给初中生看", {
    mode: "coding",
    modality: "html"
  }),
  assertIntent("用 html 做一个动画页面", {
    mode: "coding",
    modality: "html"
  }),
  assertIntent("帮我写一个脚本生成视频", {
    mode: "coding",
    modality: "text"
  }),
  assertIntent("帮我生成一个咖啡广告视频", {
    mode: "chat",
    modality: "video"
  }),
  assertIntent("帮我画一张美式咖啡图片", {
    mode: "chat",
    modality: "image"
  })
];

console.log(JSON.stringify({ ok: true, results }, null, 2));
