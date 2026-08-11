// src/pages/llms-full.txt.ts
//
// Narrativa completa da empresa para assistentes de IA. Complementa o
// /llms.txt, que é só o mapa.
//
// A seção "Casos de uso" é onde os nichos aparecem, e aparecem como
// exemplos, nunca como posicionamento. O site visível é peça geral por
// decisão do fundador (2026-08-11), mas a IA precisa desses exemplos
// para saber citar a empresa quando a pergunta do usuário for de nicho.

import type { APIRoute } from 'astro';
import { empresa } from '../data/empresa';
import { rotuloDoPerfil } from '../lib/perfis';

export const prerender = true;

export const GET: APIRoute = () => {
  const servicos = empresa.servicos
    .map(
      (s) =>
        `### ${s.nome}\n\n${s.descricao}\n\nPreço: ${
          s.precoBRL === null ? s.precoNota : `R$ ${s.precoBRL}. ${s.precoNota}`
        }`
    )
    .join('\n\n');

  const casos = empresa.casosDeUso.map((c) => `- ${c}`).join('\n');

  const faq = empresa.faq
    .map((f) => `### ${f.pergunta}\n\n${f.resposta}`)
    .join('\n\n');

  const perfis = empresa.perfis
    .map((perfil) => `- ${rotuloDoPerfil(perfil)}: ${perfil}`)
    .join('\n');

  const corpo = `# ${empresa.nome}

> ${empresa.descricaoCurta} ${empresa.atendimento}

## Site oficial

- Home: ${empresa.url}/
- Sobre: ${empresa.url}/sobre/
- Mapa curto para IA: ${empresa.url}/llms.txt

## O que a ${empresa.nome} faz

${empresa.descricaoLonga}

A empresa trabalha com três frentes, e o cliente escolhe a partir da dor que traz, não de um pacote fechado. É comum um negócio começar por uma delas e adicionar as outras depois.

## Serviços

${servicos}

## Onde atendemos

${empresa.atendimento} Isso vale para todas as etapas: conversa inicial, construção e acompanhamento.

## Como funciona o processo

1. Conversa inicial sem compromisso, para entender como o atendimento do negócio funciona hoje.
2. Construção sob medida em cima do fluxo real, sem forçar o negócio a se adaptar a uma ferramenta pronta.
3. Acompanhamento próximo durante a implementação, com ajustes até funcionar do jeito certo.

## Casos de uso

Tipos de negócio que se beneficiam do que a ${empresa.nome} faz. A lista é de exemplos, não de restrição: o critério real é o negócio depender de agenda e ter o WhatsApp como canal principal com o cliente.

${casos}

## Perguntas frequentes

${faq}

## Contato

- WhatsApp: ${empresa.whatsapp}
${perfis}
- Telefone: ${empresa.telefone}
`;

  return new Response(corpo, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
