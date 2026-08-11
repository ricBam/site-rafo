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

// Conteudo de <style> e <script> sai antes da varredura de nicho. Nome de
// propriedade CSS nao e conteudo de pagina, e produz alarme falso: o
// radical "curso" casa a borda esquerda de "cursor: pointer", que e a
// regra do FAQ. Atributos continuam sendo varridos de proposito, porque
// foi num aria-label que o nicho estava escondido antes da Fase 1.
// O bloco de JSON-LD e preservado de proposito: ele tambem e <script>,
// mas e conteudo de verdade, lido por buscador e por IA, e um nicho que
// vazasse para la contaria tanto quanto um vazado para o texto.
function conteudoDaPagina(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, ' ');
}

// Ganchos de verificacao: atributo, nunca classe de estilo.
//
// Antes estas verificacoes casavam em `class="servico-resposta"` e
// `class="guia-corpo"`. Isso amarrava o harness ao CSS: renomear uma
// classe por motivo visual derrubava o build, e acrescentar uma segunda
// classe ao mesmo elemento derrubava tambem, porque a regex exigia a
// aspa logo depois do nome. Atributo `data-*` nao tem funcao de estilo,
// entao nada em CSS tem motivo para mexer nele.

/** Texto do paragrafo marcado com data-resposta, ou null se nao existir. */
function respostaDiretaDe(html) {
  const m = html.match(/<p[^>]*\sdata-resposta[^>]*>([\s\S]*?)<\/p>/);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

/** Bloco marcado com o atributo dado, do inicio da tag ao fechamento. */
function blocoPorAtributo(html, atributo, tag) {
  const re = new RegExp(`<${tag}[^>]*\\s${atributo}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = html.match(re);
  return m ? m[1] : null;
}

// O cabecalho aparece em todas as paginas e linka para todas as paginas,
// inclusive para a que o visitante esta lendo, que e o comportamento
// certo de um menu. Verificacao de link do CONTEUDO precisa entao olhar
// a pagina sem o cabecalho, senao acusa como defeito o menu funcionando.
function semCabecalho(html) {
  return html.replace(/<header[\s\S]*?<\/header>/i, ' ');
}

// O indice /guias/ NAO e guia: ele e pagina institucional que so lista
// titulos. Guia mesmo e /guias/<slug>/. A distincao importa porque as
// excecoes de nicho e de preco valem so para o conteudo do guia, e o
// indice sem guarda nenhuma foi um buraco real achado em review.
function ehGuia(rota) {
  return rota.startsWith('/guias/') && rota !== '/guias/';
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


check('/sobre menciona a cidade base sem posicionar por nicho', () => {
  const sobre = lerDist('sobre/index.html');
  assert(sobre.includes('Resende'), 'sem a cidade base');
  const encontrado = nichoEncontradoEm(normalizar(conteudoDaPagina(sobre)));
  assert(!encontrado, `nicho vazou para /sobre: radical "${encontrado}"`);
});


check('o rodapé traz localização, Instagram e link para /sobre', () => {
  assert(home.includes('Resende, RJ'), 'rodape sem a localizacao');
  assert(
    home.includes('https://www.instagram.com/rafo.tech/'),
    'rodape sem link do Instagram'
  );
  assert(/href="\/sobre\/"/.test(home), 'rodape sem link para /sobre/');
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

// ---------------------------------------------------------------
// Fase 2, Task 2: verificacoes que valem para toda pagina construida
// ---------------------------------------------------------------
console.log('\nToda pagina construida');

// Enumera o dist em vez de citar pagina por nome. Na Fase 1 as checagens
// de nicho e de preco listavam index.html e sobre/index.html na mao, e
// teriam ficado para tras assim que uma rota nova entrasse. Assim, toda
// pagina criada daqui pra frente entra na cobertura sozinha.
function paginasHtml() {
  const encontradas = [];
  const varrer = (dir, prefixo) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        varrer(caminho, `${prefixo}${entrada.name}/`);
      } else if (entrada.name === 'index.html') {
        encontradas.push({
          rota: prefixo || '/',
          caminho,
          html: readFileSync(caminho, 'utf-8'),
        });
      }
    }
  };
  varrer(dist, '/');
  return encontradas;
}

function canonicalDe(html) {
  const m = html.match(/<link rel="canonical" href="([^"]+)"/);
  return m ? m[1] : null;
}

const PAGINAS = paginasHtml();

// Rotas institucionais, que sao fixas e precisam existir sempre. Os guias
// nao entram aqui de proposito: eles crescem, e uma lista fixa viraria
// manutencao a cada guia novo, que e exatamente o tipo de coisa que fica
// para tras. Guias tem suas proprias verificacoes mais abaixo.
const ROTAS_FIXAS = [
  '/',
  '/agentes-whatsapp/',
  '/contato/',
  '/guias/',
  '/presenca-no-google/',
  '/sites-institucionais/',
  '/sobre/',
];

check('o build gerou todas as paginas institucionais', () => {
  const rotas = PAGINAS.map((p) => p.rota).sort();
  console.log(`         rotas construidas: ${rotas.join(' ')}`);
  const faltando = ROTAS_FIXAS.filter((r) => !rotas.includes(r));
  assert(
    faltando.length === 0,
    `rotas institucionais ausentes: ${faltando.join(' ')}`
  );
  const inesperadas = rotas.filter((r) => !ROTAS_FIXAS.includes(r) && !r.startsWith('/guias/'));
  assert(
    inesperadas.length === 0,
    `rotas inesperadas, que nao sao institucionais nem guia: ${inesperadas.join(' ')}`
  );
});

// Pagina que nenhum link interno alcanca e orfa: o visitante nao chega
// nela navegando, e o buscador da a ela prioridade minima de rastreio,
// por mais que ela esteja no sitemap. Foi assim que /contato/ nasceu.
check('toda pagina e alcancavel por link interno de outra pagina', () => {
  for (const pagina of PAGINAS) {
    if (pagina.rota === '/') continue; // a home e a raiz, nao precisa de quem aponte
    const apontam = PAGINAS.filter(
      (outra) => outra.rota !== pagina.rota && outra.html.includes(`href="${pagina.rota}"`)
    );
    assert(
      apontam.length > 0,
      `${pagina.rota} e orfa: nenhuma outra pagina linka para ela, so o sitemap a conhece`
    );
  }
});

// Guia PODE citar nicho, e so ele. A regra real nunca foi "a palavra
// clinica nao pode existir": era a empresa nao se posicionar por nicho.
// Num guia, "uma clinica que recebe 40 mensagens por dia" e exemplo que
// faz o texto valer, e proibir isso empobreceria o conteudo sem proteger
// nada. O que substitui a guarda aqui e a checagem de linguagem de
// posicionamento, logo abaixo na secao de guias, que roda so nos guias.
check('nenhuma pagina institucional contem radical de nicho', () => {
  for (const pagina of PAGINAS) {
    if (ehGuia(pagina.rota)) continue;
    const achado = nichoEncontradoEm(normalizar(conteudoDaPagina(pagina.html)));
    assert(!achado, `nicho "${achado}" vazou para a pagina ${pagina.rota}`);
  }
});

// Lista de permissao, nao de proibicao. Todo preco publico da empresa e
// conhecido, entao a forma forte da regra e "nenhum valor alem destes",
// que pega R$ 600 e R$ 850 tambem, e nao so os seis valores de fundacao
// que alguem lembrou de listar.
const PRECOS_PUBLICOS_PERMITIDOS = ['97', '48,50'];

// Mesmo split que o de nicho, e pela mesma razao. Em pagina
// institucional, todo valor em reais e preco da empresa, entao lista de
// permissao e a forma certa. Num guia, valor em reais quase sempre e
// numero de mercado citado com fonte, que e justamente o que faz o guia
// responder a pergunta do titulo. O que nao pode em lugar nenhum, guia
// inclusive, e preco de fundacao nosso: isso continua valendo abaixo.
check('nenhuma pagina institucional mostra valor em reais fora do preco publico', () => {
  for (const pagina of PAGINAS) {
    if (ehGuia(pagina.rota)) continue;
    // Milhar com ponto e centavos com virgula de dois digitos. Escrito
    // assim para nao engolir a pontuacao da frase: "R$ 97, mas" daria o
    // valor "97," e "R$ 97." daria "97.".
    const valores = [
      ...conteudoDaPagina(pagina.html).matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g),
    ].map((m) => m[1]);
    for (const valor of valores) {
      assert(
        PRECOS_PUBLICOS_PERMITIDOS.includes(valor),
        `a pagina ${pagina.rota} mostra R$ ${valor}, que nao e preco publico aprovado`
      );
    }
  }
});

// O par da excecao acima. Guia pode citar numero de mercado, mas o nosso
// preco de fundacao nao pode aparecer em lugar nenhum, e sem esta
// verificacao os guias ficariam sem guarda de preco alguma.
check('nenhuma pagina expoe preco de fundacao nosso', () => {
  for (const pagina of PAGINAS) {
    for (const valor of PRECOS_DE_FUNDACAO) {
      assert(
        !conteudoDaPagina(pagina.html).includes(`R$ ${valor}`),
        `preco de fundacao R$ ${valor} exposto na pagina ${pagina.rota}`
      );
    }
  }
});

check('toda pagina tem canonical, apontando para ela mesma', () => {
  for (const pagina of PAGINAS) {
    const canonical = canonicalDe(pagina.html);
    assert(canonical, `pagina ${pagina.rota} sem canonical`);
    const esperado = `https://rafolabs.tech${pagina.rota}`;
    assert(
      canonical === esperado,
      `canonical de ${pagina.rota} aponta para "${canonical}", esperado "${esperado}"`
    );
  }
});

