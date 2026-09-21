// src/data/servicos.ts
//
// Catálogo único dos serviços da R.A.F.O.
//
// Antes da Fase 2 estes dados viviam em dois lugares, `empresa.servicos`
// e um array literal dentro de Services.astro, o que garantia divergência
// com o tempo. Agora tudo mora aqui: a identidade do serviço, o preço, a
// copy do card da home e o conteúdo da página dedicada.
//
// Consumido por:
//   - src/data/empresa.ts             (reexporta em empresa.servicos)
//   - src/components/Services.astro   (cards da home)
//   - src/layouts/ServicoLayout.astro (páginas de serviço)
//   - src/lib/schema.ts               (JSON-LD, via empresa.servicos)
//
// Regra de copy: nenhum texto aqui posiciona a empresa por nicho, e
// nenhum número de resultado é inventado. Nenhum serviço tem preço público:
// tudo é sob orçamento. A Presença no Google saiu do catálogo em
// 2026-09-21, por decisão do fundador: o site mostra só sites e
// agentes de IA.

import type { PerguntaFrequente } from './empresa';

export interface Servico {
  slug: string;
  nome: string;
  /** Descrição curta e neutra. Vai para o JSON-LD e para os arquivos de IA. */
  descricao: string;
  /** Copy do card na home, em segunda pessoa. */
  chamadaHome: string;
  /** Nome do ícone em src/components/Icon.astro. */
  icone: 'whatsapp' | 'site';
  /** Preço público em reais, ou null quando é sob orçamento. */
  precoBRL: number | null;
  precoNota: string;

  /** `<title>` da página dedicada. */
  tituloPagina: string;
  /** `<meta name="description">` da página dedicada. */
  descricaoPagina: string;
  /**
   * Primeiro parágrafo da página. É o trecho que assistentes de IA
   * extraem, então responde a pergunta direto, sem introdução de
   * aquecimento.
   */
  resposta: string;
  incluso: string[];
  comoFunciona: string[];
  faq: PerguntaFrequente[];
}

