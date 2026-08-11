// scripts/verify-seo.mjs
//
// Suíte de verificação de SEO/AEO. Roda contra o build em dist/, nunca
// contra o código fonte: o que importa é o HTML que o Google e os
// assistentes de IA recebem de fato.
//
// Uso: npm run build && npm run verify:seo   (ou npm run check)

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
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
// Task 2: JSON-LD
// ---------------------------------------------------------------
console.log('\nJSON-LD');

function grafoDe(html) {
  const bloco = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
  );
  assert(bloco, 'nenhum bloco JSON-LD encontrado no HTML');
  const parsed = JSON.parse(bloco[1]);
  assert(parsed['@context'] === 'https://schema.org', '@context ausente ou errado');
  assert(Array.isArray(parsed['@graph']), 'JSON-LD nao usa @graph');
  return parsed['@graph'];
}

function no(grafo, tipo) {
  const encontrado = grafo.find((n) => n['@type'] === tipo);
  assert(encontrado, `JSON-LD sem no do tipo ${tipo}`);
  return encontrado;
}

// Lazy e memoizado de proposito: se o JSON-LD estiver quebrado, o erro
// precisa ser capturado pelo check() que chamou, virar uma linha FALHA e
// deixar as verificacoes seguintes rodarem. Parseando no escopo do modulo,
// um throw mataria o processo e abortaria todas as secoes abaixo desta.
let _grafoHome = null;
function grafoHome() {
  if (_grafoHome === null) _grafoHome = grafoDe(home);
  return _grafoHome;
}

// Lista de preços de fundação: valores que NUNCA devem aparecer publicamente.
// Isso é uma lista de regressão, não um detector geral, pois só pega os valores
// conhecidos. A regra de nunca citar o nome do agente comercial interno não é
// verificável aqui, porque escrever esse nome neste repositório seria justamente
// o vazamento que a regra evita. Essa parte depende de revisão humana.
const PRECOS_DE_FUNDACAO = ['500', '750', '700', '900', '1.500', '3.000'];

/** "Salões de Beleza" vira "saloes de beleza". */
function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Radicais, ja normalizados. Nenhum pode aparecer no HTML construido de
// nenhuma pagina, visivel ou dentro de atributo. Nicho so vive no
// llms-full.txt, e la como exemplo, nunca como posicionamento.
//
// Esta lista precisa cobrir empresa.casosDeUso em src/data/empresa.ts. O
// check 'todo caso de uso esta coberto pela lista de termos de nicho',
// mais abaixo, falha alto se as duas divergirem, pra essa lista nao
// ficar pra tras quando casosDeUso ganhar um nicho novo.
const TERMOS_DE_NICHO = [
  'clinic', 'consultori', 'odontolog', 'estetic', 'fisioterap',
  'veterinar', 'barbear', 'salao', 'saloes', 'escola', 'curso',
];

// Casamento por radical com fronteira de palavra so na borda esquerda
// (\b antes do radical). Os radicais sao propositalmente incompletos
// (plural, genero, conjugacao variam), entao so a borda esquerda pode
// ser garantida. Isso evita falso positivo tipo "curso" dentro de
// "percurso": entre o "r" e o "c" os dois lados sao caracteres de
// palavra, entao \b nao marca fronteira ali e o radical nao casa.
function nichoEncontradoEm(textoNormalizado) {
  return TERMOS_DE_NICHO.find((termo) => new RegExp(`\\b${termo}`).test(textoNormalizado));
}

// Um item de empresa.casosDeUso nao e um nicho especifico: e o criterio
// geral reescrito como item de lista ("o negocio depender de agenda e
// ter o WhatsApp como canal principal"), nao um exemplo de tipo de
// negocio. Nao tem radical de nicho para bater, de proposito, entao o
// check de cobertura abaixo o isenta por nome em vez de falhar nele.
const CASOS_DE_USO_SEM_NICHO_ESPECIFICO = [
  'Prestadores de serviço que agendam atendimento por WhatsApp',
];

check('o JSON-LD é um @graph parseável com @context correto', () => {
  assert(grafoHome().length >= 3, `esperava ao menos 3 nos, encontrou ${grafoHome().length}`);
});

