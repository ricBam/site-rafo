// src/lib/schema.ts
//
// Monta os nós JSON-LD a partir de src/data/empresa.ts. Funções puras,
// sem nada de Astro, para poderem ser lidas e testadas isoladamente.
//
// Todos os nós usam @id estável para poderem se referenciar entre si
// dentro de um único @graph, que é o formato que buscadores e
// assistentes de IA interpretam melhor do que blocos soltos.

import { empresa } from '../data/empresa';
import type { Servico } from '../data/servicos';
import type { PerguntaFrequente } from '../data/empresa';

export const ID_NEGOCIO = `${empresa.url}/#negocio`;
const ID_SITE = `${empresa.url}/#site`;

/**
 * Identidade estável de um serviço, usada dos dois lados: no catálogo de
 * ofertas da empresa e no nó dedicado da página do serviço. Sem isso, o
 * mesmo produto aparece como duas entidades soltas com o mesmo nome e o
 * mesmo preço, e quem faz resolução de entidade vê duas ofertas onde
 * existe uma.
 */
const idServico = (slug: string) => `${empresa.url}/${slug}/#servico`;
const urlServico = (slug: string) => `${empresa.url}/${slug}/`;

/** A entidade da empresa. É o nó que permite resolver "R.A.F.O." como negócio real. */
export function negocioNode(): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@type': 'ProfessionalService',
    '@id': ID_NEGOCIO,
    name: empresa.nome,
    description: empresa.descricaoLonga,
    url: `${empresa.url}/`,
    logo: `${empresa.url}/logo/rafo-compact.png`,
    image: `${empresa.url}/og/default.png`,
    telephone: empresa.telefone,
    address: {
      '@type': 'PostalAddress',
      addressLocality: empresa.endereco.cidade,
      addressRegion: empresa.endereco.uf,
      addressCountry: empresa.endereco.pais,
    },
    areaServed: [
      { '@type': 'City', name: `${empresa.endereco.cidade}, ${empresa.endereco.uf}` },
      { '@type': 'Country', name: 'Brasil' },
    ],
    sameAs: empresa.perfis,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: empresa.telefone,
      url: empresa.whatsapp,
      availableLanguage: ['pt-BR'],
    },
    knowsAbout: [
      'Automação de atendimento no WhatsApp',
      'Agentes autônomos de atendimento',
      'Google Meu Negócio',
      'Sites institucionais',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `Serviços da ${empresa.nome}`,
      itemListElement: empresa.servicos.map((servico) => {
        const oferta: Record<string, unknown> = {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            '@id': idServico(servico.slug),
            name: servico.nome,
            description: servico.descricao,
            serviceType: servico.nome,
            url: urlServico(servico.slug),
            provider: { '@id': ID_NEGOCIO },
          },
        };
        // Só a Presença no Google tem preço público. O preço de fundação
        // dos outros dois é temporário e não pode virar âncora pública.
        if (servico.precoBRL !== null) {
          oferta.price = servico.precoBRL;
          oferta.priceCurrency = 'BRL';
        }
        return oferta;
      }),
    },
  };

  if (empresa.fundador !== null) {
    node.founder = {
      '@type': 'Person',
      name: empresa.fundador.nome,
      jobTitle: empresa.fundador.papel,
    };
  }

  return node;
}

/** O site como obra publicada pela entidade acima. */
export function siteNode(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': ID_SITE,
    name: empresa.nome,
    url: `${empresa.url}/`,
    inLanguage: 'pt-BR',
    publisher: { '@id': ID_NEGOCIO },
  };
}

/**
 * FAQ estruturado, gerado do mesmo array que renderiza o FAQ visível.
 * Schema que diverge do texto visível é violação de diretriz do Google,
 * e a única defesa confiável é não ter duas cópias do conteúdo.
 */
export function faqNode(): Record<string, unknown> {
  return faqNodeDe(empresa.faq);
}

/**
 * Um guia como artigo publicado pela empresa. O autor é a própria
 * entidade, e não uma pessoa, porque o nome público do fundador ainda
 * não foi definido (ver `empresa.fundador`). Quando for, vale trocar
 * aqui: autor pessoa fortalece E-E-A-T mais que autor organização.
 */
export function artigoNode(
  dados: {
    titulo: string;
    descricao: string;
    publicadoEm: Date;
    atualizadoEm: Date;
  },
  canonical: string
): Record<string, unknown> {
  return {
    '@type': 'Article',
    headline: dados.titulo,
    description: dados.descricao,
    url: canonical,
    mainEntityOfPage: canonical,
    datePublished: dados.publicadoEm.toISOString().slice(0, 10),
    dateModified: dados.atualizadoEm.toISOString().slice(0, 10),
    author: { '@id': ID_NEGOCIO },
    publisher: { '@id': ID_NEGOCIO },
    inLanguage: 'pt-BR',
  };
}

/** Trilha de navegação. Só vale a pena a partir do terceiro nível. */
export function trilhaNode(itens: { nome: string; url: string }[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.nome,
      item: item.url,
    })),
  };
}

/** FAQPage a partir de um FAQ qualquer, para as páginas que têm o seu. */
export function faqNodeDe(faq: PerguntaFrequente[]): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: item.resposta },
    })),
  };
}

/**
 * O serviço como oferta da empresa, para a página dedicada dele.
 * `canonical` entra como `url` para o nó nunca discordar do canonical da
 * própria página, que foi um defeito real da Fase 1.
 */
export function servicoNode(servico: Servico, canonical: string): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@type': 'Service',
    // Mesmo @id do item no catálogo de ofertas da empresa, de propósito:
    // é o que faz os dois nós resolverem para um único produto.
    '@id': idServico(servico.slug),
    name: servico.nome,
    description: servico.descricao,
    serviceType: servico.nome,
    url: canonical,
    provider: { '@id': ID_NEGOCIO },
    areaServed: [
      { '@type': 'City', name: `${empresa.endereco.cidade}, ${empresa.endereco.uf}` },
      { '@type': 'Country', name: 'Brasil' },
    ],
  };

  // Só a Presença no Google tem preço público. As outras duas estão em
  // preço de fundação, que é temporário e não pode virar âncora pública.
  if (servico.precoBRL !== null) {
    node.offers = {
      '@type': 'Offer',
      price: servico.precoBRL,
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      url: canonical,
    };
  }

  return node;
}
