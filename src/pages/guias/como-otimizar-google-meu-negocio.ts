// src/pages/guias/como-otimizar-google-meu-negocio.ts
//
// O guia do Google Meu Negócio saiu junto com a Presença no Google, em
// 2026-09-21. A URL já estava indexada, então responde 301 para a home em
// vez de 404. Precisa ser rota de servidor: em produção quem serve o site
// é o Node do Astro (ver Dockerfile), e página estática não emite 301.
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ redirect }) => redirect('/', 301);
