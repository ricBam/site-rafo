# R.A.F.O.: Site institucional

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
