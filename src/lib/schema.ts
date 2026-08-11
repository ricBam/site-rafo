// src/lib/schema.ts
//
// Monta os nós JSON-LD a partir de src/data/empresa.ts. Funções puras,
// sem nada de Astro, para poderem ser lidas e testadas isoladamente.
//
// Todos os nós usam @id estável para poderem se referenciar entre si
// dentro de um único @graph, que é o formato que buscadores e
// assistentes de IA interpretam melhor do que blocos soltos.

import { empresa } from '../data/empresa';

const ID_NEGOCIO = `${empresa.url}/#negocio`;
const ID_SITE = `${empresa.url}/#site`;

/** A entidade da empresa. É o nó que permite resolver "R.A.F.O." como negócio real. */
export function negocioNode(): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@type': 'ProfessionalService',
    '@id': ID_NEGOCIO,
    name: empresa.nome,
    description: empresa.descricaoLonga,
    url: empresa.url,
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
            name: servico.nome,
            description: servico.descricao,
            serviceType: servico.nome,
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
    url: empresa.url,
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
  return {
    '@type': 'FAQPage',
    mainEntity: empresa.faq.map((item) => ({
      '@type': 'Question',
      name: item.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: item.resposta },
    })),
  };
}
