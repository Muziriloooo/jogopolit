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

Não há logotipos oficiais incorporados; substitua a marca tipográfica apenas com arquivos autorizados.
