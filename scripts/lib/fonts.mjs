// scripts/lib/fonts.mjs
//
// Pipeline de carregamento de Space Grotesk para o resvg-js.
//
// @fontsource/space-grotesk só distribui .woff/.woff2, mas o fontdb do
// resvg-js só lê .ttf/.otf de verdade: passar .woff2 via `fontFiles` dá
// erro de "malformed font", e passar buffer descomprimido via
// `fontBuffers` falha em silêncio, trocando a fonte por um fallback
// serifado sem emitir aviso nenhum. A única combinação confirmada
// visualmente neste ambiente é descomprimir para .ttf real em disco e
// carregar via `fontFiles`.
//
// Detalhe extra: o nome interno da família (tabela SFNT) nos arquivos do
// @fontsource é "Space Grotesk Light" em todos os pesos. O resvg casa
// fontes por esse nome, não pelo nome do CSS, então o SVG entregue ao
// rasterizador precisa declarar essa família.

import { writeFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import * as wawoff2 from 'wawoff2';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const RASTER_FONT_FAMILY = 'Space Grotesk Light';

const fontDir = resolve(__dirname, '../../node_modules/@fontsource/space-grotesk/files');

async function descomprimirParaTtf(tmpDir, woff2Path, nomeTtf) {
  const woff2Bytes = readFileSync(woff2Path);
  const ttfBytes = await wawoff2.decompress(woff2Bytes);
  const ttfPath = join(tmpDir, nomeTtf);
  writeFileSync(ttfPath, Buffer.from(ttfBytes));
  return ttfPath;
}

/**
 * Descomprime Space Grotesk 400 e 700 para .ttf temporários, chama o
 * callback com os caminhos e limpa o diretório temporário no final.
 *
 * @param {(fontFiles: string[]) => Promise<void>} callback
 */
export async function comFontesSpaceGrotesk(callback) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'rafo-fontes-'));
  try {
    const bold = await descomprimirParaTtf(
      tmpDir,
      resolve(fontDir, 'space-grotesk-latin-700-normal.woff2'),
      'space-grotesk-700.ttf'
    );
    const light = await descomprimirParaTtf(
      tmpDir,
      resolve(fontDir, 'space-grotesk-latin-400-normal.woff2'),
      'space-grotesk-400.ttf'
    );
    await callback([bold, light]);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
