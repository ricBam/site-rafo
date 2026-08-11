// src/content.config.ts
//
// Collection dos guias. O frontmatter é validado por Zod de propósito:
// os mesmos campos alimentam o texto visível e o JSON-LD, então um campo
// faltando precisa quebrar o build, não publicar uma página pela metade.

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const guias = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guias' }),
  schema: z.object({
    /** `<title>` e H1. Até 62 caracteres, que é onde o Google corta. */
    titulo: z.string().min(20).max(62),
    /** `<meta name="description">`. Até 160 caracteres. */
    descricao: z.string().min(70).max(160),
    /** A pergunta que o guia responde, em uma frase. */
    pergunta: z.string().min(15),
    /**
     * Resposta direta, o primeiro parágrafo da página. É o trecho que
     * assistentes de IA extraem, então responde de cara, sem introdução
     * de aquecimento.
     */
    resposta: z.string().min(200),
    publicadoEm: z.coerce.date(),
    atualizadoEm: z.coerce.date(),
    /** Slug do serviço que este guia alimenta, ou null. */
    servicoRelacionado: z
      .enum(['presenca-no-google', 'agentes-whatsapp', 'sites-institucionais'])
      .nullable(),
    /** Bloco de resumo citável, no fim do guia. */
    resumo: z.array(z.string().min(20)).min(3),
    faq: z
      .array(z.object({ pergunta: z.string().min(10), resposta: z.string().min(30) }))
      .min(3),
  }),
});

export const collections = { guias };
