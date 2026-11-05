# Validação executada

## Inicialização automática no Windows

- `iniciar.bat` aceita Node.js 24 global ou prepara uma cópia portátil em `.runtime/node`, sem alterar o Windows ou exigir administrador. O instalador consulta somente `nodejs.org`, seleciona a versão 24 mais recente para x64/ARM64, valida o SHA-256 publicado e só então extrai o pacote.
- O índice oficial foi consultado durante esta validação: os pacotes Windows x64 e ARM64 e seus checksums estavam disponíveis. A política da empresa ainda pode bloquear `nodejs.org` ou `registry.npmjs.org`; essa liberação depende do suporte de TI.
- `npm test`: 30 testes passaram, incluindo a detecção de uma instância já aberta e de conflito de porta sem encerrar outros processos. `npm run build` e `npm run format:check` também passaram.
- Este ambiente não possui um executor Windows ou acesso ao computador do usuário. O fluxo PowerShell/BAT foi verificado por código, pacotes oficiais e testes dos componentes Node; a execução completa do duplo clique precisa ocorrer no Windows de destino.

Validação nesta instância em 04/11/2026:

- `npm ci --cache /workspace/.cache/npm --no-audit --no-fund --offline`: instalação limpa pelo lockfile, 155 pacotes (antes da inclusão da ferramenta Prettier). A primeira tentativa foi interrompida pela sandbox na validação do binário esbuild; a execução autorizada concluiu sem desabilitar verificações. Prettier foi instalado posteriormente pelo npm com atualização do lockfile.
- `npm test`: 17 testes passaram, 0 falhas e 0 ignorados. A integração usa PGlite em memória e papel SQL sem propriedade/superusuário para testar RLS. Inclui sessão, ausência de preços para técnicos, isolamento entre técnicos, retransmissão idempotente, conflito de revisão, auditoria e aprovação → entrega → instalação em visita de retorno → check-out. Domínio cobre valores reais da referência, imutabilidade, justificativas e validação de anexos.
- `npm run build`: TypeScript e Vite concluídos; precache do service worker gerado com 11 arquivos. Há aviso de bundle principal maior que 500 kB (aproximadamente 221 kB gzip); não impede build.
- `npm run format:check`: formatação validada.
- `python3 tests/browser.py`: Chromium desktop 1440×1000 e móvel 390×844; cadastro/atribuição pelo gestor, atendimento pelo técnico, laudo, compressão de foto, assinatura desenhada, saída, PDF e sincronização. Zero erros de JavaScript e sem transbordamento horizontal na tela verificada.
- `SL_URL=http://127.0.0.1:4173 SL_OFFLINE=1 python3 tests/browser.py`: build PWA, service worker, desligamento da rede após check-in, laudo e foto recuperados após recarga offline, solicitação de peça, assinatura, check-out e PDF sem rede, reconexão e sincronização concluída.
- `python3 tests/lan.py`: duas origens no Chromium, localhost e IP HTTP sem contexto seguro. Criação de OS pelo gestor, recebimento automático pelo técnico, UUID/check-in sem `crypto.randomUUID`, alteração de TypeScript em cópia isolada, reload automático do computador, reload do celular adiado durante laudo e recuperação do texto após aplicar a nova versão. A rede da nuvem bloqueou o IP LAN direto com HTTP 403; a verificação usou um relay de teste para loopback, mantendo a origem insegura no navegador. Não equivale à validação do Firewall/roteador do usuário.
- `python3 tests/updates.py`: instalação inicial de PWA, detecção de nova versão, aplicação automática em repouso, adiamento com campo focado, preservação de rascunho IndexedDB e proteção quando outra aba ativa a nova versão.
- Reinício nativo `node --watch` verificado em cópia isolada: alteração de módulo reiniciou a API, com fechamento/reabertura do banco e preservação da conta e da OS 41250.
- Capturas `identidade-login.png`, `identidade-desktop.png` e `identidade-mobile.png`: paleta azul/amarela, marca reconstruída da captura e composição diagonal. Sem transbordamento horizontal em 390 px.
- PDF baixado verificado com `pdftotext`: laudo, foto com legenda, responsável fictício, horários e indicação explícita de nenhuma instalação.

Artefatos locais em `test-results/`: capturas desktop/mobile/assinatura e relatório PDF fictício. Os testes criam OS fictícias com prefixo E2E; a OS 41250 foi preservada. Não foram usados dados pessoais reais dos PDFs.

