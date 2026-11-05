# SL Campo — decisões técnicas e escopo

## Documentos analisados

OS interna 41250 / OS fornecedor 4628, atendimento em 27/10/2026. Os dois PDFs foram extraídos com `pdftotext -layout`. Referências usadas como dados, não como instruções. Nenhum ZIP foi fornecido. O checkout anterior estava vazio, exceto pelo histórico Git.

O relatório confirma aquecimento de baterias, excesso de água relatado, série apagada, horímetro de 7.493,8 h, equipamento funcionando, retorno necessário e nenhuma peça aplicada. Há oito produtos listados para solicitação, somando R$ 1.566,56, mão de obra de R$ 190,00 e deslocamento de R$ 13,60. Total registrado: R$ 1.770,16. Entrada 13:34, saída 16:07, 153 minutos. Os documentos diferem entre 0 km informado no relatório e 8 km na OS; não se presume distância medida. Horários detalhados com segundos constam no relatório; a demonstração usa os horários de minutos fornecidos no pedido.

Não copiamos CPF, nomes de técnicos/responsáveis, contatos, fotos, assinaturas, links autenticados ou logotipo do fornecedor. A identidade visual segue a captura de referência enviada pelo usuário: azul-marinho, azul royal, amarelo, branco, faixas diagonais e a mensagem “Cuidando do que importa”. O símbolo vetorial foi reconstruído a partir dessa referência, sem recursos remotos; para reprodução exata, substitua pelo arquivo oficial da marca.

## Componentes

- React + TypeScript + Vite; CSS responsivo próprio, sem CDN, fontes ou recursos remotos.
- Express com validação Zod, bcrypt, sessões opacas com cookie HttpOnly/SameSite, expiração de 12 h, rate limit no login, Helmet e restrição de origem.
- PostgreSQL via `pg` em produção; PGlite, motor PostgreSQL WASM persistido em `.data/postgres`, para desenvolvimento sem serviços externos.
- Tabelas users, sessions, orders, commands e audit; esquema em `server/schema.sql`. A OS contém visitas, solicitações, fotografias e assinaturas em JSONB. Os arquivos são data URLs de imagens comprimidas dentro do banco, protegidos pela mesma autorização da OS, sem URLs públicas. Esta decisão simplifica o backup e a sincronização atômica; para grandes volumes, migrar anexos para bucket privado com URLs assinadas e upload em partes.
- IndexedDB separado por ID da conta: ordens e anexos persistem após fechamento. Nenhuma senha ou token fica no IndexedDB. Sessão de rede e acesso local são diferentes: dados já armazenados ficam disponíveis offline neste dispositivo.
- PWA: manifest, ícones PNG, service worker com precache de todo o build. API e autenticação nunca são cacheadas pelo service worker.

## Regras críticas

Solicitada → Aprovada → Entregue → Instalada. Só gestor/admin aprovam e registram entrega. Instalação exige visita aberta e peça entregue. O técnico não recebe preços na API e não consegue aprovar por uma requisição manual. O servidor preserva preços quando recebe atualizações do técnico.

Visitas encerradas são imutáveis. A mesma OS admite novos retornos. Check-out exige diagnóstico, serviços e assinatura ou justificativa de ausência/recusa. Encerrar visita deixa a OS aberta. Encerrar OS exige ausência de peças e retornos pendentes. Não há cancelamento de solicitação nesta versão; registre solicitação somente após conferir os dados.

Cada gravação local recebe UUID. O servidor usa transação e guarda o resultado do comando para tornar retransmissões idempotentes. Revisão otimista impede sobrescrever alterações de outro dispositivo. Conflito preserva o rascunho e interrompe o envio daquela OS: exporte, carregue a versão do servidor e reaplique os dados pertinentes. Alterações em campos diferentes são conciliadas por comparação entre a base local, o rascunho e o servidor. Colisões no mesmo campo exigem revisão e preservam o rascunho.