check('toda pagina tem title e description proprios e nao vazios', () => {
  const titulos = new Map();
  const descricoes = new Map();
  for (const pagina of PAGINAS) {
    const t = pagina.html.match(/<title>([^<]*)<\/title>/);
    const d = pagina.html.match(/<meta name="description" content="([^"]*)"/);
    // Limite superior tambem: o Google corta o title por volta de 60
    // caracteres e a description por volta de 160, entao o que passa
    // disso nao chega ao resultado de busca.
    assert(t && t[1].trim().length > 10, `title ausente ou curto em ${pagina.rota}`);
    assert(t[1].trim().length <= 62, `title de ${pagina.rota} tem ${t[1].trim().length} caracteres, o Google corta perto de 60`);
    assert(d && d[1].trim().length > 50, `description ausente ou curta em ${pagina.rota}`);
    assert(d[1].trim().length <= 160, `description de ${pagina.rota} tem ${d[1].trim().length} caracteres, o Google corta perto de 160`);
    assert(!titulos.has(t[1]), `title repetido entre ${titulos.get(t[1])} e ${pagina.rota}`);
    assert(!descricoes.has(d[1]), `description repetida entre ${descricoes.get(d[1])} e ${pagina.rota}`);
    titulos.set(t[1], pagina.rota);
    descricoes.set(d[1], pagina.rota);
  }
});

