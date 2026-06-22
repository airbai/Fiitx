const assert = require("node:assert/strict");
const { normalizeHtmlModuleImports } = require("../electron/services/html-module-imports.cjs");

const html = `<!doctype html>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
const module = await import('three');
const controls = await import("three/addons/controls/OrbitControls.js");
import { CSS2DRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/renderers/CSS2DRenderer.js';
import * as ThreeCdn from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
</script>`;

const normalized = normalizeHtmlModuleImports("demo/index.html", html);

assert.doesNotMatch(normalized, /from\s+['"]three['"]/);
assert.doesNotMatch(normalized, /from\s+['"]three\/addons\//);
assert.doesNotMatch(normalized, /import\(\s*['"]three['"]\s*\)/);
assert.doesNotMatch(normalized, /cdn\.jsdelivr\.net\/npm\/three/);
assert.match(normalized, /https:\/\/esm\.sh\/three@0\.160\.0/);
assert.match(normalized, /https:\/\/esm\.sh\/three@0\.160\.0\/examples\/jsm\/controls\/OrbitControls\.js/);
assert.match(normalized, /https:\/\/esm\.sh\/three@0\.160\.0\/examples\/jsm\/renderers\/CSS2DRenderer\.js/);
assert.equal(normalizeHtmlModuleImports("demo/app.js", "import * as THREE from 'three';"), "import * as THREE from 'three';");

console.log("html module import normalization smoke passed");
