// src/data/empresa.ts
//
// Fonte única de verdade sobre os fatos públicos da R.A.F.O.
//
// Consumido por:
//   - src/lib/schema.ts            (JSON-LD)
//   - src/pages/llms.txt.ts        (mapa para IA)
//   - src/pages/llms-full.txt.ts   (narrativa para IA)
//   - src/components/Faq.astro     (FAQ visível)
//   - src/components/SiteFooter.astro
//
// Regra: nenhum fato público (telefone, cidade, preço, pergunta de FAQ)
// é escrito direto num componente. Se dois lugares precisam do mesmo
// fato, ele mora aqui. JSON-LD que diverge do texto visível é violação
// de diretriz do Google, e duplicar o fato é exatamente como isso
// acontece na prática.

import { servicos, type Servico } from './servicos';

export type { Servico };

export interface PerguntaFrequente {
  pergunta: string;
  resposta: string;
}

export interface Fundador {
  nome: string;
  papel: string;
}

export interface Empresa {
  nome: string;
  url: string;
  descricaoCurta: string;
  descricaoLonga: string;
  telefone: string;
  whatsapp: string;
  endereco: { cidade: string; uf: string; pais: string };
  atendimento: string;
  perfis: string[];
  fundador: Fundador | null;
  servicos: Servico[];
  faq: PerguntaFrequente[];
  casosDeUso: string[];
}

export const empresa: Empresa = {
  nome: 'R.A.F.O.',
  url: 'https://rafolabs.tech',

  descricaoCurta:
    'Automação de atendimento no WhatsApp, sites institucionais e perfil no Google para pequenos negócios.',

  descricaoLonga:
    'A R.A.F.O. ajuda pequenos negócios a ter presença online profissional e a automatizar o atendimento no WhatsApp, sem a complexidade nem o custo de uma agência grande. O atendimento é direto com o fundador, e cada solução é construída em cima do fluxo real do negócio, não em cima de um pacote pronto.',

  telefone: '+5524992695804',
  whatsapp: 'https://wa.me/5524992695804',

  endereco: { cidade: 'Resende', uf: 'RJ', pais: 'BR' },

  atendimento: 'Baseada em Resende, RJ. Atende todo o Brasil de forma remota.',

  // Perfis públicos oficiais. Vira `sameAs` no JSON-LD, que é o que
  // permite a buscadores e assistentes de IA confirmarem que a empresa
  // é uma entidade real. Só entram perfis confirmados como da empresa.
  // ATENÇÃO: a conta @rafotech no Instagram NÃO é da R.A.F.O.
  perfis: ['https://www.instagram.com/rafo.tech/'],

  // Fica null enquanto o nome público do fundador não for definido. O
  // nó `founder` do JSON-LD simplesmente não é emitido nesse caso.
  fundador: null,

  servicos,

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
      pergunta: 'Quanto tempo leva pra ficar pronto?',
      resposta:
        'Depende do seu fluxo hoje, mas o processo começa com uma conversa pra entender exatamente isso.',
    },
    {
      pergunta: 'Funciona pro meu tipo de negócio?',
      resposta:
        'Se o seu contato com cliente é majoritariamente por WhatsApp e agenda, muito provavelmente sim.',
    },
  ],

  // Exemplos de tipos de negócio atendidos. Usado SOMENTE em
  // llms-full.txt e no conteúdo dos guias. Nunca no texto visível: o
  // site é peça geral e não se posiciona por nicho (decisão do fundador,
  // 2026-08-11). A lista existe para que a IA saiba responder quando a
  // pergunta do usuário for de nicho.
  casosDeUso: [
    'Clínicas e consultórios, incluindo odontologia, estética e fisioterapia',
    'Salões de beleza e barbearias',
    'Clínicas veterinárias',
    'Escolas, cursos e profissionais autônomos',
    'Prestadores de serviço que agendam atendimento por WhatsApp',
  ],
};
