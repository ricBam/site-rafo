// src/pages/presenca-no-google.ts
//
// A Presença no Google saiu do site em 2026-09-21. A URL já estava
// indexada e em link compartilhado, então responde 301 para a home em vez
// de 404. Precisa ser rota de servidor: em produção quem serve o site é o
// Node do Astro (ver Dockerfile), e página estática não emite 301.
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ redirect }) => redirect('/', 301);
