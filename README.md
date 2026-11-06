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

Na primeira inicialização demonstrativa são criados estes acessos com a senha configurada em `DEMO_PASSWORD`:

- `admin@slcampo.local`: administrador.
- `tecnico.teste@slcampo.local`: técnico de teste.

O sistema inicia **sem chamados**, com somente o técnico fictício acima para homologação. Se ele for excluído pelo administrador, não será recriado nos próximos reinícios. Mudar `DEMO_PASSWORD` após o primeiro boot não altera senhas existentes.

## Iniciar no Windows

No Windows 10 ou 11, dê dois cliques em `iniciar.bat` na pasta completa do projeto. Também é possível executá-lo pelo Prompt de Comando. Mantenha a janela aberta enquanto usar o sistema; `Ctrl+C` encerra os serviços.

O arquivo verifica o Node.js 24 e o npm. Se não estiverem disponíveis, baixa automaticamente o pacote portátil oficial do site `nodejs.org`, confere o SHA-256 publicado pelo próprio Node.js e o instala somente dentro de `.runtime/`, sem alterar o Windows e sem exigir conta de administrador. Em seguida, instala as dependências com `npm ci` na primeira execução ou quando o lockfile mudar e verifica as portas. A interface aguarda o banco e a API responderem antes de ocupar a porta 5173; o navegador só abre quando ambos estiverem prontos. A primeira instalação exige internet e acesso a `nodejs.org` e `registry.npmjs.org`; uma política da empresa pode exigir liberação pelo suporte de TI. Não é necessário instalar PostgreSQL.

Se `.env` não existir, o iniciador cria uma configuração **somente para demonstração local**, usando os dois acessos listados acima e a senha pública `Campo-demo-2026!`. Se `.env` já existir, ele é preservado. O banco `.data` também é preservado; senhas de usuários já cadastrados não são alteradas pelo iniciador. Para reinstalar as dependências manualmente, remova somente `node_modules/.sl-campo-lock` e execute novamente.

O iniciador executa o modo de desenvolvimento. O cache de instalação fica em `.runtime/npm-cache`, acelerando novas tentativas, e o banco continua em `.data`. Se o sistema já estiver aberto, um segundo clique apenas abre o navegador. Se outro programa estiver usando as portas 3001 ou 5173, o iniciador informa isso sem encerrar o programa. Para instalar e testar o PWA ou publicar em HTTPS, siga as seções abaixo.

`atualizar.bat` funciona tanto em pastas clonadas com Git quanto em pastas extraídas de ZIP. Na cópia ZIP, ele baixa a branch `main`, verifica a estrutura do pacote e aplica apenas o código, preservando `.env`, `.data`, `.runtime`, `node_modules` e resultados locais. Antes de atualizar, feche a janela do `iniciar.bat` com `Ctrl+C`. Se a cópia ainda possuir o atualizador antigo que informa “exige uma cópia clonada com Git”, coloque `atualizar-zip.bat` na pasta do projeto e execute esse arquivo uma vez; depois, as próximas atualizações usam normalmente `atualizar.bat`.

## Testes e PWA

```sh
npm test
npm run build
npm run preview
# Com a API ainda em execução, testa build com service worker na porta 4173.
```

`npm test` executa domínio, API, migração e sincronização em banco isolado. Os testes de navegador requerem Chromium em `/usr/bin/chromium`, Python, Playwright, ReportLab e Pillow (`python3 -m pip install playwright reportlab pillow`). Os comandos abaixo preparam automaticamente um banco temporário com dados fictícios e servidores nas portas 5191/5192. Não é necessário alterar `.env` nem preencher o banco da operação.

```sh
npm run test:browser
npm run test:realtime
npm run test:requests
npm run test:lan
```

A fixture 41250 e o técnico adicional usado por ela só são criados no banco temporário por opt-in de `DEMO_SEED_EXAMPLES=true`; mantenha essa flag desativada na operação. O login `tecnico.teste@slcampo.local` continua disponível para homologar um chamado importado. Para testar a atualização do PWA, gere o build e execute `npm run test:updates`.

Capturas e PDF ficam em `test-results/` (ignorado). Os testes não alteram a OS de referência. Para homologar em aparelhos reais, publique sob HTTPS e valide Chrome Android e Safari iOS. Instale pelo menu do navegador (Android) ou Compartilhar → Adicionar à Tela de Início (iOS). Primeira abertura e sincronização exigem conexão.

## Fluxo de uso

