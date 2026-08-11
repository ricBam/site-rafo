// scripts/generate-logo-files.mjs
//
// Generates standalone, self-contained logo SVG + PNG files for use OUTSIDE
// the site (WhatsApp Business profile picture, documents, social avatars).
//
// Font note: the woff2-to-ttf decompression pipeline (and why it exists)
// now lives in scripts/lib/fonts.mjs, shared with generate-og-image.mjs.
// See that module's header comment for the full story.
//
// Also note: the internal SFNT family name embedded in the
// @fontsource-generated files is "Space Grotesk Light" (not "Space
// Grotesk") for every weight: Fontsource keeps one shared family name per
// weight file so browsers can select weights via @font-face, but the name
// itself carries "Light". resvg-js matches fonts by their internal SFNT
// name, so the SVG fed to Resvg for rasterization must reference "Space
// Grotesk Light". The *shipped* .svg files keep the portable
// "Space Grotesk" family name (consistent with src/components/Logo.astro)
// since a plain SVG file's font-family is just a hint for whatever renders
// it later, it doesn't affect the PNGs, which are rasterized correctly
// regardless.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { comFontesSpaceGrotesk, RASTER_FONT_FAMILY } from './lib/fonts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public/logo');
mkdirSync(outDir, { recursive: true });

function wordmarkSvg({ letterColor, dotColor }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="96" viewBox="0 0 440 96">
  <text x="0" y="68" font-size="68" font-family="Space Grotesk, sans-serif">
    <tspan font-weight="700" fill="${letterColor}">R</tspan><tspan font-weight="700" fill="${dotColor}">.</tspan><tspan font-weight="400" fill="${letterColor}">A</tspan><tspan font-weight="700" fill="${dotColor}">.</tspan><tspan font-weight="700" fill="${letterColor}">F</tspan><tspan font-weight="700" fill="${dotColor}">.</tspan><tspan font-weight="400" fill="${letterColor}">O</tspan><tspan font-weight="700" fill="${dotColor}">.</tspan>
  </text>
</svg>`;
}

function compactSvg({ bgColor, letterColor, dotColor }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="${bgColor}"/>
  <text x="200" y="260" font-size="180" font-family="Space Grotesk, sans-serif" text-anchor="middle">
    <tspan font-weight="700" fill="${letterColor}">R</tspan><tspan font-weight="700" fill="${dotColor}">.</tspan>
  </text>
</svg>`;
}

function rasterize(svg, width, fontFiles) {
  // Swap in the internal SFNT family name so resvg-js's fontdb actually
  // matches our loaded fonts (see module-level note).
  const raster_svg = svg.replaceAll('font-family="Space Grotesk, sans-serif"', `font-family="${RASTER_FONT_FAMILY}"`);
  const resvg = new Resvg(raster_svg, {
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: RASTER_FONT_FAMILY },
    fitTo: { mode: 'width', value: width },
  });
  return resvg.render().asPng();
}

async function main() {
  await comFontesSpaceGrotesk(async (fontFiles) => {
    const variants = [
      { name: 'rafo-wordmark', svg: wordmarkSvg({ letterColor: '#DAE2DF', dotColor: '#A51C30' }), pngWidth: 1320 },
      { name: 'rafo-wordmark-light', svg: wordmarkSvg({ letterColor: '#0B0A07', dotColor: '#A51C30' }), pngWidth: 1320 },
      { name: 'rafo-compact', svg: compactSvg({ bgColor: '#0B0A07', letterColor: '#DAE2DF', dotColor: '#A51C30' }), pngWidth: 1200 },
      { name: 'rafo-compact-light', svg: compactSvg({ bgColor: '#DAE2DF', letterColor: '#0B0A07', dotColor: '#A51C30' }), pngWidth: 1200 },
    ];

    for (const v of variants) {
      writeFileSync(resolve(outDir, `${v.name}.svg`), v.svg, 'utf-8');
      const png = rasterize(v.svg, v.pngWidth, fontFiles);
      writeFileSync(resolve(outDir, `${v.name}.png`), png);
      console.log(`generated ${v.name}.svg + ${v.name}.png`);
    }
  });
}

main();
