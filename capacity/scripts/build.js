/* Packaging. The v2.4 shell (ui/v2/app-main.jsx) is now the DEFAULT product:
     dist/capacity-sim.html — self-contained, offline, minified: React, xlsx,
       engine, the whole v2 app (Home · Setup · Levers · Results) and CSS-via-
       runtime inlined into one <script>, </script> escaped, responsive viewport;
     dist/capacity-sim.jsx — the React-artifact form (ESM importing react /
       react-dom / xlsx from the artifact host).
   The superseded v1 single-file app is still built for its regression gate:
     dist/capacity-sim-v1.html — from ui/main.jsx (tests/harness.test.js).
   All built here from source so they can never drift. */
const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");
const V2_ENTRY = path.join(ROOT, "ui", "v2", "app-main.jsx");
const V1_ENTRY = path.join(ROOT, "ui", "main.jsx");
const PROD = { "process.env.NODE_ENV": '"production"' };
const OWNER = "nick_morris";

function htmlBundle(entry) {
  return esbuild.buildSync({
    entryPoints: [entry], bundle: true, format: "iife", platform: "browser", jsx: "automatic",
    minify: true, define: PROD, legalComments: "none", write: false,
  }).outputFiles[0].text;
}

// v2 uses raw SVG charts (no recharts); xlsx is dynamically imported.
function jsxBundle(entry, externals) {
  return esbuild.buildSync({
    entryPoints: [entry], bundle: true, format: "esm", platform: "browser", jsx: "automatic",
    minify: false, define: PROD, legalComments: "none", write: false, external: externals,
  }).outputFiles[0].text;
}

function htmlDocument(js, title) {
  const safe = js.replace(/<\/script>/gi, "<\\/script>");
  return `<!doctype html>
<!-- Capacity Simulator — owner / maintainer: ${OWNER} -->
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="author" content="${OWNER}" />
<title>${title}</title>
</head>
<body>
<div id="root"></div>
<script>${safe}</script>
</body>
</html>
`;
}

function buildAll(outDir = path.join(ROOT, "dist")) {
  fs.mkdirSync(outDir, { recursive: true });

  // v2 shell — the default product.
  const v2Html = htmlDocument(htmlBundle(V2_ENTRY), "Capacity Simulator");
  const v2Jsx = `// Capacity Simulator — owner / maintainer: ${OWNER}\n`
    + jsxBundle(V2_ENTRY, ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "xlsx"]);
  const htmlPath = path.join(outDir, "capacity-sim.html");
  const jsxPath = path.join(outDir, "capacity-sim.jsx");
  fs.writeFileSync(htmlPath, v2Html);
  fs.writeFileSync(jsxPath, v2Jsx);

  // v1 app — retained for its regression gate.
  const v1Html = htmlDocument(htmlBundle(V1_ENTRY), "Capacity Simulator (v1)");
  const v1HtmlPath = path.join(outDir, "capacity-sim-v1.html");
  fs.writeFileSync(v1HtmlPath, v1Html);

  return {
    htmlPath, jsxPath, v1HtmlPath,
    htmlBytes: Buffer.byteLength(v2Html), jsxBytes: Buffer.byteLength(v2Jsx), v1HtmlBytes: Buffer.byteLength(v1Html),
  };
}

module.exports = { buildAll, htmlDocument };

if (require.main === module) {
  const r = buildAll();
  console.log(`Built ${r.htmlPath} (${(r.htmlBytes / 1024).toFixed(0)} KB) — v2 shell [default]`);
  console.log(`Built ${r.jsxPath} (${(r.jsxBytes / 1024).toFixed(0)} KB) — v2 artifact form`);
  console.log(`Built ${r.v1HtmlPath} (${(r.v1HtmlBytes / 1024).toFixed(0)} KB) — v1 legacy`);
}