export const servicos: Servico[] = [
  {
    slug: 'agentes-whatsapp',
    nome: 'Agentes autônomos para WhatsApp',
    descricao:
      'Atendimento e agendamento automatizados, construídos em cima do jeito que o negócio já funciona hoje.',
    chamadaHome:
      'Atendimento e agendamento automatizado, construído em cima do jeito que seu negócio já funciona hoje, sem forçar você a mudar sua rotina pra caber numa ferramenta pronta.',
    icone: 'whatsapp',
    precoBRL: null,
    precoNota:
      'Sob orçamento, definido depois de uma conversa para entender o fluxo de atendimento atual.',
    tituloPagina:
      'Agentes autônomos para WhatsApp: atendimento automatizado',
    descricaoPagina:
      'Automação de atendimento no WhatsApp sob medida para o fluxo do seu negócio. Responde, qualifica e agenda 24 horas por dia, no número que você já usa.',
    resposta:
      'Um agente autônomo de WhatsApp é uma automação que atende seus clientes no número que você já usa, 24 horas por dia. Ele responde as perguntas de sempre, qualifica quem chega e agenda, e transfere a conversa para você a qualquer momento que o cliente pedir. A gente constrói em cima do fluxo que seu negócio já tem, em vez de encaixar você numa ferramenta pronta.',
    incluso: [
      'Mapeamento do seu atendimento atual, incluindo as perguntas que mais se repetem',
      'Construção do agente em cima do seu número, sem trocar de número e sem perder o histórico',
      'Agendamento integrado, quando o seu negócio trabalha com agenda',
      'Passagem para atendimento humano a qualquer momento, por pedido do cliente ou por regra sua',
      'Acompanhamento próximo depois de entrar no ar, ajustando com base em conversa real',
    ],
    comoFunciona: [
      'Conversamos sobre como o seu atendimento funciona hoje, o que se repete e onde você perde cliente.',
      'Construímos o agente em cima desse fluxo real e testamos com você antes de qualquer cliente falar com ele.',
      'Colocamos no ar, acompanhamos as primeiras conversas de verdade e ajustamos até ficar do jeito certo.',
    ],
    faq: [
      {
        pergunta: 'Preciso trocar de número de WhatsApp?',
        resposta: 'Não, a automação entra no número que você já usa.',
      },
      {
        pergunta: 'E se o cliente quiser falar com uma pessoa de verdade?',
        resposta: 'A qualquer momento ele pode pedir, e você assume a conversa.',
      },
      {
        pergunta: 'O cliente percebe que está falando com uma automação?',
        resposta:
          'A gente não finge que é humano. O agente é direto e resolve rápido, e quem quiser falar com você é passado na hora. Enganar cliente quebra confiança e não vale o ganho.',
      },
      {
        pergunta: 'Quanto custa?',
        resposta:
          'Sob orçamento. O preço depende do seu fluxo de atendimento, e por isso o processo começa com uma conversa para entender isso antes de falar em número.',
      },
    ],
  },
  {
    slug: 'sites-institucionais',
    nome: 'Sites institucionais',
    descricao:
      'Presença online profissional, rápida de lançar e fácil de manter.',
    chamadaHome:
      'Presença online profissional, rápida de lançar e fácil de manter, sem a complexidade nem o preço de uma agência grande.',
    icone: 'site',
    precoBRL: null,
    precoNota: 'Sob orçamento, definido depois de entender o escopo.',
    tituloPagina:
      'Sites institucionais: rápidos, leves e fáceis de manter',
    descricaoPagina:
      'Site institucional feito para carregar rápido no celular, passar confiança e levar o visitante direto ao seu WhatsApp. Sem construtor genérico.',
    resposta:
      'Um site institucional é a página que mostra quem você é, o que você entrega e como falar com você. O que a gente faz é um site rápido no celular, com o caminho até o seu WhatsApp curto e claro, e fácil de manter depois. Não usamos construtor genérico com subdomínio de terceiro, porque isso passa a impressão errada logo na primeira olhada.',
    incluso: [
      'Site com domínio próprio, carregando rápido no celular, que é onde a maior parte do seu cliente vai abrir',
      'Estrutura pensada para o visitante entender o que você faz e chegar ao contato sem procurar',
      'Botão de WhatsApp em lugar visível, sem formulário que ninguém preenche',
      'Dados estruturados e metadados corretos, para o site aparecer bem na busca e no compartilhamento de link',
      'Entrega com o site no ar e no seu domínio, não um arquivo para você se virar',
    ],
    comoFunciona: [
      'Conversamos sobre o que o seu cliente precisa saber antes de decidir falar com você.',
      'Construímos o site em cima disso e você revisa antes de qualquer coisa ir ao ar.',
      'Publicamos no seu domínio e deixamos combinado como pedir ajuste depois.',
    ],
    faq: [
      {
        pergunta: 'Eu preciso já ter um domínio?',
        resposta:
          'Não. Se você ainda não tem, a gente orienta na compra e configura. Se já tem, mesmo que esteja fora do ar, dá para reaproveitar.',
      },
      {
        pergunta: 'Depois de pronto, eu consigo mexer sozinho?',
        resposta:
          'Alterações de texto e de imagem a gente combina como fazer. O site é feito para ser leve e simples de manter, não para prender você em ferramenta.',
      },
      {
        pergunta: 'Quanto tempo leva?',
        resposta:
          'Depende do tamanho do site e da velocidade com que o conteúdo chega. A conversa inicial já dá uma noção realista de prazo.',
      },
      {
        pergunta: 'Quanto custa?',
        // Nenhum número aqui, de propósito. Esta resposta é o
        // acceptedAnswer de uma Question chamada "Quanto custa?" na
        // página de sites: qualquer valor citado nela, mesmo sendo de
        // outro produto, vira o preço do site na resposta de uma IA.
        resposta:
          'Sob orçamento, definido depois de entender o escopo. O que mais mexe no valor é quantas páginas o site precisa ter, quem escreve os textos e o que precisa ser integrado. A conversa inicial já dá uma noção realista, e ela não custa nada.',
      },
    ],
  },
];