check('ProfessionalService tem telefone, endereço e sameAs', () => {
  const negocio = no(grafoHome(), 'ProfessionalService');
  assert(negocio.name === 'R.A.F.O.', `name errado: ${negocio.name}`);
  assert(negocio.telephone === '+5524992695804', 'telephone ausente ou errado');
  assert(negocio.address?.addressLocality === 'Resende', 'addressLocality nao e Resende');
  assert(negocio.address?.addressRegion === 'RJ', 'addressRegion nao e RJ');
  assert(Array.isArray(negocio.sameAs) && negocio.sameAs.length > 0, 'sameAs vazio');
  assert(
    negocio.sameAs.includes('https://www.instagram.com/rafo.tech/'),
    'sameAs sem o Instagram oficial'
  );
  assert(
    !JSON.stringify(negocio.sameAs).includes('instagram.com/rafotech/'),
    'sameAs contem @rafotech, que NAO e da empresa'
  );
});

check('ProfessionalService declara área atendida local e nacional', () => {
  const negocio = no(grafoHome(), 'ProfessionalService');
  const areas = JSON.stringify(negocio.areaServed ?? []);
  assert(areas.includes('Resende'), 'areaServed sem Resende');
  assert(areas.includes('Brasil'), 'areaServed sem Brasil');
});

check('o catálogo de ofertas traz os 3 serviços e o preço de R$ 97', () => {
  const negocio = no(grafoHome(), 'ProfessionalService');
  const itens = negocio.hasOfferCatalog?.itemListElement ?? [];
  assert(itens.length === 3, `esperava 3 ofertas, encontrou ${itens.length}`);
  const google = itens.find((o) => o.itemOffered?.name === 'Presença no Google');
  assert(google, 'oferta da Presença no Google ausente');
  assert(google.price === 97, `preco errado: ${google.price}`);
  assert(google.priceCurrency === 'BRL', 'priceCurrency nao e BRL');
  const comPreco = itens.filter((o) => o.price !== undefined);
  assert(
    comPreco.length === 1,
    `so a Presenca no Google pode ter preco publico, encontrou ${comPreco.length}`
  );
});

check('WebSite aponta para a entidade do negócio', () => {
  const site = no(grafoHome(), 'WebSite');
  assert(site.inLanguage === 'pt-BR', 'inLanguage ausente');
  assert(site.publisher?.['@id'], 'publisher sem @id');
});

check('FAQPage existe e bate exatamente com o FAQ visível', () => {
  const faq = no(grafoHome(), 'FAQPage');
  const perguntas = (faq.mainEntity ?? []).map((q) => q.name);
  assert(
    perguntas.length === PERGUNTAS_ESPERADAS.length,
    `schema tem ${perguntas.length} perguntas, a pagina tem ${PERGUNTAS_ESPERADAS.length}`
  );
  for (const esperada of PERGUNTAS_ESPERADAS) {
    assert(perguntas.includes(esperada), `FAQPage sem a pergunta visivel: "${esperada}"`);
  }
  for (const q of faq.mainEntity) {
    assert(q.acceptedAnswer?.text, `pergunta sem resposta: "${q.name}"`);
    assert(
      home.includes(q.acceptedAnswer.text),
      `resposta do schema nao aparece na pagina: "${q.acceptedAnswer.text}"`
    );
  }
});

// ---------------------------------------------------------------
// Task 3: imagem de compartilhamento
// ---------------------------------------------------------------
console.log('\nImagem de compartilhamento');

/** Lê largura e altura do cabeçalho IHDR de um PNG. */
function tamanhoPng(buffer) {
  assert(
    buffer.subarray(1, 4).toString('ascii') === 'PNG',
    'o arquivo nao e um PNG valido'
  );
  return { largura: buffer.readUInt32BE(16), altura: buffer.readUInt32BE(20) };
}

check('existe uma imagem OG em 1200x630', () => {
  const png = lerDistBinario('og/default.png');
  const { largura, altura } = tamanhoPng(png);
  assert(largura === 1200 && altura === 630, `dimensoes erradas: ${largura}x${altura}`);
});

check('a imagem OG não está vazia', () => {
  const png = lerDistBinario('og/default.png');
  assert(png.length > 5000, `arquivo suspeito de estar em branco: ${png.length} bytes`);
});

check('as logos commitadas continuam em 1200x1200', () => {
  const compacta = lerDistBinario('logo/rafo-compact.png');
  const { largura, altura } = tamanhoPng(compacta);
  assert(largura === 1200 && altura === 1200, `logo compacta com ${largura}x${altura}`);
});

// ---------------------------------------------------------------
// Task 4: metadados do head
// ---------------------------------------------------------------
console.log('\nMetadados do head');

check('og:site_name está presente', () => {
  assert(
    /<meta property="og:site_name" content="R\.A\.F\.O\."/.test(home),
    'og:site_name ausente ou com nome de marca errado'
  );
});

