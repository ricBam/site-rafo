# R.A.F.O.: Site institucional

## Webhook do Instagram

O endpoint de produção é `https://rafolabs.tech/api/instagram/webhook`. Ele é
executado pelo servidor Node do Astro (não pelo navegador) e atende às duas
requisições da Meta:

- `GET`: confirma o Verify Token e devolve o `hub.challenge`;
- `POST`: valida `X-Hub-Signature-256` com HMAC-SHA256 antes de encaminhar o
  JSON para a integração configurada.

Crie as variáveis de ambiente no provedor de hospedagem (nunca no código):

```env
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=um-segredo-longo-e-aleatorio
INSTAGRAM_APP_SECRET=app-secret-da-meta
# Opcional: URL HTTPS interna/da sua automação que processará os eventos
INSTAGRAM_WEBHOOK_FORWARD_URL=https://seu-servico.exemplo/webhooks/instagram
```

O encaminhamento é opcional. Sem `INSTAGRAM_WEBHOOK_FORWARD_URL`, os eventos
válidos são apenas confirmados com `200 OK`; portanto, configure uma URL de
destino se precisar armazenar ou agir sobre mensagens, comentários e menções.

No painel da Meta, informe a URL acima como **Callback URL**, use exatamente o
mesmo valor de `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` em **Verify token** e assine os
campos desejados. A URL pública precisa estar em HTTPS com certificado válido.

## Propostas comerciais (`/propostas/{cliente}`)

Cada proposta comercial é uma subpasta dentro de `public/propostas/`,
nomeada com um slug, contendo seu próprio `index.html`. Para propostas com
informação sensível, evite usar o nome real do cliente diretamente no slug:
prefira um slug com sufixo aleatório, por exemplo `cliente-x-7f2a`.

O caminho `/propostas/` inteiro é excluído de indexação por buscadores via
`robots.txt`, mas isso não é controle de acesso de verdade, já que o próprio
`robots.txt` é público e legível por qualquer um. Ou seja, qualquer pessoa
com a URL exata consegue ver a proposta. Trate a URL em si como a única
proteção que existe e não confie nela para nada altamente sensível.
