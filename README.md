# SL Campo

Sistema de manutenção com foco no atendimento pelo celular. Código React/TypeScript, API Node, PostgreSQL, laudos, fotos, assinatura, dois PDFs e persistência offline. Leia [arquitetura e limites](docs/ARQUITETURA.md).

## Desenvolvimento

Requer Node.js 24+, npm. Use o checkout existente; não precisa criar worktree.

```sh
npm ci
cp .env.example .env
# Edite .env: DEMO_MODE=true e DEMO_PASSWORD com 12+ caracteres.
npm run dev
```

Vite: porta 5173, API: porta 3001. O motor PostgreSQL embarcado inicializa em `.data/postgres`. Não apague `.data` para atualizar dependências. As tabelas são criadas automaticamente de modo idempotente.

Na primeira inicialização demonstrativa são criadas três contas com a senha configurada em `DEMO_PASSWORD`:

- `tecnico@slcampo.local`: Lucas Ferreira, técnico.
- `gestor@slcampo.local`: Marina Costa, gestor.
- `admin@slcampo.local`: administrador.

Os usuários de exemplo são fictícios. A seed contém somente a OS 41250 anonimizada. Contas não são recriadas se o banco já tiver usuários. Mudar `DEMO_PASSWORD` após o primeiro boot não altera as senhas existentes.

## Iniciar no Windows

Instale o **Node.js 24 ou superior**, com npm, e dê dois cliques em `iniciar.bat` na pasta do projeto. Também é possível executá-lo pelo Prompt de Comando. Mantenha a janela aberta enquanto usar o sistema; `Ctrl+C` encerra os serviços.

O arquivo verifica o Node, instala dependências com `npm ci` na primeira execução e quando o lockfile mudar, e inicia a API e a interface. Aguarde o Vite informar o endereço no terminal e abra-o no navegador (porta padrão 5173). A primeira instalação exige internet. Não é necessário instalar PostgreSQL para a demonstração local.

Se `.env` não existir, o iniciador cria uma configuração **somente para demonstração local**, usando as três contas listadas acima e a senha pública `Campo-demo-2026!`. Se `.env` já existir, ele é preservado. O banco `.data` também é preservado; senhas de usuários já cadastrados não são alteradas pelo iniciador. Para reinstalar as dependências manualmente, remova somente `node_modules/.sl-campo-lock` e execute novamente.

O iniciador executa o modo de desenvolvimento. Para instalar e testar o PWA ou publicar em HTTPS, siga as seções abaixo. O arquivo foi revisado neste ambiente Linux; a execução no Windows ainda precisa ser validada.

## Testes e PWA

```sh
npm test
npm run build
npm run preview
# Com a API ainda em execução, testa build com service worker na porta 4173.
```

`npm test` executa domínio e API em banco isolado. Para os testes do navegador, use um banco demonstrativo de teste, `DEMO_PASSWORD=Campo-demo-2026!`, Chromium em `/usr/bin/chromium`, Python e Playwright (`python3 -m pip install playwright`). Os testes criam OS fictícias adicionais.

```sh
npm run test:browser
SL_URL=http://127.0.0.1:4173 SL_OFFLINE=1 python3 tests/browser.py
```

Capturas e PDF ficam em `test-results/` (ignorado). Os testes não alteram a OS de referência. Para homologar em aparelhos reais, publique sob HTTPS e valide Chrome Android e Safari iOS. Instale pelo menu do navegador (Android) ou Compartilhar → Adicionar à Tela de Início (iOS). Primeira abertura e sincronização exigem conexão.

## Fluxo de uso

1. Gestor cria OS e atribui técnico; sincroniza.
2. Técnico entra e sincroniza ordens; abre OS e inicia atendimento.
3. Confere equipamento, registra laudo, fotos, solicitações na aba Peças e assinatura ou justificativa.
4. Finaliza a visita e baixa os documentos. A OS permanece aberta.
5. Gestor aprova e registra entrega. Em nova visita, técnico instala peças entregues e registra resultados.
6. Gestor encerra a OS sem pendências. Para conflito de edição, exporte o rascunho antes de carregar a versão do servidor.

## Publicação