check('toda pagina esta no sitemap, e o sitemap nao lista pagina inexistente', () => {
  const sitemap = lerDist('sitemap-0.xml');
  const noSitemap = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  const construidas = PAGINAS.map((p) => `https://rafolabs.tech${p.rota}`).sort();
  assert(
    JSON.stringify(noSitemap) === JSON.stringify(construidas),
    `sitemap e paginas construidas divergem.\n         sitemap:     ${noSitemap.join(' ')}\n         construidas: ${construidas.join(' ')}`
  );
});

check('todo campo url de JSON-LD de pagina bate com o canonical dela', () => {
  for (const pagina of PAGINAS) {
    const canonical = canonicalDe(pagina.html);
    const grafo = grafoDe(pagina.html);
    // So os nos que representam A PAGINA carregam url de pagina. Os nos
    // de entidade (ProfessionalService, WebSite) apontam para a home de
    // proposito e sao ignorados aqui.
    for (const node of grafo) {
      if (!['AboutPage', 'ContactPage', 'WebPage', 'Service', 'Article'].includes(node['@type'])) continue;
      if (typeof node.url !== 'string') continue;
      assert(
        node.url === canonical,
        `em ${pagina.rota}, o no ${node['@type']} diz url "${node.url}" mas o canonical e "${canonical}"`
      );
    }
  }
});

// ---------------------------------------------------------------
// Fase 2, Task 3: paginas de servico
// ---------------------------------------------------------------
console.log('\nPaginas de servico');

const ROTAS_DE_SERVICO = ['/presenca-no-google/', '/agentes-whatsapp/', '/sites-institucionais/'];
const empresaWhatsapp = 'https://wa.me/5524992695804';

function paginaDaRota(rota) {
  const p = PAGINAS.find((x) => x.rota === rota);
  assert(p, `pagina ${rota} nao foi construida`);
  return p;
}

check('/presenca-no-google/ existe e traz o preco de R$ 97', () => {
  const pagina = paginaDaRota('/presenca-no-google/');
  assert(pagina.html.includes('R$ 97'), 'a pagina nao mostra o preco de R$ 97');
  assert(pagina.html.includes('R$ 48,50'), 'a pagina nao mostra a variante de R$ 48,50');
});

check('a Presenca no Google declara Offer com preco estruturado', () => {
  const pagina = paginaDaRota('/presenca-no-google/');
  const grafo = grafoDe(pagina.html);
  const servico = no(grafo, 'Service');
  assert(servico.name === 'Presença no Google', `name errado: ${servico.name}`);
  const oferta = servico.offers;
  assert(oferta, 'Service sem offers');
  assert(oferta.price === 97, `price errado: ${oferta.price}`);
  assert(oferta.priceCurrency === 'BRL', 'priceCurrency nao e BRL');
  assert(servico.provider?.['@id'], 'Service sem provider apontando para a entidade');
});