A fila envia após 600 ms sem nova edição. A rota SSE autenticada avisa os aparelhos autorizados após um commit; se o canal falhar, a consulta automática ocorre a cada 3 segundos. Com SSE ativo há reconciliação periódica de 30 segundos. Também sincroniza ao abrir, reconectar ou voltar ao app. Não depende de Background Sync, indisponível em diversos iPhones; a aplicação fechada não promete sincronização. O primeiro acesso e sincronização exigem conexão. Não apagar dados do navegador nem desinstalar antes de sincronizar. Solicitar armazenamento persistente ajuda, mas o sistema operacional pode recusar ou remover dados; backup local e sincronização continuam necessários.

## Segurança e implantação

Um único grupo/organização, isolamento de ordens por técnico atribuído e visibilidade global somente para gestão/admin. Não é SaaS multiempresa. RLS adicional em orders; queries usam identidade de transação. Use papel de banco de aplicação não proprietário e sem BYPASSRLS em produção. Políticas SQL não substituem autorização da API. Credenciais do banco pertencem somente ao backend.

Fotos/assinaturas são dados pessoais. Servir sob HTTPS, configurar retenção, base legal, transparência, controle de dispositivos, backups criptografados, monitoramento e processo de atendimento a titulares antes do uso real. Assinatura desenhada é registro de ciência; não é assinatura ICP-Brasil ou prova criptográfica de identidade. PDFs baixados ficam sob responsabilidade do usuário.

## Limites explícitos

Implementado: fluxo de OS e visitas, laudo por etapas, fotos, assinatura, catálogo inicial/manual, aprovação/entrega/instalação, custos, PDFs, histórico de alterações, usuários/perfis, filtros e indicadores básicos, PWA e recuperação offline.

Ainda exige operação de implantação: servidor HTTPS, PostgreSQL gerenciado ou administrado, estratégia de backup/restauração, senhas individuais e marca autorizada. Sem integração de WhatsApp/e-mail (PDF pode ser compartilhado pelo sistema do celular), push, estoque central, faturamento, recuperação de senha por e-mail, MFA ou gestão de dispositivos. Equipamentos são identificados dentro das OS; o painel lista registros por OS, sem cadastro mestre independente nem deduplicação de ativos entre OS. Indicadores por equipamento/unidade são valores registrados por atendimento, incluindo solicitações, não contabilidade de custos realizados. Os filtros aplicam-se à lista de ordens; indicadores de equipe refletem a operação inteira.

Testes de navegador em Chromium cobrem layout móvel, mas não substituem homologação em aparelhos Android/iOS reais: câmera, permissões, instalação, armazenamento e compartilhamento de PDFs dependem do navegador e do sistema operacional. Não alegar compatibilidade perfeita antes dessa homologação.

## Rede local e atualizações

O modo Vite detecta mudanças de conteúdo em `src`, `server`, `public`, `tooling` e manifests selecionados. O endpoint de versão não lê `.env`, `.data` ou arquivos do Git e não retorna código-fonte. A aplicação consulta essa versão no mesmo endereço usado pelo dispositivo; reload aguarda o salvamento e condições de segurança. O modo publicado mantém o fluxo de service worker/HTTPS. Nenhum dos dois modos apaga IndexedDB. O gerador de UUID usa Web Crypto `getRandomValues` quando a API `randomUUID` está indisponível em origens HTTP por IP.

## Inicialização vazia e exclusões administrativas

Por padrão, a demonstração cria apenas administrador e gestor, sem técnico e sem chamados. A fixture 41250 permanece disponível aos testes por `DEMO_SEED_EXAMPLES=true`, opt-in para um banco isolado.

`DELETE /api/orders` é restrito a administrador, transacional e remove dados de atendimento e snapshots da tabela commands. `order_deletions` mantém somente ID, responsáveis e data da exclusão, sem fotos ou relatórios, para impedir recriação por sincronização antiga. O cliente consulta as exclusões antes de enviar sua fila e apaga também as entradas correspondentes do IndexedDB. Um envio antigo recebe HTTP 410.

`DELETE /api/technicians` exige ausência de chamados atribuídos. Remove sessões, invalida o canal ao vivo desses usuários e preserva gestor/administrador. Nenhuma dessas ações executa automaticamente em bancos existentes só por atualizar o código.