check('og:image aponta para a imagem 1200x630 e é URL absoluta', () => {
  const m = home.match(/<meta property="og:image" content="([^"]+)"/);
  assert(m, 'og:image ausente');
  assert(m[1].startsWith('https://'), `og:image precisa ser absoluta, veio "${m[1]}"`);
  assert(m[1].endsWith('/og/default.png'), `og:image aponta para "${m[1]}"`);
});

check('as dimensões declaradas batem com a imagem real', () => {
  assert(
    /<meta property="og:image:width" content="1200"/.test(home),
    'og:image:width nao e 1200'
  );
  assert(
    /<meta property="og:image:height" content="630"/.test(home),
    'og:image:height nao e 630'
  );
});

check('og:image:alt está presente', () => {
  assert(/<meta property="og:image:alt" content="[^"]+"/.test(home), 'og:image:alt ausente');
});

check('a meta robots libera prévia de imagem grande', () => {
  const m = home.match(/<meta name="robots" content="([^"]+)"/);
  assert(m, 'meta robots ausente');
  assert(m[1].includes('index'), 'meta robots nao permite indexacao');
  assert(
    m[1].includes('max-image-preview:large'),
    'sem max-image-preview:large, o Google nao mostra imagem grande no resultado'
  );
});

// ---------------------------------------------------------------
// Task 5: llms.txt
// ---------------------------------------------------------------
console.log('\nllms.txt');

check('llms.txt existe e não é HTML', () => {
  const txt = lerDist('llms.txt');
  assert(!/<html|<!doctype/i.test(txt), 'llms.txt esta servindo HTML, nao texto');
  assert(txt.length > 300, `conteudo curto demais: ${txt.length} caracteres`);
});

check('llms.txt segue o formato da proposta', () => {
  const txt = lerDist('llms.txt');
  assert(txt.startsWith('# R.A.F.O.'), 'primeira linha precisa ser o H1 com o nome');
  assert(/\n> .+/.test(txt), 'falta o blockquote de resumo em uma linha');
});

check('llms.txt traz contato, localização e os 3 serviços', () => {
  const txt = lerDist('llms.txt');
  assert(txt.includes('wa.me/5524992695804'), 'sem WhatsApp');
  assert(txt.includes('instagram.com/rafo.tech'), 'sem Instagram');
  assert(txt.includes('Resende'), 'sem a cidade base');
  for (const nome of ['Presença no Google', 'Agentes autônomos para WhatsApp', 'Sites institucionais']) {
    assert(txt.includes(nome), `servico ausente: ${nome}`);
  }
  assert(txt.includes('R$ 97'), 'sem o preco publico da Presenca no Google');
});

check('llms.txt não expõe preço de fundação', () => {
  const txt = lerDist('llms.txt');
  for (const proibido of PRECOS_DE_FUNDACAO) {
    assert(!txt.includes(`R$ ${proibido}`), `preco de fundacao exposto: R$ ${proibido}`);
  }
});

// ---------------------------------------------------------------
// Task 6: llms-full.txt
// ---------------------------------------------------------------
console.log('\nllms-full.txt');

check('llms-full.txt existe, não é HTML e tem substância', () => {
  const txt = lerDist('llms-full.txt');
  assert(!/<html|<!doctype/i.test(txt), 'esta servindo HTML, nao texto');
  assert(txt.length > 1500, `conteudo curto demais: ${txt.length} caracteres`);
});

check('llms-full.txt tem todas as seções previstas', () => {
  const txt = lerDist('llms-full.txt');
  for (const secao of [
    '## Site oficial',
    '## O que a R.A.F.O. faz',
    '## Serviços',
    '## Onde atendemos',
    '## Como funciona o processo',
    '## Casos de uso',
    '## Perguntas frequentes',
    '## Contato',
  ]) {
    assert(txt.includes(secao), `secao ausente: ${secao}`);
  }
});

check('o FAQ do llms-full.txt bate com o FAQ visível', () => {
  const txt = lerDist('llms-full.txt');
  for (const pergunta of PERGUNTAS_ESPERADAS) {
    assert(txt.includes(pergunta), `pergunta ausente: "${pergunta}"`);
  }
});

check('llms-full.txt lista casos de uso sem posicionar a empresa por nicho', () => {
  const txt = lerDist('llms-full.txt');
  assert(txt.includes('Clínicas'), 'sem exemplos de caso de uso');

  // O enquadramento, e não apenas a presença da seção, é o que este check
  // protege. A empresa não pode ser descrita como "especializada em" ou
  // "focada em" nichos, mas apenas como tendo nichos como exemplos de negócios
  // que se beneficiam do que ela faz.
  assert(
    txt.includes('A lista é de exemplos, não de restrição'),
    'frase de enquadramento ausente: "A lista é de exemplos, não de restrição"'
  );
  assert(
    !/especializad|focada em|voltada para|atendemos apenas/i.test(txt),
    'linguagem de posicionamento por nicho detectada (especializad*, focada em, voltada para, atendemos apenas)'
  );
});

