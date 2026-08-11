// scripts/verify-seo.mjs
//
// Suíte de verificação de SEO/AEO. Roda contra o build em dist/, nunca
// contra o código fonte: o que importa é o HTML que o Google e os
// assistentes de IA recebem de fato.
//
// Uso: npm run build && npm run verify:seo   (ou npm run check)

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '../dist');

let falhas = 0;

function check(nome, fn) {
  try {
    fn();
    console.log(`  ok     ${nome}`);
  } catch (erro) {
    falhas += 1;
    console.error(`  FALHA  ${nome}`);
    console.error(`         ${erro.message}`);
  }
}

function assert(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function lerDist(caminho) {
  const arquivo = resolve(dist, caminho);
  assert(existsSync(arquivo), `nao existe no build: dist/${caminho}`);
  return readFileSync(arquivo, 'utf-8');
}

function lerDistBinario(caminho) {
  const arquivo = resolve(dist, caminho);
  assert(existsSync(arquivo), `nao existe no build: dist/${caminho}`);
  return readFileSync(arquivo);
}

// ---------------------------------------------------------------
// Task 1: FAQ visível
// ---------------------------------------------------------------
console.log('\nFAQ visivel');

const home = lerDist('index.html');

const PERGUNTAS_ESPERADAS = [
  'Preciso trocar de número de WhatsApp?',
  'E se o cliente quiser falar com uma pessoa de verdade?',
  'Quanto tempo leva pra ficar pronto?',
  'Funciona pro meu tipo de negócio?',
];

const RESPOSTAS_ESPERADAS = [
  'Não, a automação entra no número que você já usa.',
  'A qualquer momento ele pode pedir, e você assume a conversa.',
  'Depende do seu fluxo hoje, mas o processo começa com uma conversa pra entender exatamente isso.',
  'Se o seu contato com cliente é majoritariamente por WhatsApp e agenda, muito provavelmente sim.',
];

check('a home renderiza exatamente 4 itens de FAQ', () => {
  const itens = home.match(/class="faq-item/g) ?? [];
  assert(itens.length === 4, `esperava 4 itens, encontrou ${itens.length}`);
});

check('as 4 perguntas esperadas estão no HTML', () => {
  for (const pergunta of PERGUNTAS_ESPERADAS) {
    assert(home.includes(pergunta), `pergunta ausente do HTML: "${pergunta}"`);
  }
});

check('as 4 respostas esperadas estão no HTML', () => {
  for (const resposta of RESPOSTAS_ESPERADAS) {
    assert(home.includes(resposta), `resposta ausente do HTML: "${resposta}"`);
  }
  assert(!home.includes('undefined'), 'HTML contém a string "undefined" (propriedade stale no Faq.astro)');
});

// ---------------------------------------------------------------

if (falhas > 0) {
  console.error(`\n${falhas} verificacao(oes) falharam\n`);
  process.exit(1);
}
console.log('\ntodas as verificacoes passaram\n');