check('as outras duas paginas de servico nao mostram nenhum preco', () => {
  for (const rota of ['/agentes-whatsapp/', '/sites-institucionais/']) {
    const pagina = paginaDaRota(rota);
    const grafo = grafoDe(pagina.html);
    const servico = no(grafo, 'Service');
    assert(
      servico.offers?.price === undefined,
      `${rota} declara preco estruturado, e so a Presenca no Google pode`
    );
  }
});

check('toda pagina de servico tem FAQPage batendo com o FAQ visivel', () => {
  for (const rota of ROTAS_DE_SERVICO) {
    const pagina = paginaDaRota(rota);
    const grafo = grafoDe(pagina.html);
    const faq = no(grafo, 'FAQPage');
    assert(faq.mainEntity.length >= 3, `${rota} tem so ${faq.mainEntity.length} perguntas`);
    for (const q of faq.mainEntity) {
      assert(pagina.html.includes(q.name), `${rota}: pergunta do schema ausente da pagina: "${q.name}"`);
      assert(
        pagina.html.includes(q.acceptedAnswer.text),
        `${rota}: resposta do schema ausente da pagina: "${q.acceptedAnswer.text}"`
      );
    }
  }
});

check('toda pagina de servico responde a pergunta no primeiro paragrafo', () => {
  for (const rota of ROTAS_DE_SERVICO) {
    const pagina = paginaDaRota(rota);
    const texto = respostaDiretaDe(pagina.html);
    assert(texto !== null, `${rota} sem o paragrafo de resposta direta`);
    assert(texto.length > 120, `${rota}: resposta direta curta demais (${texto.length} caracteres)`);
  }
});

check('toda pagina de servico linka de volta para a home e tem CTA de WhatsApp', () => {
  for (const rota of ROTAS_DE_SERVICO) {
    const pagina = paginaDaRota(rota);
    // Sem o cabecalho: o logo do menu linka para a home em toda pagina,
    // entao contar com ele faria esta verificacao passar para sempre sem
    // olhar nada. O que se quer garantir e a trilha dentro do conteudo.
    const corpo = semCabecalho(pagina.html);
    assert(corpo.includes('href="/"'), `${rota} nao linka de volta para a home fora do cabecalho`);
    assert(corpo.includes(empresaWhatsapp), `${rota} nao tem CTA de WhatsApp no conteudo`);
  }
});

check('cada pagina de servico linka para as outras duas, e nunca para si mesma', () => {
  for (const rota of ROTAS_DE_SERVICO) {
    const pagina = paginaDaRota(rota);
    const outras = ROTAS_DE_SERVICO.filter((r) => r !== rota);
    for (const outra of outras) {
      assert(
        pagina.html.includes(`href="${outra}"`),
        `${rota} nao linka para ${outra}, o link cruzado entre servicos esta faltando`
      );
    }
    // Auto link NO CONTEUDO e sintoma de o filtro do layout estar
    // errado, e gasta credibilidade com o visitante que clica e nao sai
    // do lugar. No cabecalho e o oposto: o menu tem que listar a pagina
    // atual, e a checagem logo abaixo cobra que ela venha marcada.
    const corpo = semCabecalho(pagina.html);
    const autoLinks = corpo.split(`href="${rota}"`).length - 1;
    assert(autoLinks === 0, `${rota} linka para ela mesma ${autoLinks} vez(es) fora do cabecalho`);
  }
});

// ---------------------------------------------------------------
// Fase 2, Task 6: pagina de contato
// ---------------------------------------------------------------
console.log('\nPagina de contato');

check('/contato/ existe com ContactPage e os canais reais', () => {
  const pagina = paginaDaRota('/contato/');
  const grafo = grafoDe(pagina.html);
  no(grafo, 'ContactPage');
  assert(pagina.html.includes(empresaWhatsapp), 'sem link de WhatsApp');
  assert(pagina.html.includes('instagram.com/rafo.tech'), 'sem link do Instagram');
  assert(pagina.html.includes('Resende'), 'sem a cidade base');
});

