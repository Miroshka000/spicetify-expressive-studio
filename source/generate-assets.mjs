import { MaterialShapes, Morph, morphToPath, roundedPolygonToPath } from 'material-shapes-ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// MaterialShapes is the Apache-2.0 port of AndroidX MaterialShapes/Graphics Shapes.
// Geometry is exported from that library, never approximated with border-radius.
const dir = new URL('./assets/expressive-motion/', import.meta.url);
await mkdir(dir, { recursive: true });
const pairs = [
  ['cookie', 'Cookie9Sided', 'Cookie4Sided'],
  ['sunny', 'Sunny', 'SoftBurst'],
  ['clover', 'Clover4Leaf', 'Flower'],
];
const data = {};
const css = ['/* MaterialShapes/AndroidX geometry via material-shapes-ts 0.3.0, Apache-2.0. */'];
for (const [id, from, to] of pairs) {
  const morph = new Morph(MaterialShapes[from], MaterialShapes[to]);
  const start = morphToPath(morph, 0).toSvgPathData();
  const end = morphToPath(morph, 1).toSvgPathData();
  data[id] = { start, end, from, to };
  const d = roundedPolygonToPath(MaterialShapes[from]).toSvgPathData();
  await writeFile(new URL(`${id}.svg`, dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path fill="currentColor" d="${d}"/></svg>\n`);
  css.push(`@keyframes m3-${id}-morph { 0%,100% { d:path('${start}'); } 50% { d:path('${end}'); } }`);
  css.push(`.em-shape-${id} { animation: m3-${id}-morph calc(var(--em-shape-time, 10s) * var(--em-tempo)) var(--em-easing-emphasized) infinite; }`);
}

// Exact damping ratios and stiffness from AndroidX ExpressiveMotionTokens.kt.
// Solve the unit-mass spring once at build time; the browser receives CSS data.
const tokens = { spatial: [380, .8], fast: [800, .6], slow: [200, .8], effects: [1600, 1] };
css.push(':root { --em-easing-emphasized:cubic-bezier(.2,0,0,1);');
for (const [name, [stiffness, damping]] of Object.entries(tokens)) {
  const omega = Math.sqrt(stiffness);
  const duration = damping === 1 ? .3 : -Math.log(.0008) / (damping * omega);
  const points = [];
  for (let i = 0; i <= 120; i++) {
    const t = duration * i / 120;
    const wd = omega * Math.sqrt(1 - damping * damping);
    const p = damping === 1 ? 1 - Math.exp(-omega * t) * (1 + omega * t)
      : 1 - Math.exp(-damping * omega * t) * (Math.cos(wd * t) + damping / Math.sqrt(1 - damping * damping) * Math.sin(wd * t));
    points.push(i === 120 ? '1' : p.toFixed(5));
  }
  css.push(`--em-duration-${name}:${duration.toFixed(4)}s; --em-spring-${name}:linear(${points.join(',')});`);
}
css.push('}');
await writeFile(new URL('material-assets.css', dir), css.join('\n') + '\n');
await writeFile(new URL('./shape-data.json', import.meta.url), JSON.stringify(data));
console.log('Material SVG assets, morphs and Expressive motion tokens exported.');
