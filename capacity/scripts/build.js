/* P5 packaging (SPEC §0, §9). Two deliverables from ONE source (ui/main.jsx):
     dist/capacity-sim.html — self-contained, offline, minified, everything
       (React, recharts, xlsx, engine, UI, CSS-via-runtime) inlined into a single
       <script>, with </script> escaped and a responsive viewport meta;
     dist/capacity-sim.jsx — the React-artifact form: one bundled ESM file that
       imports react / react-dom / recharts / xlsx from the artifact host.
   Both are built here so they can never drift. */
const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");
const ENTRY = path.join(ROOT, "ui", "main.jsx");
const PROD = { "process.env.NODE_ENV": '"production"' };
// Owner / maintainer stamped into both deliverables.
const OWNER = "nick_morris";

function buildHtmlBundle() {
  const res = esbuild.buildSync({
    entryPoints: [ENTRY], bundle: true, format: "iife", platform: "browser", jsx: "automatic",
    minify: true, define: PROD, legalComments: "none", write: false,
  });
  return res.outputFiles[0].text;
}

function buildJsxBundle() {
  const res = esbuild.buildSync({
    entryPoints: [ENTRY], bundle: true, format: "esm", platform: "browser", jsx: "automatic",
    minify: false, define: PROD, legalComments: "none", write: false,
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "recharts", "xlsx"],
  });
  return res.outputFiles[0].text;
}

function htmlDocument(js) {
  // Escape any </script> so the inlined bundle can't close the tag early.
  const safe = js.replace(/<\/script>/gi, "<\\/script>");
  return `<!doctype html>
<!-- Capacity Simulator — owner / maintainer: ${OWNER} -->
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="author" content="${OWNER}" />
<title>Capacity Simulator</title>
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
  const htmlJs = buildHtmlBundle();
  const html = htmlDocument(htmlJs);
  const jsx = `// Capacity Simulator — owner / maintainer: ${OWNER}\n` + buildJsxBundle();
  const htmlPath = path.join(outDir, "capacity-sim.html");
  const jsxPath = path.join(outDir, "capacity-sim.jsx");
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(jsxPath, jsx);
  return { htmlPath, jsxPath, htmlBytes: Buffer.byteLength(html), jsxBytes: Buffer.byteLength(jsx) };
}

module.exports = { buildAll, buildHtmlBundle, buildJsxBundle, htmlDocument };

if (require.main === module) {
  const r = buildAll();
  console.log(`Built ${r.htmlPath} (${(r.htmlBytes / 1024).toFixed(0)} KB)`);
  console.log(`Built ${r.jsxPath} (${(r.jsxBytes / 1024).toFixed(0)} KB)`);
}