1. Administrador importa o PDF do chamado interno; o sistema lê os dados, anexa o original e atribui o técnico ativo.
2. Técnico entra e sincroniza ordens; abre a OS, consulta o PDF interno e inicia o atendimento.
3. Confere equipamento, registra laudo, fotos, solicitações na aba Peças e assinatura ou justificativa.
4. Finaliza a visita e baixa os documentos. A OS permanece aberta.
5. Administrador aprova e registra entrega. Em nova visita, técnico instala peças entregues e registra resultados.
6. Administrador encerra a OS sem pendências. Para conflito de edição, exporte o rascunho antes de carregar a versão do servidor.

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

Os dois PDFs gerados exibem o símbolo azul/amarelo e o nome **SOUZA LIMA** no cabeçalho de todas as páginas. A área administrativa de Peças não exibe mais o bloco “Serviços e custos”; os campos históricos continuam compatíveis no banco e nos documentos existentes.

## Atualização pela rede local (localhost e IP do computador)

Este é o modo usado por `iniciar.bat`: computador em `http://localhost:5173/` e celular em `http://IP-DO-COMPUTADOR:5173/`, no mesmo Wi-Fi. A API e o banco são os do computador; não execute um segundo banco no celular.

O iniciador mostra os IPs da máquina. A porta 5173 agora é fixa: se já estiver ocupada, a aplicação informa o erro em vez de subir silenciosamente em outra porta. Permita a porta 5173 somente na rede privada do Firewall do Windows. O celular não deve usar `localhost`, que se refere ao próprio aparelho. Se o roteador alterar o IP, utilize o novo endereço informado pelo iniciador.

**Para receber esta correção pela primeira vez:** feche a janela anterior do sistema com `Ctrl+C`, execute `atualizar.bat` e recarregue a página uma vez em cada aparelho. Não apague `.env`, `.data` ou os dados do navegador. O atualizador preserva a configuração e o banco. Em um repositório Git, ele interrompe se houver alterações locais; em uma cópia ZIP, baixa e verifica o pacote novo antes de sobrepor o código. A primeira correção de um atualizador ZIP antigo é feita com `atualizar-zip.bat`, conforme a seção de Windows.

Depois disso, alterações nos arquivos do projeto são detectadas no computador e no celular por consulta HTTP a cada **3 segundos**, sem depender do WebSocket do Vite, service worker ou do indicador `navigator.onLine` do navegador. Isso também funciona no endereço HTTP por IP quando Android/iPhone informa “offline” por engano, mas ainda alcança o computador pelo Wi-Fi. O recarregamento espera o fim do preenchimento e a sincronização dos dados; um atendimento aberto na tela não é interrompido. Para aplicar a nova versão após preencher, sincronize e volte para a lista/início. Alterações de dados (OS, atribuições e laudos) são enviadas após aproximadamente 600 ms sem nova edição. O servidor avisa os outros aparelhos em tempo real e a consulta automática à API ocorre a cada 3 segundos como garantia adicional.

A API agora reinicia automaticamente quando seus módulos são alterados, fechando o banco antes de reiniciar. Alterações de dependências e configuração ainda podem exigir parar e iniciar novamente. Enviar código para o GitHub não baixa arquivos automaticamente no seu computador: use `atualizar.bat` para isso.

**Limite do HTTP no celular:** a atualização e o atendimento online funcionam na rede local, incluindo IDs compatíveis quando `crypto.randomUUID` não está disponível. Instalação PWA, service worker/offline, geolocalização e recursos de câmera que exigem contexto seguro precisam de HTTPS. Seleção de imagens pela galeria e assinatura por toque continuam disponíveis conforme o navegador. Essa limitação é do navegador, não deve ser contornada desativando proteções.

Teste automatizado: execute `npm run test:lan`; um banco temporário isolado é preparado automaticamente. O teste usa duas origens de navegador e uma cópia isolada do código, confirma criação de OS no computador, recebimento no celular, check-in em HTTP inseguro, atualização de código e preservação do laudo. Neste ambiente de nuvem, um relay local simula a origem IP porque o proxy bloqueia tráfego LAN direto. Para testar uma rede real, use `SL_LAN_DIRECT=1 SL_LAN_HOST=IP-DA-MAQUINA python3 tests/lan.py` em ambiente autorizado; o servidor de teste usa a porta 5188.

## Atualização automática do PWA publicado em HTTPS

Ambos precisam acessar **o mesmo endereço HTTPS da mesma instalação**, com a mesma API e banco. Uma cópia local em cada dispositivo não compartilha dados automaticamente.

### Dados da operação

Registros são salvos primeiro no dispositivo e enviados após aproximadamente **600 ms** sem novas edições, quando há conexão. Depois do commit no banco, o servidor avisa imediatamente o administrador e os técnicos autorizados por um canal autenticado de eventos (SSE). O outro aparelho busca os dados atualizados sem recarregar a página, inclusive se o formulário estiver aberto.

