// scripts/generate-og-image.mjs
//
// Gera public/og/default.png em 1200x630, a proporção 1.91:1 que
// `summary_large_image` espera. Antes desta imagem o site declarava a
// logo quadrada de 1200x1200 como imagem de compartilhamento, o que
// deixava a prévia distorcida no WhatsApp e no Instagram.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { comFontesSpaceGrotesk, RASTER_FONT_FAMILY } from './lib/fonts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public/og');
mkdirSync(outDir, { recursive: true });

const FUNDO = '#0B0A07';
const LETRA = '#DAE2DF';
const PONTO = '#A51C30';
const APOIO = '#E09F3E';

function ogSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${FUNDO}"/>
  <rect x="0" y="0" width="1200" height="6" fill="${PONTO}"/>
  <text x="96" y="300" font-size="120" font-family="${RASTER_FONT_FAMILY}">
    <tspan font-weight="700" fill="${LETRA}">R</tspan><tspan font-weight="700" fill="${PONTO}">.</tspan><tspan font-weight="400" fill="${LETRA}">A</tspan><tspan font-weight="700" fill="${PONTO}">.</tspan><tspan font-weight="700" fill="${LETRA}">F</tspan><tspan font-weight="700" fill="${PONTO}">.</tspan><tspan font-weight="400" fill="${LETRA}">O</tspan><tspan font-weight="700" fill="${PONTO}">.</tspan>
  </text>
  <text x="96" y="382" font-size="34" font-weight="400" font-family="${RASTER_FONT_FAMILY}" fill="${APOIO}">Atendimento no WhatsApp, sites e Google</text>
  <text x="96" y="440" font-size="26" font-weight="400" font-family="${RASTER_FONT_FAMILY}" fill="${LETRA}" opacity="0.7">Resende, RJ. Atendemos todo o Brasil.</text>
</svg>`;
}

async function main() {
  await comFontesSpaceGrotesk(async (fontFiles) => {
    const svg = ogSvg();
    const resvg = new Resvg(svg, {
      font: { fontFiles, loadSystemFonts: false, defaultFontFamily: RASTER_FONT_FAMILY },
      fitTo: { mode: 'width', value: 1200 },
    });
    const png = resvg.render().asPng();
    writeFileSync(resolve(outDir, 'default.png'), png);
    console.log('generated og/default.png (1200x630)');
  });
}

main();