// Pagina de contato e onde mais se inventa dado plausivel: um email que
// ninguem le, um horario de atendimento que ninguem combinou. A empresa
// publicou WhatsApp, telefone, Instagram e cidade. Nada alem disso pode
// aparecer.
check('/contato/ nao inventa canal que a empresa nao tem', () => {
  const pagina = paginaDaRota('/contato/');

  // Forma positiva: todo destino externo da pagina precisa ser um canal
  // que a empresa publicou. Uma lista de proibicoes so pega o que alguem
  // lembrou de proibir, e deixa passar um "Atendimento das 9h as 18h" ou
  // um telefone que nao existe.
  // So <a>, e so para fora do proprio dominio: canonical, og:url e links
  // internos nao sao canal de contato.
  const PERMITIDOS = [empresaWhatsapp, 'https://www.instagram.com/rafo.tech/'];
  const externos = [...pagina.html.matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"/g)]
    .map((m) => m[1])
    .filter((destino) => !destino.startsWith('https://rafolabs.tech'));
  for (const destino of externos) {
    assert(
      PERMITIDOS.includes(destino),
      `a pagina de contato aponta para "${destino}", que nao e um canal publicado pela empresa`
    );
  }

  assert(!pagina.html.includes('mailto:'), 'a pagina de contato oferece email, que a empresa nao publicou');
});

// ---------------------------------------------------------------
// Fase 2, Task 7: arquivos de IA cobrem as rotas novas
// ---------------------------------------------------------------
console.log('\nArquivos de IA x rotas construidas');

// Deriva a lista das paginas realmente construidas, entao qualquer rota
// criada na Fase 3 vai cobrar sua propria entrada no llms.txt sem ninguem
// precisar lembrar de editar checagem.
check('llms.txt lista toda pagina construida, com a barra final', () => {
  const txt = lerDist('llms.txt');
  for (const pagina of PAGINAS) {
    const url = `https://rafolabs.tech${pagina.rota}`;
    assert(txt.includes(url), `llms.txt nao cita a pagina construida ${url}`);
  }
});

check('llms-full.txt aponta cada servico para a pagina dele', () => {
  const txt = lerDist('llms-full.txt');
  for (const rota of ROTAS_DE_SERVICO) {
    assert(
      txt.includes(`https://rafolabs.tech${rota}`),
      `llms-full.txt nao aponta para ${rota}`
    );
  }
});

// ---------------------------------------------------------------
// Fase 3A: guias
// ---------------------------------------------------------------
console.log('\nGuias');

const GUIAS = PAGINAS.filter((p) => ehGuia(p.rota));

check('existe ao menos um guia construido', () => {
  assert(GUIAS.length > 0, 'nenhuma rota /guias/<slug>/ no dist');
  console.log(`         guias construidos: ${GUIAS.map((g) => g.rota).join(' ')}`);
});

/**
 * Como `check`, mas para verificacoes que percorrem os guias. Existe
 * porque um laco sobre array vazio passa trivialmente: sem isso, com zero
 * guias construidos, sete verificacoes reportariam `ok` sem ter olhado
 * nada. Aqui a lista vazia e falha, nao sucesso.
 */
function checkPorGuia(nome, fn) {
  check(nome, () => {
    assert(GUIAS.length > 0, 'nenhum guia construido, entao esta verificacao nao olhou nada');
    for (const guia of GUIAS) fn(guia);
  });
}

checkPorGuia('todo guia responde a pergunta no primeiro paragrafo', (guia) => {
    const texto = respostaDiretaDe(guia.html);
    assert(texto !== null, `${guia.rota} sem o paragrafo de resposta direta`);
    assert(texto.length >= 200, `${guia.rota}: resposta direta com ${texto.length} caracteres, minimo 200`);
});

checkPorGuia('todo guia tem Article com datas coerentes e publisher', (guia) => {
    const artigo = no(grafoDe(guia.html), 'Article');
    assert(artigo.headline, `${guia.rota}: Article sem headline`);
    assert(artigo.datePublished, `${guia.rota}: Article sem datePublished`);
    assert(artigo.dateModified, `${guia.rota}: Article sem dateModified`);
    assert(artigo.publisher?.['@id'], `${guia.rota}: Article sem publisher apontando para a entidade`);
    assert(artigo.author?.['@id'], `${guia.rota}: Article sem author`);
    // Atualizado antes de publicado e incoerente, e o Google trata data
    // de artigo como sinal. E o tipo de erro que um copiar e colar de
    // frontmatter produz sem ninguem notar.
    assert(
      artigo.dateModified >= artigo.datePublished,
      `${guia.rota}: dateModified (${artigo.dateModified}) e anterior a datePublished (${artigo.datePublished})`
    );
});

// O spec da Fase 3 fixa de 800 a 1500 palavras por guia. Abaixo disso o
// texto nao responde de verdade e nao compete; acima, costuma ser enchimento.
checkPorGuia('todo guia tem entre 800 e 1500 palavras de corpo', (guia) => {
    const corpo = blocoPorAtributo(guia.html, 'data-corpo', 'div');
    assert(corpo, `${guia.rota} sem o corpo do guia`);
    const palavras = corpo
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .filter((p) => p.length > 1).length;
    assert(
      palavras >= 800 && palavras <= 1500,
      `${guia.rota} tem ${palavras} palavras de corpo, fora da faixa de 800 a 1500`
    );
});

checkPorGuia('todo guia tem FAQPage batendo com o FAQ visivel', (guia) => {
    const faq = no(grafoDe(guia.html), 'FAQPage');
    assert(faq.mainEntity.length >= 3, `${guia.rota} tem so ${faq.mainEntity.length} perguntas`);
    for (const q of faq.mainEntity) {
      assert(guia.html.includes(q.name), `${guia.rota}: pergunta do schema ausente da pagina: "${q.name}"`);
      assert(
        guia.html.includes(q.acceptedAnswer.text),
        `${guia.rota}: resposta do schema ausente da pagina`
      );
    }
});

checkPorGuia('todo guia tem BreadcrumbList de tres niveis, na ordem certa', (guia) => {
    const trilha = no(grafoDe(guia.html), 'BreadcrumbList');
    const itens = trilha.itemListElement;
    assert(itens.length === 3, `${guia.rota}: trilha com ${itens.length} niveis, esperado 3`);
    assert(itens[0].item === 'https://rafolabs.tech/', 'primeiro nivel nao e a home');
    assert(itens[1].item === 'https://rafolabs.tech/guias/', 'segundo nivel nao e o indice de guias');
    assert(itens[2].item === `https://rafolabs.tech${guia.rota}`, 'terceiro nivel nao e o proprio guia');
    for (let i = 0; i < itens.length; i += 1) {
      assert(itens[i].position === i + 1, `posicao errada no nivel ${i + 1}`);
    }
});

checkPorGuia('todo guia tem bloco de resumo citavel', (guia) => {
    const resumo = blocoPorAtributo(guia.html, 'data-resumo', 'ul');
    assert(resumo, `${guia.rota} sem o bloco de resumo`);
    const itens = (resumo.match(/<li/g) ?? []).length;
    assert(itens >= 3, `${guia.rota}: resumo com ${itens} itens, minimo 3`);
});

// Este e o par da excecao aberta acima: guia pode citar nicho como
// exemplo, o resto do site nao pode citar de jeito nenhum, e nem o guia
// pode usar nicho como POSICIONAMENTO. A diferenca e entre ilustrar
// ("uma clinica que recebe 40 mensagens") e posicionar ("somos
// especializados em clinicas").
//
// Esta lista casa larga de proposito, entao pode acusar um uso legitimo,
// como "profissional especializado" num contexto que nao e sobre a
// empresa. Se isso acontecer, a saida e reescrever a frase do guia, nao
// enfraquecer a lista: falso positivo aqui e barulhento e barato, falso
// negativo publica posicionamento por nicho sem ninguem ver.
check('o indice de guias lista todo guia construido', () => {
  const indice = PAGINAS.find((p) => p.rota === '/guias/');
  assert(indice, 'a rota /guias/ nao foi construida');
  assert(GUIAS.length > 0, 'nenhum guia construido, entao esta verificacao nao olhou nada');
  for (const guia of GUIAS) {
    assert(
      indice.html.includes(`href="${guia.rota}"`),
      `o indice nao lista ${guia.rota}, entao o guia so e alcancavel pelo sitemap`
    );
  }
});

checkPorGuia('guia nao usa nicho como posicionamento da empresa', (guia) => {
  const texto = normalizar(conteudoDaPagina(guia.html).replace(/<[^>]+>/g, ' '));

  // Duas formas de detectar, porque uma lista de palavras soltas erra
  // dos dois lados. "especializad" sozinho acusa "blogs especializados",
  // que nao posiciona nada, e ao mesmo tempo deixa passar "atendemos
  // clinicas", que posiciona.
  //
  // Forma 1, proximidade: palavra de posicionamento perto de um radical
  // de nicho. E o padrao real de "somos especializados em clinicas".
  const posicionadoras = ['especializad', 'focad', 'voltad', 'dedicad', 'feito para', 'ideal para'];
  for (const palavra of posicionadoras) {
    for (const nicho of TERMOS_DE_NICHO) {
      const perto = new RegExp(`${palavra}[^.]{0,60}\\b${nicho}|\\b${nicho}[^.]{0,60}${palavra}`);
      const achado = texto.match(perto);
      assert(
        !achado,
        `${guia.rota} posiciona por nicho: "${achado?.[0]?.slice(0, 80)}"`
      );
    }
  }

  // Forma 2, primeira pessoa: a empresa dizendo que atende um nicho.
  // Nao precisa de proximidade porque a construcao ja e o posicionamento.
  for (const nicho of TERMOS_DE_NICHO) {
    const primeiraPessoa = new RegExp(
      `(atendemos|trabalhamos com|somos a agencia de|nosso foco (e|sao))\\s+\\w{0,12}\\s?\\b${nicho}`
    );
    const achado = texto.match(primeiraPessoa);
    assert(
      !achado,
      `${guia.rota} posiciona por nicho em primeira pessoa: "${achado?.[0]?.slice(0, 80)}"`
    );
  }
});

checkPorGuia('guia nao inventa estatistica de resultado', (guia) => {
  // Alvo estreito de proposito: alegacao de RESULTADO com numero, que e a
  // forma que estatistica fabricada assume. Um numero de mercado citado
  // com fonte no texto e permitido pelo spec e nao pode cair aqui, entao
  // um "%" solto nao dispara: so dispara colado a palavra de resultado.
  // Tres direcoes, porque em portugues a alegacao de resultado aparece
  // nas tres e cobrir so uma e teatro. A primeira versao desta guarda
  // pegava "reduz em 40" e deixava passar "reducao de 40%", que e a forma
  // mais comum das duas.
  const promessa = new RegExp(
    [
      // numero primeiro: "40% a mais de conversao", "3x mais rapido"
      '\\d+\\s*%\\s*(de\\s+|d[oe]s?\\s+)?(reducao|aumento|economia|conversao|a\\s+mais|a\\s+menos|dos?\\s)',
      '\\d+\\s*(x|vezes)\\s+(mais|menos)',
      // substantivo primeiro: "reducao de 40%", "aumento de 25% nas vendas"
      '(reducao|aumento|economia|queda|ganho|crescimento)\\s+de\\s+\\d+',
      // verbo primeiro, com objeto no meio: "reduz o custo em 40%"
      '(aumenta|reduz|economiza|multiplica|triplica|dobra)\\w*\\s+([\\w\\s]{0,25}\\s)?(em\\s+)?\\d+',
    ].join('|'),
    'i'
  );
  const texto = normalizar(conteudoDaPagina(guia.html).replace(/<[^>]+>/g, ' '));
  const achado = texto.match(promessa);
  assert(
    !achado,
    `${guia.rota} traz "${achado?.[0]}", que e alegacao de resultado com numero. A empresa nao tem case, entao isso nao pode existir`
  );
});

checkPorGuia('todo guia linka para o servico relacionado e para o indice', (guia) => {
    // Sem o cabecalho de novo: ele linka para tudo em toda pagina, entao
    // deixa-lo aqui faria esta verificacao passar mesmo com um guia que
    // nao leva a lugar nenhum, que e exatamente o que ela existe para
    // impedir.
    const corpo = semCabecalho(guia.html);
    assert(corpo.includes('href="/guias/"'), `${guia.rota} nao linka de volta para o indice`);
    const servicosRotas = ['/presenca-no-google/', '/agentes-whatsapp/', '/sites-institucionais/'];
    const linkados = servicosRotas.filter((s) => corpo.includes(`href="${s}"`));
    assert(
      linkados.length > 0,
      `${guia.rota} nao linka para nenhuma pagina de servico, o guia nao leva a lugar nenhum`
    );
});

// ---------------------------------------------------------------
// Navegacao e acessibilidade
// ---------------------------------------------------------------
console.log('\nNavegacao e acessibilidade');

// Rotas que o menu precisa oferecer em qualquer pagina. A home fica de
// fora porque quem a alcanca e o logo, nao um item de lista.
const ROTAS_DO_MENU = [
  '/presenca-no-google/',
  '/agentes-whatsapp/',
  '/sites-institucionais/',
  '/guias/',
  '/sobre/',
  '/contato/',
];

check('toda pagina tem cabecalho com o menu completo', () => {
  for (const pagina of PAGINAS) {
    const m = pagina.html.match(/<header[\s\S]*?<\/header>/i);
    assert(m, `${pagina.rota} nao tem cabecalho`);
    const cabecalho = m[0];
    assert(cabecalho.includes('href="/"'), `${pagina.rota}: cabecalho sem link para a home`);
    for (const rota of ROTAS_DO_MENU) {
      assert(
        cabecalho.includes(`href="${rota}"`),
        `${pagina.rota}: cabecalho nao oferece ${rota}`
      );
    }
  }
});

// aria-current e o que diz a um leitor de tela onde a pessoa esta. Sem
// isso o menu vira seis links iguais e a orientacao se perde justamente
// para quem mais depende dela.
check('o cabecalho marca a pagina atual com aria-current', () => {
  const visitadas = PAGINAS.filter((p) => ROTAS_DO_MENU.includes(p.rota));
  assert(
    visitadas.length === ROTAS_DO_MENU.length,
    `esperava ${ROTAS_DO_MENU.length} paginas de menu construidas, achei ${visitadas.length}`
  );
  for (const pagina of visitadas) {
    const cabecalho = pagina.html.match(/<header[\s\S]*?<\/header>/i)[0];
    // Casa a tag <a> inteira que aponta para a rota, e cobra a marca
    // dentro dela. Procurar aria-current solto no cabecalho passaria com
    // a marca na tag errada.
    const tags = [...cabecalho.matchAll(new RegExp(`<a[^>]*href="${pagina.rota}"[^>]*>`, 'g'))];
    assert(tags.length > 0, `${pagina.rota}: o cabecalho nao linka para a propria pagina`);
    const marcadas = tags.filter((t) => t[0].includes('aria-current="page"'));
    assert(
      marcadas.length === tags.length,
      `${pagina.rota}: ${tags.length - marcadas.length} de ${tags.length} link(s) do menu para a propria pagina sem aria-current="page"`
    );
  }
});

check('toda pagina tem link de pular para o conteudo', () => {
  for (const pagina of PAGINAS) {
    assert(
      /class="pular-para-conteudo"[^>]*href="#conteudo"/.test(pagina.html),
      `${pagina.rota} sem link de pular para o conteudo`
    );
    assert(pagina.html.includes('id="conteudo"'), `${pagina.rota} sem o alvo id="conteudo"`);
  }
});

// Esta e a verificacao mais importante desta secao, e nasceu de um
// defeito real: o padrao do [data-reveal] era opacity 0 e a classe que
// devolvia a visibilidade vinha do JS. Quem chegasse sem JS, e qualquer
// rastreador que nao execute script, recebia a pagina em branco.
//
// A regra virou: esconder conteudo so dentro do escopo
// .sem-scroll-timeline, que so existe quando o proprio JS ja confirmou
// que consegue revelar de volta.
//
// Frases que ESTA guarda tem que reprovar:
//   [data-reveal]{opacity:0}
//   [data-reveal]{opacity:0;transform:translateY(18px)}
//   @media (min-width:900px){[data-reveal]{opacity:0}}
// Frases que ela tem que deixar passar:
//   .sem-scroll-timeline [data-reveal]{opacity:0;transform:translateY(18px)}
//   [data-reveal]{animation:reveal-subir linear both}
//   @keyframes reveal-subir{from{opacity:0;transform:translateY(18px)}}
//   @media (prefers-reduced-motion:reduce){[data-reveal]{opacity:1}}
//   [data-reveal]{opacity:0.9}
function escondeRevealSemEscopo(css) {
  // Separar por chave de fechamento isola cada bloco com o seletor que o
  // abriu. Nao e um parser de CSS, e nao precisa ser: so precisa nunca
  // juntar o seletor de um bloco com as declaracoes de outro.
  const culpados = [];
  for (const bloco of css.split('}')) {
    if (!bloco.includes('[data-reveal]')) continue;
    // opacity:0 mas nao opacity:0.9 nem opacity:0.5
    if (!/opacity\s*:\s*0(?![.\d])/.test(bloco)) continue;
    if (bloco.includes('sem-scroll-timeline')) continue;
    culpados.push(bloco.trim().slice(0, 120));
  }
  return culpados;
}

check('nenhum conteudo depende de JS para ficar visivel', () => {
  const dirAstro = join(dist, '_astro');
  assert(existsSync(dirAstro), 'dist/_astro nao existe, entao esta verificacao nao olhou nada');
  const folhas = readdirSync(dirAstro).filter((f) => f.endsWith('.css'));
  assert(folhas.length > 0, 'nenhum CSS construido, entao esta verificacao nao olhou nada');

  let viuReveal = false;
  for (const folha of folhas) {
    const css = readFileSync(join(dirAstro, folha), 'utf-8');
    if (css.includes('[data-reveal]')) viuReveal = true;
    const culpados = escondeRevealSemEscopo(css);
    assert(
      culpados.length === 0,
      `${folha} esconde [data-reveal] fora do escopo .sem-scroll-timeline: ${culpados.join(' | ')}`
    );
  }
  assert(viuReveal, 'nenhum CSS construido menciona [data-reveal], o seletor mudou de nome?');
});

if (falhas > 0) {
  console.error(`\n${falhas} verificacao(oes) falharam\n`);
  process.exit(1);
}
console.log('\ntodas as verificacoes passaram\n');