1. Provisione PostgreSQL 15+ e um usuário de migração. Execute `server/schema.sql` com o proprietário. Crie um papel API com senha própria e permissões SELECT/INSERT/UPDATE/DELETE nas tabelas e USAGE/SELECT nas sequências; sem SUPERUSER, propriedade das tabelas ou BYPASSRLS. Não exponha PostgreSQL na internet sem restrições. O bootstrap de schema é idempotente; em instalações com papel restrito, aplique migrações separadamente e configure `SKIP_SCHEMA=true` para o processo de aplicação.
2. Configure as variáveis de `.env.example`: `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+), `DEMO_MODE=false`, `COOKIE_SECURE=true`, `NODE_ENV=production`. O primeiro boot cria só o administrador. Não reutilize banco ou contas da demonstração.
3. Execute `npm ci`, `npm run build` e `npm start`. A API serve os arquivos estáticos e fallback SPA. Porta padrão 3001, bind local. Use proxy reverso HTTPS no mesmo domínio para interface/API; `HOST=0.0.0.0` somente se necessário em rede privada de containers.
4. Desative o cache do proxy para `/api/*` e `/sw.js`. Preserve cookies e `Content-Type`. Limite de corpo deve aceitar 28 MB; mantenha timeout adequado para rede móvel. Ative compressão HTTP. Não coloque segredos em variáveis `VITE_*`.
5. Entre com administrador, crie contas individuais em Equipe técnica e atribua OS. Não há convite por e-mail ou troca/recuperação de senha na interface nesta versão; defina processo administrativo antes da operação real.

### Backup

PostgreSQL externo: programe `pg_dump --format=custom` com credenciais seguras, criptografe e copie para armazenamento privado, retenção aprovada e restauração periódica em banco isolado com `pg_restore`. Inclui fotos e assinaturas, pois estão no banco. Habilite backups/PITR do provedor quando disponível. Não há job de backup automático embutido.

PGlite local: pare a API antes de copiar `.data/postgres` integralmente; restaure com processo parado. Exportação JSON em Configurações é cópia dos registros disponíveis à conta, não backup completo do servidor. Mantenha os arquivos exportados privados.

## Estrutura

- `src/main.tsx`: navegação, gestão, atendimento por etapas, fotos e assinatura.
- `src/store.ts`: IndexedDB, compressão e cliente API.
- `src/pdf.ts`: OS e relatório técnico, paginação, fotos e assinatura.
- `server/app.js`: autenticação, permissões, sincronização transacional e auditoria.
- `server/domain.js`: schema e regras de fluxo.
- `server/schema.sql`: tabelas e RLS.
- `public/sw.js` / `server/precache.js`: cache de build para offline.
- `tests/`: regras, API e fluxo real de navegador.

A marca vetorial foi reconstruída a partir da identidade visual enviada pelo usuário. Para fidelidade exata, substitua pelo arquivo oficial autorizado. Cores, faixas diagonais, ícones e PDFs seguem a referência azul, amarela e branca.

## Atualização pela rede local (localhost e IP do computador)

Este é o modo usado por `iniciar.bat`: computador em `http://localhost:5173/` e celular em `http://IP-DO-COMPUTADOR:5173/`, no mesmo Wi-Fi. A API e o banco são os do computador; não execute um segundo banco no celular.

O iniciador mostra os IPs da máquina. A porta 5173 agora é fixa: se já estiver ocupada, a aplicação informa o erro em vez de subir silenciosamente em outra porta. Permita a porta 5173 somente na rede privada do Firewall do Windows. O celular não deve usar `localhost`, que se refere ao próprio aparelho. Se o roteador alterar o IP, utilize o novo endereço informado pelo iniciador.

**Para receber esta correção pela primeira vez:** feche a janela anterior do sistema com `Ctrl+C`, atualize os arquivos (ou execute `atualizar.bat` se a pasta foi clonada com Git), execute `iniciar.bat` e recarregue a página uma vez em cada aparelho. Não apague `.env`, `.data` ou os dados do navegador. O atualizador preserva a configuração/banco e interrompe se houver alterações locais; exige Git e conexão com o GitHub. Cópias obtidas por ZIP precisam receber os novos arquivos manualmente, preservando os dados locais.

Depois disso, alterações nos arquivos do projeto são detectadas no computador e no celular por consulta HTTP a cada **3 segundos**, sem depender do WebSocket do Vite ou de service worker. Isso também funciona no endereço HTTP por IP. O recarregamento espera o fim do preenchimento e a sincronização dos dados; um atendimento aberto na tela não é interrompido. Para aplicar a nova versão após preencher, sincronize e volte para a lista/início. Alterações de dados (OS, atribuições e laudos) continuam usando a sincronização da API: envio após aproximadamente 2 segundos e consulta de outros dispositivos a cada 15 segundos.

A API agora reinicia automaticamente quando seus módulos são alterados, fechando o banco antes de reiniciar. Alterações de dependências e configuração ainda podem exigir parar e iniciar novamente. Enviar código para o GitHub não baixa arquivos automaticamente no seu computador: use `atualizar.bat` para isso.

**Limite do HTTP no celular:** a atualização e o atendimento online funcionam na rede local, incluindo IDs compatíveis quando `crypto.randomUUID` não está disponível. Instalação PWA, service worker/offline, geolocalização e recursos de câmera que exigem contexto seguro precisam de HTTPS. Seleção de imagens pela galeria e assinatura por toque continuam disponíveis conforme o navegador. Essa limitação é do navegador, não deve ser contornada desativando proteções.

Teste automatizado: com a API demonstrativa ativa, execute `npm run test:lan`. O teste usa duas origens de navegador e uma cópia isolada do código, confirma criação de OS no computador, recebimento no celular, check-in em HTTP inseguro, atualização de código e preservação do laudo. Neste ambiente de nuvem, um relay local simula a origem IP porque o proxy bloqueia tráfego LAN direto. Para testar uma rede real, use `SL_LAN_DIRECT=1 SL_LAN_HOST=IP-DA-MAQUINA python3 tests/lan.py` em ambiente autorizado; o servidor de teste usa a porta 5188.

## Atualização automática do PWA publicado em HTTPS

Ambos precisam acessar **o mesmo endereço HTTPS da mesma instalação**, com a mesma API e banco. Uma cópia local em cada dispositivo não compartilha dados automaticamente.

### Dados da operação

Registros são salvos primeiro no dispositivo. Alterações são enviadas após aproximadamente 2 segundos sem novas edições, quando há conexão. Ordens alteradas em outro dispositivo são consultadas a cada 15 segundos e ao voltar para a janela/aplicativo. Rascunhos locais têm prioridade até sincronizar; conflitos entre dispositivos continuam exigindo revisão, sem sobrescrita silenciosa. Sem conexão, tudo permanece na fila.

### Novas versões do aplicativo

Após publicar um novo build no **mesmo endereço**, o PWA verifica versões ao iniciar, reconectar, voltar ao aplicativo e a cada minuto enquanto estiver visível. A versão é identificada pelo conteúdo completo do build e do service worker; mudanças apenas de HTML ou do próprio service worker também são detectadas.

A nova versão é baixada em segundo plano. O recarregamento automático só acontece quando não há dados pendentes, sincronização em andamento, visita aberta na tela, formulário de peças/atendimento, modal aberto ou campo em edição. O aviso “Nova versão pronta” informa que a atualização está aguardando. Finalize o preenchimento, sincronize e volte ao Resumo ou à tela inicial para permitir a atualização. O IndexedDB e o banco não são apagados. Em múltiplas abas, uma atualização ativada por outra aba também respeita as condições de segurança de cada tela.

**Primeira implantação deste mecanismo:** quem ainda estiver usando a versão antiga precisa fechar todas as janelas do PWA e abrir novamente com internet, ou atualizar a página uma vez. Depois que essa versão estiver instalada, as próximas atualizações seguem o fluxo automático. O sistema operacional pode suspender um aplicativo fechado; a verificação volta a ocorrer quando ele for aberto.

Alterar arquivos no computador ou enviar ao GitHub não altera, por si só, o site publicado. A hospedagem precisa executar `npm ci`, `npm run build`, publicar o diretório `dist` e reiniciar a API quando necessário, preservando o banco e as variáveis de ambiente. É possível automatizar isso com o deploy da hospedagem ligado à branch `main`; a configuração exata depende do provedor. Não publique `.env`, `.data` ou cópias do banco no repositório. O servidor Node já envia políticas de cache adequadas para HTML/service worker e assets versionados; mantenha essas políticas em qualquer CDN/proxy.

Para verificar releases de PWA sem depender de hospedagem externa, execute `npm run build` e `python3 tests/updates.py`. O teste usa service workers reais no Chromium e verifica instalação inicial, atualização em repouso, proteção de campos em edição, rascunhos no IndexedDB e ativação por outra aba.