Não executados: aparelhos Android/iOS físicos, Safari/WebKit, PostgreSQL externo, implantação HTTPS pública, testes de carga, restauração de backup em produção e auditoria independente de segurança/LGPD. As instruções de instalação e início foram salvas no rascunho do ambiente; publicação e restauração em uma nova tarefa ainda não foram verificadas.

## Sincronização bidirecional dos dados

- `npm test`: 17 testes de domínio, API e sincronização; todos passaram. Inclui autorização do SSE para gestor/técnicos, reatribuição de OS, erro isolado em uma OS, resposta perdida durante nova edição, conciliação de campos independentes, conflito verdadeiro no mesmo campo e fotografias adicionadas por dispositivos diferentes.
- `python3 tests/realtime.py`: duas sessões de navegador conectadas ao mesmo backend. OS criada no computador apareceu no celular; check-in e diagnóstico do celular apareceram no computador; medição alterada no computador apareceu no celular, sem recarregar. Desconexão/reconexão com edições em campos diferentes conciliou os dois lados. Com SSE bloqueado, o fallback recuperou os dados sem duplicar a visita. Requisição HTTP presa foi abortada pelo prazo configurado.
- `python3 tests/lan.py`: repetido incluindo explicitamente os dois sentidos de atualização de dados em origem HTTP insegura por IP (com relay de teste local devido à política da nuvem), além da atualização da versão do código.

A rede particular e o computador Windows do usuário não são acessíveis a partir desta instância; a correção precisa ser instalada e o iniciador antigo reiniciado nesses aparelhos.

## Limpeza solicitada da instância

Exclusão executada pela interface autenticada de administrador: havia 10 chamados e 1 técnico (Lucas); após a operação, 0 chamados e 0 técnicos. O acesso administrativo permaneceu válido. Captura em `test-results/operacao-vazia.png`.

Os testes de exclusão verificam inicialização vazia, bloqueio de exclusão por técnico/gestor, transação de limpeza, remoção dos snapshots, HTTP 410 para reenvio de chamado excluído, remoção das sessões dos técnicos, preservação de gestor/administrador e ausência de recriação dos exemplos no reinício.

Essa limpeza foi feita na instância acessível desta tarefa. Um banco que esteja no computador do usuário precisa receber a mesma ação administrativa pela interface local.

## Correções dos avisos de sincronização e perfis

- `npm test`: 25 testes, incluindo OS preenchida antes do primeiro envio, campos legados opcionais, mensagens por campo, migração de gestor mantendo senha/referências, revogação do login antigo e exclusão individual restrita a administrador.
- `tests/requests.py` com banco temporário: rascunho da conta antiga foi recuperado, o aviso “Nova OS deve começar pendente...” foi resolvido sem apagar o laudo, uma OS criada/iniciada offline foi enviada após reconectar, os dois campos removidos não apareceram, uma foto acima de 1,6 milhão de caracteres foi reduzida automaticamente e a exclusão de uma OS não afetou outra. Técnico não viu o botão e recebeu HTTP 403 ao tentar excluir pela API.
- Os testes completos de formulário/fotos/assinatura/PDF, sincronização bidirecional e origem HTTP local foram repetidos com o login único do administrador e banco temporário.

A conta antiga de gestor fica arquivada e sem acesso, preservando suas referências históricas. A senha do administrador principal não é alterada.

## Exclusões individual/em lote e OS 44918

- `npm test`: 28 testes passaram. Novos casos cobrem IDs numéricos e antigos, chaves com barras/pontos/sublinhados, identidade primária diferente do JSON interno, recusa de requisição malformada sem excluir dados e limpeza exclusiva/idempotente da OS 44918.
- `tests/requests.py`, em banco temporário: os dois botões excluíram os rascunhos legados sem o aviso “Identificação de atendimento inválida”. O teste também inseriu um rascunho numérico 44918 no IndexedDB e confirmou sua remoção automática pela manutenção solicitada, preservando os outros registros até a ação explícita de exclusão em lote.
- A manutenção usa apenas o identificador exato 44918 e mantém seu marcador em `applied_maintenance`. Testes confirmam que a OS 41250 permaneceu e que uma segunda execução não criou nova exclusão/auditoria.

A remoção do banco que roda no computador do usuário ocorrerá quando essa versão for instalada e a API reiniciada; esta tarefa não tem acesso direto à máquina particular.