Com o canal ao vivo ativo ou bloqueado, o sistema consulta a API a cada **3 segundos** para reconciliar o estado. A consulta tenta alcançar o servidor diretamente, mesmo que o navegador esteja com seu indicador de internet desatualizado. Ao voltar para o aplicativo ou reconectar, há uma verificação imediata. O indicador mostra “Atualizações em tempo real”, o horário da última sincronização e a quantidade de OS pendentes. Isso se refere aos dados, independentemente da atualização da versão do código.

Requisições comuns possuem limite de 12 segundos e uploads de sincronização, de 60 segundos; depois há nova tentativa. Um erro em uma OS não interrompe o recebimento das outras. O comando original é preservado em IndexedDB até ser reconhecido pelo servidor, mesmo se houver uma nova edição ou a resposta da rede for perdida.

Na reconexão, alterações em campos diferentes da mesma OS são conciliadas automaticamente a partir da versão original. Se os dois aparelhos alterarem a mesma informação de formas diferentes, o rascunho é preservado e a OS pede revisão; os demais registros continuam sincronizando. Sem conexão, tudo permanece na fila.

### Novas versões do aplicativo

Após publicar um novo build no **mesmo endereço**, o PWA verifica versões ao iniciar, reconectar, voltar ao aplicativo e a cada minuto enquanto estiver visível. A versão é identificada pelo conteúdo completo do build e do service worker; mudanças apenas de HTML ou do próprio service worker também são detectadas.

A nova versão é baixada em segundo plano. O recarregamento automático só acontece quando não há dados pendentes, sincronização em andamento, visita aberta na tela, formulário de peças/atendimento, modal aberto ou campo em edição. O aviso “Nova versão pronta” informa que a atualização está aguardando. Finalize o preenchimento, sincronize e volte ao Resumo ou à tela inicial para permitir a atualização. O IndexedDB e o banco não são apagados. Em múltiplas abas, uma atualização ativada por outra aba também respeita as condições de segurança de cada tela.

**Primeira implantação deste mecanismo:** quem ainda estiver usando a versão antiga precisa fechar todas as janelas do PWA e abrir novamente com internet, ou atualizar a página uma vez. Depois que essa versão estiver instalada, as próximas atualizações seguem o fluxo automático. O sistema operacional pode suspender um aplicativo fechado; a verificação volta a ocorrer quando ele for aberto.

Alterar arquivos no computador ou enviar ao GitHub não altera, por si só, o site publicado. A hospedagem precisa executar `npm ci`, `npm run build`, publicar o diretório `dist` e reiniciar a API quando necessário, preservando o banco e as variáveis de ambiente. É possível automatizar isso com o deploy da hospedagem ligado à branch `main`; a configuração exata depende do provedor. Não publique `.env`, `.data` ou cópias do banco no repositório. O servidor Node já envia políticas de cache adequadas para HTML/service worker e assets versionados; mantenha essas políticas em qualquer CDN/proxy.

Para verificar releases de PWA sem depender de hospedagem externa, execute `npm run build` e `python3 tests/updates.py`. O teste usa service workers reais no Chromium e verifica instalação inicial, atualização em repouso, proteção de campos em edição, rascunhos no IndexedDB e ativação por outra aba.

### Hospedagem e teste do canal ao vivo

A rota `/api/events` precisa manter a conexão aberta, com cookies e sem buffering de proxy/CDN. O backend envia `X-Accel-Buffering: no` e heartbeat a cada 20 segundos; configure timeout de leitura maior que 5 minutos. O Vite encaminha essa rota pelo mesmo proxy de `/api`. Cada conexão é autenticada, não envia conteúdo de laudos/fotos e apenas avisa os usuários autorizados; as consultas continuam sujeitas às permissões. O reinício da API encerra os canais antes de fechar o banco, e os navegadores reconectam automaticamente.

`npm run test:realtime` prepara um banco temporário isolado e abre duas sessões independentes (administrador no computador e técnico no layout móvel). O teste cria uma OS no computador, recebe no celular, envia diagnóstico do celular para o computador e envia uma medição no sentido inverso, sem recarregar. Também desconecta o celular, altera campos diferentes nos dois lados, reconecta com o canal SSE bloqueado e verifica a conciliação pelo fallback, sem duplicar a visita. O teste não equivale à verificação do roteador ou da instalação Windows do usuário.

## Excluir atendimento

Cada OS possui o botão **Excluir atendimento**, visível somente ao administrador. A exclusão remove somente o chamado aberto e é propagada aos outros aparelhos; o identificador excluído fica registrado para impedir que um aparelho offline restaure o atendimento. A tela de Configurações não oferece exclusão de todos os chamados nem exclusão de todos os técnicos.

## Login administrativo único e correções de sincronização

