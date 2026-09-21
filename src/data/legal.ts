// src/data/legal.ts
//
// As páginas legais (LGPD). Lista única para o rodapé, o aviso de cookies
// e o llms.txt não divergirem sobre quais existem e onde ficam.
//
// `atualizadoEm` é a data que aparece no topo de cada página. Mudou o
// texto de uma política, muda a data dela aqui.

export interface PaginaLegal {
  slug: string;
  nome: string;
  atualizadoEm: string;
}

export const paginasLegais = {
  privacidade: {
    slug: 'politica-de-privacidade',
    nome: 'Política de Privacidade',
    atualizadoEm: '21 de setembro de 2026',
  },
  cookies: {
    slug: 'politica-de-cookies',
    nome: 'Política de Cookies',
    atualizadoEm: '21 de setembro de 2026',
  },
  termos: {
    slug: 'termos-de-uso',
    nome: 'Termos de Uso',
    atualizadoEm: '21 de setembro de 2026',
  },
} satisfies Record<string, PaginaLegal>;

export const listaPaginasLegais: PaginaLegal[] = Object.values(paginasLegais);
