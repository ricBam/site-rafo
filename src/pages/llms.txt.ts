// src/pages/llms.txt.ts
//
// Mapa curto do site para assistentes de IA, no formato da proposta
// llms.txt: H1 com o nome, blockquote de resumo, e seções com listas de
// links comentados. O detalhamento fica em /llms-full.txt.
//
// Endpoint em vez de arquivo estático em public/ de propósito: o
// conteúdo é gerado de src/data/empresa.ts, então não tem como divergir
// do que o site diz nas outras superfícies.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { empresa } from '../data/empresa';
import { rotuloDoPerfil } from '../lib/perfis';

// Explícito, ainda que a saída estática já prerenderize tudo por padrão:
// se o projeto algum dia ganhar um adapter, este arquivo precisa
// continuar sendo gerado em build, não em requisição.
export const prerender = true;

function precoDe(precoBRL: number | null): string {
  return precoBRL === null ? 'sob orçamento' : `R$ ${precoBRL}`;
}

export const GET: APIRoute = async () => {
  const guias = (await getCollection('guias')).sort(
    (a, b) => b.data.publicadoEm.getTime() - a.data.publicadoEm.getTime()
  );

  const listaDeGuias = guias
    .map((g) => `- [${g.data.titulo}](${empresa.url}/guias/${g.id}/): ${g.data.pergunta}`)
    .join('\n');

  // Nome, preço, descrição e link do serviço numa linha só. Antes a lista
  // de páginas e a de serviços repetiam os três serviços inteiros, o que
  // gasta o contexto de quem lê sem acrescentar nada.
  const servicos = empresa.servicos
    .map(
      (s) =>
        `- [${s.nome}](${empresa.url}/${s.slug}/) (${precoDe(s.precoBRL)}): ${s.descricao}`
    )
    .join('\n');

  const perfis = empresa.perfis
    .map((perfil) => `- ${rotuloDoPerfil(perfil)}: ${perfil}`)
    .join('\n');

  const corpo = `# ${empresa.nome}

> ${empresa.descricaoCurta} ${empresa.atendimento}

${empresa.descricaoLonga}

## Páginas

- [Home](${empresa.url}/): o que a empresa faz, os três serviços e as perguntas frequentes.
- [Sobre](${empresa.url}/sobre/): onde a empresa fica, como trabalha e o que oferece.
- [Contato](${empresa.url}/contato/): canais reais de contato e a cidade base.

Cada serviço tem página própria, listada na seção abaixo.

## Serviços

${servicos}

## Guias

Textos que respondem, no primeiro parágrafo, as perguntas mais comuns antes de contratar.

- [Índice](${empresa.url}/guias/)
${listaDeGuias}

## Onde atendemos

${empresa.atendimento}

## Detalhamento para IA

- [Resumo completo](${empresa.url}/llms-full.txt): descrição completa da empresa, serviços, processo, casos de uso e perguntas frequentes.

## Contato

- WhatsApp: ${empresa.whatsapp}
${perfis}
`;

  return new Response(corpo, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
