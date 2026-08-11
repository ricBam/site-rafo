// src/lib/perfis.ts
//
// Rotula uma URL de perfil publico (empresa.perfis) com o nome da rede
// social a que ela pertence. Usado em toda superficie que lista perfis:
// o rodape visivel e os dois arquivos de IA (llms.txt, llms-full.txt).
//
// Lookup explicito em vez de adivinhar pelo dominio: derivar o rotulo de
// "m.facebook.com" pegando o primeiro pedaco do hostname produziria "M".
// Dominio desconhecido cai no hostname inteiro, que fica feio mas nunca
// fica errado.

const ROTULOS_DE_PERFIL: Record<string, string> = {
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'linkedin.com': 'LinkedIn',
  'youtube.com': 'YouTube',
  'tiktok.com': 'TikTok',
  'github.com': 'GitHub',
};

export function rotuloDoPerfil(url: string): string {
  const hostname = new URL(url).hostname.replace(/^(www|m)\./, '');
  return ROTULOS_DE_PERFIL[hostname] ?? hostname;
}
