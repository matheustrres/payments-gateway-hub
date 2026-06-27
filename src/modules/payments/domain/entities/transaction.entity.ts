Abertura
  "Neste vídeo eu vou apresentar a minha resolução para o desafio da Parcela Mais.

  O problema que eu escolhi atacar foi o núcleo operacional de cobrança para clínicas: modelagem de dívidas parceladas, acompanhamento de parcelas,
  priorização de inadimplentes, execução de régua de cobrança, dashboard operacional e integração simulada de pagamento com webhook auditável.

  Eu preferi fazer um recorte menor, mas fechar esse recorte com consistência técnica e com preocupação real de operação. Então, em vez de tentar cobrir
  muitas expansões ao mesmo tempo, eu foquei em fluxo financeiro seguro, regras de cobrança explicáveis, dados sintéticos, isolamento por clínica e tratamento
  de replay de webhook.

  Ao longo do vídeo eu vou mostrar o sistema funcionando e, principalmente, explicar as decisões: o que eu construí, como eu modelei, por que eu priorizei
  isso, o que eu cortei e onde a IA me ajudou, mas também onde eu precisei validar e corrigir o que estava sendo produzido."

  1. Contexto E Recorte Escolhido
  "O desafio pedia como núcleo mínimo um modelo de dados para pacientes, dívidas ou parcelas e pagamentos, uma API para registrar e consultar dívidas,
  registrar pagamentos e listar inadimplentes, além de uma régua de comunicação de cobrança e uso exclusivo de dados sintéticos.

  A partir daí, eu escolhi expandir em três direções.

  A primeira foi dashboard para a clínica, porque eu queria mostrar uma visão operacional consolidada do negócio.

  A segunda foi robustez no fluxo de pagamento, com idempotência, tratamento de concorrência e erros estáveis.

  E a terceira foi uma integração simulada de pagamento com webhook, porque esse é um caso muito bom para demonstrar raciocínio de produção: reenvio de
  eventos, replay seguro, deduplicação e auditoria.

  O que eu conscientemente não tratei como foco principal foi IA em runtime para decidir tom, canal e horário. Isso poderia ser uma expansão futura, mas eu
  entendi que, dentro do tempo do desafio, valia mais entregar regras de cobrança sólidas e explicáveis do que prometer inteligência dinâmica sem consistência
  operacional."

  2. Arquitetura E Separação Entre Domínio, Aplicação E Infra
  "Antes de mostrar os endpoints, eu quero mostrar rapidamente a organização da solução.

  Eu separei o projeto por módulos de negócio, como pagamentos, parcelas, acordos, cobrança, dashboard e comunicações.

  Dentro de cada módulo eu mantive uma divisão entre domínio, aplicação, infraestrutura e apresentação.

  No domínio ficam entidades, enums e políticas de negócio. É onde eu tento concentrar linguagem ubíqua e invariantes. Por exemplo, conceitos como parcela,
  pagamento, status de parcela e evento de webhook pertencem ao domínio.

  Na aplicação ficam os use cases e os contratos de repositório. Essa camada orquestra os fluxos: criar acordo, registrar pagamento, processar webhook, listar
  inadimplentes, executar a régua e montar visão de dashboard.

  Na infraestrutura ficam implementações concretas, principalmente com Prisma.

  E na apresentação ficam controllers e DTOs HTTP, ou seja, a borda da API.

  Essa separação foi importante porque eu queria que a lógica de pagamento e de webhook fosse testável e não ficasse espalhada entre controller, banco e
  validação HTTP.

  Também houve uma decisão específica no fluxo financeiro: o webhook não cria pagamento por um caminho paralelo. Ele usa o mesmo use case de registro
  financeiro que um pagamento normal. Isso evita divergência entre dois fluxos que deveriam obedecer às mesmas regras."

  3. Criar Um Acordo
  "Agora eu começo a demonstração funcional criando um acordo financeiro.

  A ideia do acordo é representar a dívida parcelada que a clínica tem com o paciente. Eu escolhi modelar acordo e parcela separadamente porque, na prática, a
  cobrança acontece no nível da parcela. É a parcela que vence, atrasa, recebe pagamento parcial, some da inadimplência ou dispara comunicação.

  Então, ao criar um acordo, o sistema já gera as parcelas relacionadas. Isso dá uma base muito melhor para as próximas operações do que simplesmente guardar
  um total consolidado da dívida.

  Aqui eu estou usando apenas dados sintéticos, tanto por requisito do desafio quanto por preocupação de privacidade. Não há nenhum dado real de paciente,
  contato ou informação clínica.

  Depois da criação, eu já tenho um acordo e as parcelas associadas, e isso prepara o cenário para consulta, cobrança e pagamento."

  4. Consultar A Dívida E As Parcelas
  "Com o acordo criado, eu consulto a dívida e as parcelas.

  Aqui o ponto que eu queria mostrar é que a API não expõe só uma dívida abstrata. Ela expõe um estado operacional útil: qual parcela existe, quanto ela vale,
  quanto já foi pago, quanto ainda falta pagar e qual é o seu status financeiro.

  Os status persistidos que eu mantive são simples e objetivos, como PENDING, PARTIALLY_PAID, PAID e CANCELED.

  Já os estados mais orientados à operação, como atraso e vencimento, eu tratei mais como leitura derivada, em vez de persistir tudo no banco. Essa escolha
  reduz redundância e evita problemas de sincronização de estado.

  Na prática, o sistema consegue me dizer não só que existe uma dívida, mas em que ponto do ciclo de cobrança cada parcela está. Isso é importante porque a
  régua de comunicação e a priorização de cobrança dependem dessa visão granular."

  5. Listar Inadimplentes E Mostrar Score Explicável
  "Agora eu mostro a listagem de inadimplentes, que é um dos pontos centrais do desafio.

  Aqui eu não quis devolver só uma lista bruta de pacientes atrasados. Eu quis devolver uma priorização com score e motivos, para que a clínica entenda por
  que alguém está no topo da fila.

  Então o sistema considera fatores como dias de atraso, valor em aberto e outros sinais operacionais para compor uma pontuação.

  O mais importante é que essa pontuação é explicável. Eu consigo mostrar não só o número final, mas também as razões que levaram àquele score.

  Essa foi uma decisão intencional. Eu poderia falar em priorização por IA, mas neste recorte eu preferi um mecanismo heurístico, transparente e auditável. Em
  cobrança, explicabilidade conta muito, porque a operação precisa confiar no critério, e não apenas receber uma ordem opaca.

  Isso também prepara uma boa base de evolução. Se no futuro eu quiser introduzir modelos mais inteligentes, eu já tenho uma estrutura de decisão e de leitura
  operacional onde esse tipo de melhoria pode entrar sem desmontar o sistema."

  6. Executar A Régua, Incluindo D+7 Multicanal E Um Skip
  "Agora eu executo a régua de cobrança, que eu considero o coração do desafio.

  A régua traduz a situação financeira da parcela em uma ação de comunicação. Em vez de disparar mensagens de forma indiscriminada, ela decide quando
  comunicar, que tipo de comunicação usar e, em alguns casos, por qual canal.

  Aqui eu consigo mostrar tanto um caso de comunicação gerada quanto um caso de skip, e eu considero isso essencial.

  Num cenário de cobrança real, não basta saber mandar mensagem. É igualmente importante saber quando não mandar. Se a clínica ignorar isso, ela cria ruído,
  desgaste, duplicidade de contato e até risco reputacional.

  Então o sistema registra tentativas geradas e também registra quando uma comunicação foi pulada, com motivo.

  No caso de um estágio mais avançado da inadimplência, como D+7, eu preparei o fluxo para escalar a abordagem e suportar estratégia multicanal. Isso
  demonstra que a régua não é apenas um lembrete pontual; ela tem progressão e contexto.

  Outra decisão importante aqui foi separar a decisão da régua do conteúdo final de mensagem. A decisão de negócio fica clara e testável. O conteúdo pode
  evoluir depois, inclusive com mais sofisticação, sem reescrever a política operacional."

  7. Processar Webhook De Pagamento
  "Agora eu entro na parte de webhook de pagamento, que foi uma das áreas em que eu mais investi qualidade técnica.

  Este endpoint simula uma integração de pagamento recebida de fora do sistema, por exemplo um evento de PIX ou boleto pago.

  A primeira decisão importante foi restringir os métodos aceitos nesse endpoint para PIX e BOLETO. Eu não aceitei MANUAL nem outros métodos porque,
  conceitualmente, esse endpoint existe para representar uma integração externa simulada.

  A segunda decisão importante foi não deixar o webhook registrar pagamento por um caminho financeiro alternativo. Em vez disso, ele chama o mesmo
  RegisterPaymentUseCase já usado no restante do sistema.

  Na prática, isso significa que as regras de saldo, idempotência, conflito de payload e atualização da parcela são exatamente as mesmas. É uma forma de
  evitar duplicidade de lógica e de manter consistência financeira.

  Além disso, cada evento de webhook é persistido em uma entidade própria de auditoria, chamada PaymentWebhookEvent. Nela eu guardo informações como provider,
  eventId, payload canônico, hash do payload, status do evento e metadados de falha.

  Essa persistência separada foi importante porque eu não queria inferir tudo olhando só para o pagamento. Um pagamento me diz o efeito financeiro. O
  PaymentWebhookEvent me diz a história operacional do evento."

  8. Repetir Webhook E Demonstrar Replay Seguro
  "Agora eu repito exatamente o mesmo webhook para mostrar replay seguro.

  Esse é um caso muito relevante em integração real. Webhooks podem ser reenviados por timeout, retry de rede, duplicidade de entrega ou comportamento do
  provedor. Então o sistema precisa absorver o replay sem duplicar efeito financeiro.

  Aqui a regra é baseada em provider + eventId.

  Se chega o mesmo provider + eventId com o mesmo payload, o sistema não cria um novo pagamento. Ele detecta que aquilo já foi processado, reconstrói uma
  resposta segura e retorna 200.

  No retorno eu mantenho o mesmo webhookEventId, o mesmo paymentId, não aumento o valor pago da parcela e marco webhookReplay: true.

  Também adotei a semântica de paymentReused como: nenhum novo Payment foi criado nesta chamada. Então, no replay de um evento já processado, o valor correto
  é paymentReused: true.

  Isso deixa o contrato mais intuitivo. O consumidor não precisa interpretar se o reuso veio de externalReference, de idempotência financeira ou de replay de
  webhook. Ele só precisa saber se esta chamada efetivamente criou um novo pagamento ou não.

  Se, por outro lado, eu mantiver o mesmo provider + eventId e alterar o payload, por exemplo mudando o valor, o sistema responde com conflito 409
  PAYMENT_WEBHOOK_EVENT_PAYLOAD_MISMATCH. Isso protege o contrato contra ambiguidade e evita que o mesmo identificador de evento seja reutilizado para outra
  informação."

  9. Mostrar Novo Evento Com Mesmo Pagamento
  "Ainda dentro do webhook, existe outro caso importante, que é diferente do replay do mesmo evento.

  Se eu envio um novo eventId, mas aponto para uma externalReference já existente e com payload compatível, o sistema não trata isso como replay do mesmo
  webhook. Ele trata como um novo evento que reaproveitou um pagamento já conhecido.

  Nesse caso, a resposta indica webhookReplay: false, porque é um evento novo, mas paymentReused: true, porque nenhum novo pagamento foi criado.

  Eu gostei dessa distinção porque ela separa duas coisas que, do ponto de vista operacional, são diferentes: replay de evento e reuso de pagamento. Uma fala
  sobre a origem do evento. A outra fala sobre efeito financeiro na chamada."

  10. Mostrar Dashboard Atualizado
  "Depois do pagamento, eu volto ao dashboard.

  Aqui o objetivo é mostrar que o sistema não é só um conjunto de endpoints isolados. Ele consegue refletir o impacto operacional do que aconteceu.

  No dashboard eu consolido indicadores como total recebido, saldo em aberto, parcelas pagas, parcelas parcialmente pagas, valores vencidos e parte do
  panorama de cobrança.

  Essa visão é útil para a clínica porque transforma eventos transacionais em leitura executiva. Ela consegue ver não só que um pagamento entrou, mas como
  isso afeta a saúde da carteira.

  Arquiteturalmente, eu tratei esse endpoint como um read model operacional. Ou seja, é uma camada voltada para consulta e acompanhamento, sem misturar essa
  responsabilidade com regras centrais do domínio."

  11. Robustez E Decisões Técnicas
  "Vale destacar alguns pontos de robustez que eu quis priorizar porque eles são fáceis de cortar num desafio, mas fazem muita diferença em qualidade técnica.

  O primeiro é idempotência de pagamento.

  O segundo é reuso seguro por externalReference.

  O terceiro é tratamento de conflito de payload, tanto no fluxo financeiro quanto no fluxo de webhook.

  O quarto é proteção contra concorrência na atualização de parcela.

  O quinto é retorno de erros com códigos estáveis, para que o comportamento da API seja previsível.

  O sexto é observabilidade básica, com logs estruturados curtos e sem expor payload completo de webhook.

  E o sétimo é isolamento por clínica. Mesmo no replay de webhook, eu tomo cuidado para não vazar dados de outra clínica."

  12. Onde A IA Ajudou E Onde Eu Corrigi
  "Como o desafio explicitamente valoriza uso crítico de IA, eu quero comentar isso com transparência.

  A IA me ajudou principalmente a acelerar exploração de alternativas, organizar plano de implementação, estruturar testes e revisar coerência entre
  contratos.

  Mas eu não tratei a saída da IA como verdade pronta.

  Um exemplo claro foi a semântica do campo paymentReused. Ao longo do fluxo, ficou evidente que a interpretação mais simples e coerente era: nenhum novo
  pagamento foi criado nesta chamada. Isso exigiu revisar o branch de replay do webhook para alinhar o contrato ao comportamento esperado.

  Esse tipo de ajuste mostra o ponto que eu considero importante no uso de IA: ela ajuda muito em velocidade, mas a responsabilidade de fechar semântica,
  invariantes e clareza de API continua sendo minha."

  13. Trade-Offs
  "Em termos de trade-off, eu diria que a principal escolha foi profundidade em vez de largura.

  Eu preferi não implementar tudo que poderia entrar como expansão. Em vez disso, foquei em um recorte que fosse demonstrável e tecnicamente defensável.

  Por isso eu investi mais em modelagem de parcela, régua explicável, robustez de pagamento, replay de webhook, dashboard e testes, e menos em temas como
  autenticação completa, integração real com PSP ou IA adaptativa em runtime.

  Também escolhi uma abordagem mais determinística na régua. Isso dá menos brilho do que dizer que existe IA decidindo cobrança em tempo real, mas em
  compensação entrega previsibilidade, testabilidade e clareza."

  14. Próximos Passos
  "Se eu fosse continuar evoluindo o projeto, meus próximos passos seriam bem objetivos.

  Primeiro, autenticação e escopo por clínica de ponta a ponta.

  Segundo, integração real com PSP e processamento assíncrono de webhook, com retry controlado e fila.

  Terceiro, métricas e tracing mais fortes para observabilidade de produção.

  Quarto, expansão da régua com mais estados, janelas e controles operacionais.

  E quinto, eventualmente, introdução de inteligência mais adaptativa para tom, canal, horário e cadência, mas preservando explicabilidade e guardrails."

  Fechamento
  "Então, resumindo, o que eu construí foi um recorte funcional de cobrança para clínicas que cobre o núcleo do desafio e expande em dashboard, robustez e
  integração simulada de pagamento.

  Eu procurei equilibrar clareza de domínio, disciplina de arquitetura, previsibilidade operacional e pragmatismo de escopo.

  A minha intenção com esta entrega foi mostrar não só código funcionando, mas também capacidade de priorização, modelagem e tomada de decisão técnica.

  Obrigado."