Existem apenas os perfis **administrador** e **técnico**. O único login administrativo padrão é `admin@slcampo.local`; não há mais login de gestor. A senha do administrador existente é preservada na atualização. O banco permite somente um administrador ativo; o cadastro de novos usuários cria técnicos. O administrador também pode ser o responsável por um atendimento, sem criar um técnico fictício.

Quando existe somente um login técnico ativo, ele visualiza todos os chamados da operação. Se uma OS antiga estiver ligada ao administrador ou a uma conta anterior, o único técnico assume automaticamente o atendimento ao começar a trabalhar. A atualização também remove a conta demonstrativa antiga de Lucas (`tec-demo`) e transfere seus chamados para `tecnico.teste@slcampo.local`. Quando houver dois ou mais técnicos reais, volta a valer o isolamento por atribuição: cada um recebe apenas suas próprias OS.

Novos atendimentos são criados pelo botão **Importar chamado**. O administrador seleciona somente o PDF do chamado interno; número, cliente, unidade, equipamento, endereço, defeito informado e orientações são extraídos automaticamente. O arquivo original fica anexado na aba Documentos e disponível ao técnico responsável, inclusive depois da sincronização offline. O servidor confirma a atribuição a uma conta técnica ativa antes de criar a OS, mesmo quando a lista de usuários ainda não terminou de carregar. Sem técnico cadastrado, a importação informa o que precisa ser corrigido. Na primeira inicialização desta versão, chamados PDF pendentes que uma versão antiga atribuiu por engano ao administrador são transferidos para `tecnico.teste@slcampo.local`.

Na atualização, contas antigas de gestor e administradores adicionais são desativadas e vinculadas ao administrador principal. Suas referências em históricos são preservadas, as sessões antigas são revogadas e os dados das OS não são apagados. Ao entrar com o administrador, os rascunhos locais da conta antiga são recuperados automaticamente. Se já houver outro rascunho pendente para a mesma OS, a segunda cópia fica preservada para exportação em Configurações.

Uma OS criada offline pode chegar ao servidor já com visita, peças e laudo preenchidos. Essa primeira sincronização é validada sem exigir que o cliente envie antes uma versão vazia. Rascunhos bloqueados pelos antigos avisos genéricos tentam novamente uma vez após atualizar. Fotografias grandes são comprimidas progressivamente antes do envio e, se houver outro campo inválido, o aviso informa qual campo corrigir. Os campos de defeito relatado e verificações mecânicas foram retirados do formulário do técnico; o defeito vindo do chamado interno continua no resumo e no PDF. Os campos de medições elétricas e teste de bateria também foram removidos. Ao marcar **Não** em evidência de mau uso, a descrição fica oculta e é limpa; ao marcar **Sim**, aparecem a descrição e os botões para fotografar ou escolher imagens.

Cada OS possui o botão **Excluir atendimento**, visível somente ao administrador. A API também verifica essa permissão. A exclusão funciona inclusive para um rascunho ainda não enviado, é comunicada aos outros aparelhos e não exclui outras OS. As opções de exclusão em lote não aparecem em Configurações.

Os comandos `npm run test:browser`, `npm run test:realtime`, `npm run test:lan` e `npm run test:requests` usam banco temporário e portas 5191/5192 (o teste LAN também usa 5188), sem preencher ou limpar o banco da operação. Requerem Python, Playwright e Chromium conforme a seção de testes. `test:requests` reproduz os avisos reportados, a recuperação da conta antiga, a criação offline, a compressão de foto grande e a exclusão individual por perfil.

## Correção da identificação e exclusão solicitada da OS 44918

Os botões de exclusão aceitam identificações numéricas e chaves de versões antigas, incluindo espaços, pontos, barras e sublinhados. A chave armazenada é preservada exatamente; o sistema não tenta adivinhar outro chamado. A exclusão individual usa JSON para não depender da interpretação de barras ou caracteres especiais na URL. A API continua restrita ao administrador, com consultas parametrizadas, e devolve a identificação primária real do banco para a interface.

Esta atualização inclui a exclusão **explicitamente solicitada da OS 44918**. Ao iniciar a API com a versão nova, uma manutenção transacional remove somente essa OS e seus snapshots, registra a exclusão e marca a ação como aplicada. Não executa uma limpeza geral e não repete a manutenção a cada inicialização. O marcador de exclusão também cancela o rascunho 44918 dos aparelhos ao sincronizar, para impedir que ele volte. Na primeira aplicação, recarregue a página uma vez, sem apagar os dados do navegador.

Em instalações com `SKIP_SCHEMA=true`, aplique `server/schema.sql` e as permissões da nova tabela `applied_maintenance` antes de iniciar a API. No ambiente local padrão o esquema é aplicado automaticamente. Atualizar os arquivos no GitHub não executa a ação no computador do usuário: é necessário carregar a versão nova e reiniciar o iniciador.