check('todo caso de uso esta coberto pela lista de termos de nicho', () => {
  const txt = lerDist('llms-full.txt');
  const secao = txt.split('## Casos de uso')[1]?.split('\n## ')[0] ?? '';
  const linhas = secao
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.startsWith('- '))
    .filter((linha) => !CASOS_DE_USO_SEM_NICHO_ESPECIFICO.includes(linha.slice(2)));
  assert(linhas.length > 0, 'nao encontrou nenhum item em ## Casos de uso');

  for (const linha of linhas) {
    const encontrado = nichoEncontradoEm(normalizar(linha));
    assert(
      encontrado,
      `caso de uso sem radical correspondente em TERMOS_DE_NICHO: "${linha}". ` +
        'Provavelmente um nicho novo foi adicionado a empresa.casosDeUso em ' +
        'src/data/empresa.ts sem estender TERMOS_DE_NICHO em scripts/verify-seo.mjs.'
    );
  }
});

check('llms-full.txt não expõe preço de fundação', () => {
  const txt = lerDist('llms-full.txt');
  for (const proibido of PRECOS_DE_FUNDACAO) {
    assert(!txt.includes(`R$ ${proibido}`), `preco de fundacao exposto: R$ ${proibido}`);
  }
});

// ---------------------------------------------------------------
// Task 6b: nicho vazando para o HTML da home
// ---------------------------------------------------------------
console.log('\nNicho no HTML da home');

check('a home nao contem nenhum radical de nicho, visivel ou em atributo', () => {
  // Termo de nicho em atributo oculto e keyword stuffing, que o Google
  // trata como sinal de spam, e nao ranqueia nada. Normaliza o HTML
  // inteiro uma vez e testa todos os radicais contra ele.
  const encontrado = nichoEncontradoEm(normalizar(home));
  assert(!encontrado, `nicho vazou para o HTML da home: radical "${encontrado}"`);
});

// ---------------------------------------------------------------
// Task 7: pagina /sobre e rodape
// ---------------------------------------------------------------
console.log('\nPagina /sobre e rodape');

check('a página /sobre existe com title e description próprios', () => {
  const sobre = lerDist('sobre/index.html');
  const titulo = sobre.match(/<title>([^<]+)<\/title>/);
  assert(titulo, 'sem title');
  assert(!titulo[1].includes('Automação de atendimento e sites institucionais sob medida'),
    'title identico ao da home');
  const desc = sobre.match(/<meta name="description" content="([^"]+)"/);
  assert(desc, 'sem meta description');
  assert(desc[1].length > 70, `description curta demais: ${desc[1].length} caracteres`);
});

check('/sobre tem canonical próprio e JSON-LD de AboutPage', () => {
  const sobre = lerDist('sobre/index.html');
  // Barra final opcional: o formato "directory" do Astro pode gerar
  // /sobre ou /sobre/ dependendo da configuracao de trailingSlash. O que
  // importa e o canonical apontar para a propria pagina, nao para a home.
  assert(
    /<link rel="canonical" href="https:\/\/rafolabs\.tech\/sobre\/?"/.test(sobre),
    'canonical de /sobre ausente ou apontando para outro lugar'
  );
  const grafo = grafoDe(sobre);
  no(grafo, 'AboutPage');
  no(grafo, 'ProfessionalService');
});

check('o canonical de /sobre e a URL do AboutPage sao identicos', () => {
  const sobre = lerDist('sobre/index.html');
  const canonicalMatch = sobre.match(/<link rel="canonical" href="([^"]+)"/);
  assert(canonicalMatch, 'nao encontrou canonical em /sobre');
  const canonicalUrl = canonicalMatch[1];

  const grafo = grafoDe(sobre);
  const aboutPage = no(grafo, 'AboutPage');
  const aboutPageUrl = aboutPage.url;

  assert(
    canonicalUrl === aboutPageUrl,
    `canonical: "${canonicalUrl}", AboutPage.url: "${aboutPageUrl}"`
  );
});

check('/sobre menciona a cidade base sem posicionar por nicho', () => {
  const sobre = lerDist('sobre/index.html');
  assert(sobre.includes('Resende'), 'sem a cidade base');
  const encontrado = nichoEncontradoEm(normalizar(sobre));
  assert(!encontrado, `nicho vazou para /sobre: radical "${encontrado}"`);
});

