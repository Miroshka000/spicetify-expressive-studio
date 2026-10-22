import { build } from 'esbuild';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
await import('./generate-assets.mjs');
const source = fileURLToPath(new URL('./', import.meta.url));
const output = fileURLToPath(new URL('../Extensions/', import.meta.url));
await mkdir(output, { recursive:true });
let css = await readFile(path.join(source, 'appearance.css'), 'utf8');
css = css.replace("@import url('expressive-motion/material-assets.css');", await readFile(path.join(source, 'assets/expressive-motion/material-assets.css'), 'utf8'));
const urls = [...css.matchAll(/url\(['"]?(expressive-motion\/[^)'"\s]+)['"]?\)/g)];
for (const match of urls) {
  const file = path.join(source, 'assets', match[1]);
  const bytes = await readFile(file);
  const mime = file.endsWith('.ttf') ? 'font/ttf' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
  css = css.replaceAll(match[0], `url("data:${mime};base64,${bytes.toString('base64')}")`);
}
const system = await readFile(path.join(source, 'system.css'), 'utf8') + '\n' + await readFile(path.join(source, 'editor.css'), 'utf8');
const icons = {};
for (const file of await readdir(path.join(source, 'assets/expressive-motion/icons'))) {
  if (file.endsWith('.svg')) icons[file.slice(0,-4)] = await readFile(path.join(source, 'assets/expressive-motion/icons',file),'utf8');
}
const virtual = { 'studio:appearance':`export default ${JSON.stringify(css)};`, 'studio:system':`export default ${JSON.stringify(system)};`, 'studio:icons':`export default ${JSON.stringify(icons)};` };
const plugin = { name:'studio-assets', setup(builder) {
  builder.onResolve({filter:/^studio:/}, args => ({path:args.path,namespace:'studio'}));
  builder.onLoad({filter:/.*/,namespace:'studio'}, args => ({contents:virtual[args.path],loader:'js'}));
}};
const common = { bundle:true,format:'iife',target:['chrome120'],minify:true,legalComments:'eof',loader:{'.svg':'text'},plugins:[plugin] };
await build({ ...common,entryPoints:[path.join(source,'main.js')],outfile:path.join(output,'expressive-studio.js'),jsxFactory:'Spicetify.React.createElement',jsxFragment:'Spicetify.React.Fragment',banner:{js:'/* Expressive Studio 1.0.1 — MIT. Material assets: see THIRD-PARTY-NOTICES.md. */'} });
console.log('Single extension with popup editor built. All fonts, CSS and assets are embedded.');
