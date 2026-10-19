// 단일 HTML 번들: dist/artifact.html(아티팩트용 본문 조각), dist/web/index.html(독립 배포용 전체 문서)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const js = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
const css = await build({ entryPoints: ['src/styles.css'], bundle: true, minify: true, write: false, loader: { '.css': 'css' } });
const code = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const style = css.outputFiles[0].text;
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hahmlet:wght@500;600;700;800&family=Gowun+Dodum&family=Nanum+Pen+Script&display=swap">';
const head = `<title>Book of the End</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<meta name="description" content="문체·생체리듬·위치 맥락을 결합한 AI 독서 플랫폼 데모">\n${fonts}\n<style>${style}</style>`;
const body = `<div id="app"><p style="padding:24px">불러오는 중…</p></div>\n<script>${code}</script>`;

mkdirSync('dist/web', { recursive: true });
writeFileSync('dist/artifact.html', `${head}\n${body}\n`);
writeFileSync('dist/web/index.html', `<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1);
console.log(`js ${kb(code)}KB · css ${kb(style)}KB → dist/artifact.html, dist/web/index.html`);
