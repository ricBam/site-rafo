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

const ROTAS_ESPERADAS = [
  '/',
  '/agentes-whatsapp/',
  '/contato/',
  '/presenca-no-google/',
  '/sites-institucionais/',
  '/sobre/',
];

check('o build gerou exatamente as paginas esperadas', () => {
  const rotas = PAGINAS.map((p) => p.rota).sort();
  console.log(`         rotas construidas: ${rotas.join(' ')}`);
  assert(
    JSON.stringify(rotas) === JSON.stringify(ROTAS_ESPERADAS),
    `rotas divergem do esperado.\n         esperado:    ${ROTAS_ESPERADAS.join(' ')}\n         construidas: ${rotas.join(' ')}`
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

check('nenhuma pagina contem radical de nicho, visivel ou em atributo', () => {
  for (const pagina of PAGINAS) {
    const achado = nichoEncontradoEm(normalizar(conteudoDaPagina(pagina.html)));
    assert(!achado, `nicho "${achado}" vazou para a pagina ${pagina.rota}`);
  }
});

// Lista de permissao, nao de proibicao. Todo preco publico da empresa e
// conhecido, entao a forma forte da regra e "nenhum valor alem destes",
// que pega R$ 600 e R$ 850 tambem, e nao so os seis valores de fundacao
// que alguem lembrou de listar.
const PRECOS_PUBLICOS_PERMITIDOS = ['97', '48,50'];

check('nenhuma pagina mostra valor em reais que nao seja preco publico', () => {
  for (const pagina of PAGINAS) {
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
      if (!['AboutPage', 'ContactPage', 'WebPage', 'Service'].includes(node['@type'])) continue;
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
    const m = pagina.html.match(/<p class="servico-resposta"[^>]*>([\s\S]*?)<\/p>/);
    assert(m, `${rota} sem o paragrafo de resposta direta`);
    const texto = m[1].replace(/<[^>]+>/g, '').trim();
    assert(texto.length > 120, `${rota}: resposta direta curta demais (${texto.length} caracteres)`);
  }
});

check('toda pagina de servico linka de volta para a home e tem CTA de WhatsApp', () => {
  for (const rota of ROTAS_DE_SERVICO) {
    const pagina = paginaDaRota(rota);
    assert(pagina.html.includes('href="/"'), `${rota} nao linka de volta para a home`);
    assert(pagina.html.includes(empresaWhatsapp), `${rota} nao tem CTA de WhatsApp`);
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
    // Auto link e sintoma de o filtro do layout estar errado, e gasta
    // credibilidade com o visitante que clica e nao sai do lugar.
    const autoLinks = pagina.html.split(`href="${rota}"`).length - 1;
    assert(autoLinks === 0, `${rota} linka para ela mesma ${autoLinks} vez(es)`);
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

if (falhas > 0) {
  console.error(`\n${falhas} verificacao(oes) falharam\n`);
  process.exit(1);
}
console.log('\ntodas as verificacoes passaram\n');