check('nenhum preco de fundacao aparece no HTML de index.html ou sobre/index.html', () => {
  const sobre = lerDist('sobre/index.html');
  for (const proibido of PRECOS_DE_FUNDACAO) {
    assert(
      !home.includes(`R$ ${proibido}`),
      `preco de fundacao exposto em index.html: R$ ${proibido}`
    );
    assert(
      !sobre.includes(`R$ ${proibido}`),
      `preco de fundacao exposto em sobre/index.html: R$ ${proibido}`
    );
  }
});

check('o rodapé traz localização, Instagram e link para /sobre', () => {
  assert(home.includes('Resende, RJ'), 'rodape sem a localizacao');
  assert(
    home.includes('https://www.instagram.com/rafo.tech/'),
    'rodape sem link do Instagram'
  );
  assert(/href="\/sobre\/"/.test(home), 'rodape sem link para /sobre/');
});

check('/sobre está no sitemap', () => {
  const sitemap = lerDist('sitemap-0.xml');
  assert(sitemap.includes('https://rafolabs.tech/sobre'), '/sobre fora do sitemap');
});

// ---------------------------------------------------------------
// Task 8: robots.txt
// ---------------------------------------------------------------
console.log('\nrobots.txt');

check('robots.txt continua bloqueando /propostas/', () => {
  const robots = lerDist('robots.txt');
  // Ancorado no inicio da linha de proposito: um teste de substring
  // simples passaria mesmo com a diretiva comentada, e a regra estaria
  // morta com a verificacao dizendo ok. Isso guarda propostas comerciais
  // de cliente.
  assert(
    /^Disallow: \/propostas\/\s*$/m.test(robots),
    'PROTECAO REMOVIDA OU COMENTADA: /propostas/ liberado'
  );
});

// As referencias aos arquivos de IA em robots.txt sao comentarios "#", de
// proposito, porque nao existe diretiva padrao de robots.txt para eles.
// Um match de substring passa tanto para uma linha comentada quanto para
// uma diretiva de verdade, entao esse e o teste honesto que da pra fazer
// aqui: ele confirma que a referencia existe, nao que e uma diretiva.
check('robots.txt aponta o sitemap e menciona os arquivos para IA', () => {
  const robots = lerDist('robots.txt');
  assert(robots.includes('Sitemap: https://rafolabs.tech/sitemap-index.xml'), 'sem sitemap');
  assert(robots.includes('/llms.txt'), 'sem referencia a llms.txt');
  assert(robots.includes('/llms-full.txt'), 'sem referencia a llms-full.txt');
});

check('robots.txt não bloqueia as novas rotas', () => {
  const robots = lerDist('robots.txt');
  for (const rota of ['/sobre', '/llms.txt', '/llms-full.txt']) {
    assert(!robots.includes(`Disallow: ${rota}`), `rota bloqueada por engano: ${rota}`);
  }
});

// ---------------------------------------------------------------

// ---------------------------------------------------------------
// Fase 2, Task 1: catalogo de servicos na home
// ---------------------------------------------------------------
console.log('\nCatalogo de servicos na home');

const SERVICOS_ESPERADOS = [
  { nome: 'Presença no Google', slug: 'presenca-no-google' },
  { nome: 'Agentes autônomos para WhatsApp', slug: 'agentes-whatsapp' },
  { nome: 'Sites institucionais', slug: 'sites-institucionais' },
];

check('a home mostra os 3 servicos com os nomes corretos', () => {
  for (const s of SERVICOS_ESPERADOS) {
    assert(home.includes(s.nome), `servico ausente da home: "${s.nome}"`);
  }
});

check('cada card de servico linka para a pagina dele, com barra final', () => {
  for (const s of SERVICOS_ESPERADOS) {
    const href = `/${s.slug}/`;
    assert(
      home.includes(`href="${href}"`),
      `a home nao linka para ${href}, o card de "${s.nome}" nao virou link`
    );
  }
});

check('nenhum link de servico na home esquece a barra final', () => {
  for (const s of SERVICOS_ESPERADOS) {
    const semBarra = new RegExp(`href="/${s.slug}"[^/]`);
    assert(
      !semBarra.test(home),
      `link sem barra final para /${s.slug}, causa um salto de redirect a mais`
    );
  }
});

if (falhas > 0) {
  console.error(`\n${falhas} verificacao(oes) falharam\n`);
  process.exit(1);
}
console.log('\ntodas as verificacoes passaram\n');
