# Soberania

Simulador político e geopolítico em português, inspirado nas ideias de gestão presidencial e estratégia internacional descritas para Planalto e Geoplanetical. Interface, regras, personagens e implementação próprios.

## Executar

Requer Node.js 24 ou superior e npm. A versão do Node está indicada em `.nvmrc`.

```bash
npm ci
npm run dev
```

O Vite informa o endereço e a porta no terminal. A porta padrão é 5173. Para gerar a versão de produção:

```bash
npm run build
npm run preview
```

O conteúdo de `dist/` pode ser servido por qualquer hospedagem estática na raiz de um domínio. Não há servidor de aplicação, banco de dados, chaves de API ou serviços pagos necessários. Fontes e geometria do mapa são distribuídas localmente.

## Como jogar

1. O jogo abre com um governo do Brasil em janeiro de 2026. Clique no país na barra lateral para iniciar com outro dos 16 países disponíveis e definir seu nome.
2. Resolva a situação urgente em **Na sua mesa**. Essas respostas custam recursos, quando indicado, mas não consomem uma das três decisões do mês.
3. Use suas decisões para implementar medidas, negociar votos, construir obras, pesquisar tecnologias ou agir no exterior.
4. Clique em **Avançar mês**. Receitas e despesas são processadas, a economia evolui, obras e pesquisas progridem e o Legislativo vota projetos.
5. Consulte **Meu legado** para acompanhar resultados e conquistas. A cada 48 meses há uma eleição: aprovação ≥45 e estabilidade ≥30 renovam o mandato; do contrário, o governo termina. Aprovação <15 com estabilidade <25 provoca destituição.

**Salvamento:** automático no armazenamento local do navegador. A engrenagem junto ao perfil permite exportar e importar um JSON validado. Limpar os dados do navegador remove o salvamento; exporte uma cópia para transferir ou arquivar uma partida. Começar um novo governo exige uma ação explícita e substitui a partida atual.

## Sistemas implementados

- **16 países jogáveis**, cada um com parâmetros econômicos, população, capital e tamanho do Legislativo próprios. O globo ortográfico é arrastável, tem zoom e exibe 177 geometrias do mapa mundial, com camadas política, econômica e diplomática.
- **Governo:** três decisões por mês, capital político, quatro ministérios com perfis técnicos ou de articulação, políticas públicas, compromissos e registro das decisões.
- **Economia:** PIB, crescimento, inflação, desemprego, caixa, dívida, impostos, juros e distribuição do orçamento entre seis setores. Gastos, dívida, conflitos e comércio se influenciam.
- **Congresso:** bancadas fictícias, negociação, votações nas duas casas quando presentes, maioria absoluta para leis e duas rodadas com quórum de 3/5 para a reforma institucional. No Brasil, são 513 deputados e 81 senadores. O resultado dos votos tem incerteza reproduzível.
- **Desenvolvimento:** oito tipos de obras, escolha de região, custos iniciais, prazos e benefícios na conclusão. O centro espacial depende de pesquisa prévia.
- **Diplomacia:** missões, tratados comerciais, alianças, sanções, conflitos e paz. Outros países têm crescimento econômico e relações que evoluem por turno.
- **Defesa e inteligência:** modernização das forças, análises de tensão e conflitos abstratos com custo mensal, desgaste militar e consequências internas.
- **Pesquisa:** 57 avanços em 19 áreas, requisitos científicos, até duas pesquisas simultâneas e três níveis por área. Inclui satélites, missão e habitat lunares e fusão nuclear.
- **Eventos e imprensa:** cinco tipos de crises, três respostas por evento, consequências imediatas, notícias ligadas às ações e histórico econômico de até 120 meses.
- **Legado:** pontuação, seis conquistas, eleições e continuidade entre mandatos enquanto o governo conserva apoio.

## Modelo e limites desta versão

É um jogo individual local. Não há multiplayer, contas, ranking online ou integração com os jogos de referência. Os dados iniciais são parâmetros fictícios de balanceamento, não estatísticas oficiais. Países usam uma estrutura institucional simplificada comum e partidos e ministros fictícios. Valores monetários estão em bilhões de dólares simulados; os custos de decisões são proporcionais ao tamanho inicial da economia.

O campo de proposta livre identifica temas por regras locais e sugere uma medida predefinida para confirmação. **Não usa IA generativa** e não interpreta valores, negações, prazos ou políticas arbitrárias. A descrição e os efeitos da medida sugerida são exibidos antes de gastar recursos.

A economia usa um modelo simplificado: receita mensal proporcional ao PIB e à carga tributária; despesas de serviços proporcionais ao PIB; custo de juros proporcional à dívida; custos recorrentes por guerra. Crescimento afeta PIB e emprego, juros afetam inflação, investimentos afetam serviços e aprovação. Uma insuficiência de caixa mensal gera dívida. A diplomacia internacional automatizada se limita à evolução econômica e das relações, sem governos adversários que planejem guerras ou eleições autonomamente.

Conflitos não incluem combate tático ou conquista territorial. A exploração espacial é representada por pesquisa e infraestrutura, sem administração de colônias. A única reforma constitucional disponível fortalece a fiscalização institucional; não altera a duração dos mandatos nem o sistema eleitoral.

## Verificação

```bash
npm test
npm run build
npm run format:check
```

Os testes do motor cobrem recursos e imutabilidade, crise e passagem de turnos, prazos de obras, pesquisa, quóruns legislativos, orçamento, dívida, diplomacia, guerra e paz, eleições, determinismo, salvamentos e uma simulação de dez anos.

Existe também uma verificação funcional opcional em Python com Playwright e Chromium. Com o jogo em execução:

```bash
python3 -m pip install playwright
CHROMIUM_PATH=/usr/bin/chromium python3 tests/browser_smoke.py
```

`SOBERANIA_URL` permite apontar para outro endereço de teste. O script percorre os dez painéis em desktop e celular, executa decisões, verifica exportação/importação, persistência e uso de teclado nos diálogos. Capturas ficam em `test-results/`, ignorado pelo Git. Se seu Chromium estiver em outro local, ajuste `CHROMIUM_PATH`.

## Organização

- `src/engine.js`: regras puras, evolução mensal, validação de partidas e gerador pseudoaleatório persistente.
- `src/data.js`: países, políticas, obras, eventos, ministérios e tecnologias.
- `src/App.jsx`: navegação, salvamento, diálogos e fluxo de decisões.
- `src/views.jsx`: dez painéis de governo.
- `src/components.jsx`: globo, gráficos, componentes e controles acessíveis.
- `src/styles.css`: identidade visual e adaptação para celular.
- `tests/`: verificações do motor e do navegador.

## Créditos

Geometria do mapa: [world-atlas](https://github.com/topojson/world-atlas), baseada no Natural Earth (dados em domínio público); a transformação e distribuição world-atlas usa licença ISC. Ícones: Lucide (ISC). Fontes: DM Sans e Manrope, via Fontsource, sob SIL Open Font License. Veja `public/THIRD_PARTY_NOTICES.txt`. Nenhum recurso visual dos jogos de referência foi copiado.
