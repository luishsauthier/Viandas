# PROJECT_SPEC.md — Controle de Viandas

## 0. Instrução principal para o Cursor

Este documento é a fonte de verdade funcional e técnica do projeto **Controle de Viandas**.

O projeto deve ser tratado como **100% independente** de qualquer outro projeto existente na máquina, no Cursor, no GitHub ou em qualquer serviço externo.

### Regras de isolamento obrigatórias

- Não reutilizar código, componentes, banco de dados, variáveis de ambiente, nomes, estilos, schemas, credenciais ou configurações de outros projetos.
- Não procurar implementações em pastas irmãs ou outros repositórios locais.
- Não assumir que existe um projeto Supabase já disponível para reutilização.
- Não reutilizar `.env` de outro projeto.
- Não copiar padrões arquiteturais de outros sistemas sem que estejam definidos neste documento.
- Trabalhar apenas dentro da raiz deste repositório.
- Se for necessário um serviço externo, criar configuração específica para este projeto.
- Em caso de conflito entre uma implementação existente e este documento, este documento prevalece.
- Evitar adicionar funcionalidades não descritas aqui sem necessidade técnica real.

---

# 1. Visão geral

## 1.1 Nome

**Controle de Viandas**

## 1.2 Objetivo

Criar uma aplicação web simples e confiável para controlar o processo semanal de pedidos de viandas de uma empresa.

O sistema deve substituir o controle manual hoje feito por meio de:

- foto semanal do cardápio enviada pelo restaurante;
- mensagens/enquetes enviadas manualmente em grupo do WhatsApp;
- transcrição manual dos pedidos para planilha;
- soma manual das quantidades por dia;
- envio manual do resumo ao restaurante;
- cálculo semanal do valor devido por funcionário;
- conferência de comprovantes de PIX;
- controle manual de pagamentos, pagamentos parciais e diferenças de valor;
- histórico separado por semana.

A aplicação deve centralizar essas informações sem integrar diretamente com o WhatsApp ou com a conta bancária no MVP.

---

# 2. Princípios do produto

1. **Simplicidade acima de tudo.**
2. O fluxo diário do funcionário deve levar poucos segundos.
3. O administrador deve conseguir enxergar toda a semana em uma tela semelhante ao controle atual em planilha.
4. Automatizar cálculos e organização, mas manter ações externas críticas sob controle humano.
5. Não depender de integração oficial com WhatsApp.
6. Não depender de acesso bancário.
7. Nunca alterar retroativamente valores históricos ao mudar preços atuais.
8. Pagamentos só são considerados válidos depois da aprovação manual do administrador.
9. Funcionários nunca podem visualizar dados de outros funcionários.
10. Toda funcionalidade deve funcionar bem em celular e desktop.

---

# 3. Stack técnica escolhida

A implementação inicial deve priorizar baixo custo operacional, simplicidade de manutenção e poucas peças de infraestrutura.

## 3.1 Frontend

- React
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Lucide Icons
- React Hook Form
- Zod

Não adicionar framework full-stack desnecessariamente.

## 3.2 Backend / infraestrutura

Usar **Supabase** como backend principal:

- PostgreSQL;
- Supabase Auth;
- Supabase Storage;
- Row Level Security;
- Edge Functions apenas quando uma operação realmente precisar de privilégio de servidor ou segredo externo.

## 3.3 Hospedagem

Frontend preparado para deploy na **Vercel**.

O projeto deve continuar sendo um SPA independente e não ficar preso à Vercel; outro host de arquivos estáticos deve poder ser utilizado futuramente.

## 3.4 Leitura inteligente de cardápio

Implementar por meio de uma Supabase Edge Function.

Criar uma camada de provider para que o serviço de visão possa ser trocado sem reescrever a interface.

Provider inicial recomendado:

- OpenAI API com suporte a entrada de imagem e saída estruturada.

Regras:

- API key nunca deve ir para o frontend;
- a chave deve existir apenas como secret da Edge Function;
- se a integração não estiver configurada ou falhar, o cadastro manual do cardápio deve continuar funcionando normalmente.

## 3.5 QR Code PIX

- Gerar payload PIX com valor configurável.
- Gerar QR Code a partir do payload.
- Exibir também PIX Copia e Cola.
- Não conectar com banco.
- Não consultar confirmação bancária.

---

# 4. Perfis de acesso

## 4.1 Administrador

Pode:

- gerenciar funcionários;
- criar convites de primeiro acesso;
- redefinir acesso;
- criar semana;
- importar/revisar cardápio;
- alterar cardápio;
- visualizar pedidos de todos;
- criar ou alterar pedido manualmente;
- abrir, fechar e reabrir pedidos do dia;
- gerar mensagens para WhatsApp;
- alterar preços;
- criar ajuste excepcional de valor;
- visualizar cobranças;
- visualizar comprovantes;
- aprovar ou rejeitar pagamento;
- acompanhar créditos e débitos;
- visualizar todo o histórico;
- configurar PIX;
- configurar restaurante;
- configurar horários;
- configurar dias ativos da semana.

## 4.2 Funcionário

Pode:

- acessar apenas a própria conta;
- visualizar cardápio dos dias disponíveis;
- registrar pedido enquanto o dia estiver aberto;
- editar o próprio pedido enquanto estiver aberto;
- informar que não pedirá naquele dia;
- adicionar observação opcional;
- visualizar seu histórico;
- visualizar seu detalhamento financeiro;
- gerar PIX;
- informar valor que está pagando;
- anexar comprovante;
- acompanhar status do comprovante.

## 4.3 Administrador participante

O papel de administrador e a participação nos pedidos são independentes.

Adicionar no perfil:

- `role`: `admin` ou `employee`;
- `is_participant`: boolean.

Assim, um administrador também pode pedir vianda normalmente se `is_participant = true`.

---

# 5. Autenticação

## 5.1 Cadastro fechado

Não existe cadastro público.

Somente o administrador pode cadastrar um novo funcionário.

Campos mínimos:

- nome;
- telefone;
- ativo/inativo;
- participa dos pedidos: sim/não;
- pedido padrão opcional.

## 5.2 Telefone

O telefone será o identificador de login do funcionário.

Internamente, normalizar para formato internacional E.164.

Exemplo visual brasileiro:

`(51) 99999-9999`

Valor persistido:

`+5551999999999`

O telefone deve ser único.

## 5.3 Primeiro acesso

Fluxo recomendado:

1. Admin cadastra o funcionário.
2. Sistema gera um token de ativação aleatório, único e de uso único.
3. Token possui expiração, inicialmente 72 horas.
4. Admin recebe botão **Copiar convite**.
5. Admin envia manualmente o convite pelo WhatsApp.
6. Funcionário abre o link.
7. Sistema identifica o cadastro vinculado ao token.
8. Funcionário define um PIN numérico de 6 dígitos.
9. Confirma o PIN.
10. Conta passa a ser ativa.
11. Token de ativação é invalidado.
12. Usuário é autenticado.

Nunca usar token sequencial ou facilmente previsível.

## 5.4 Login normal

Campos:

- telefone;
- PIN de 6 dígitos.

O PIN deve ser tratado pelo sistema de autenticação como credencial, nunca salvo em texto puro em tabela pública.

A sessão deve permanecer salva no navegador para evitar login diário.

## 5.5 Esqueci / redefinir PIN

No MVP, não existe recuperação automática por SMS.

Fluxo:

1. Funcionário solicita ao administrador.
2. Admin clica em **Redefinir acesso**.
3. Sistema invalida credenciais/sessões conforme necessário.
4. Gera novo link de ativação de uso único.
5. Funcionário define novo PIN.

Isso evita dependência de provedor de SMS.

---

# 6. Configurações gerais

Criar uma tela administrativa de configurações.

## 6.1 Empresa / aplicação

- nome de exibição: `Controle de Viandas`;
- timezone: padrão `America/Sao_Paulo`.

## 6.2 Restaurante

Campos:

- nome do restaurante;
- telefone do restaurante, opcional;
- observações internas, opcional.

## 6.3 PIX

Campos:

- chave PIX;
- nome do favorecido;
- cidade do favorecido;
- descrição padrão opcional.

Não armazenar senha bancária, token bancário ou qualquer acesso à conta.

## 6.4 Horários

Padrão:

- abertura dos pedidos: `08:30`;
- fechamento dos pedidos: `10:30`.

Ambos configuráveis pelo admin.

## 6.5 Dias ativos

Padrão:

- segunda-feira;
- terça-feira;
- quarta-feira;
- quinta-feira;
- sexta-feira.

Admin pode habilitar/desabilitar dias da semana.

Mesmo que sábado ou domingo sejam habilitados futuramente, a arquitetura não deve depender de segunda a sexta de forma fixa.

## 6.6 Limites

Configurar no código inicialmente:

- quantidade máxima por tipo em um único pedido: 10;
- observação: até 300 caracteres;
- comprovante: tamanho máximo razoável, por exemplo 10 MB;
- formatos de comprovante: JPEG, PNG, WEBP e PDF.

---

# 7. Tipos de vianda e preços

Tipos iniciais obrigatórios:

1. P
2. M
3. G
4. Salada

Cada tipo contém:

- código;
- nome;
- valor atual;
- ativo/inativo;
- ordem de exibição.

## 7.1 Preço histórico

O valor atual de um tipo pode mudar.

Porém, cada item de um pedido deve salvar:

- tipo;
- quantidade;
- valor unitário no momento da confirmação.

Alterar o preço atual nunca pode modificar pedidos históricos.

## 7.2 Quantidade

Funcionário pode pedir mais de uma unidade.

Exemplos válidos:

- 1P;
- 2P;
- 1M;
- 1P + 1 Salada;
- 2G + 1 Salada.

A interface deve usar stepper `- / quantidade / +`.

---

# 8. Pedido padrão

Cada participante pode ter um pedido padrão opcional.

Exemplo:

- tipo: P;
- quantidade: 1.

Na tela diária, mostrar uma ação de destaque:

**Confirmar pedido padrão: 1P**

Também permitir:

**Alterar pedido**

Pedido padrão é apenas um atalho. Nunca deve criar pedido automaticamente sem ação do funcionário.

---

# 9. Semana

## 9.1 Criação

Não criar semanas futuras automaticamente.

Quando não houver semana atual, o admin visualiza ação:

**Iniciar nova semana**

Ao criar:

- definir data inicial;
- calcular os dias conforme configuração de dias ativos;
- criar registros dos dias da semana;
- marcar como `current`.

Normalmente será criada na segunda-feira.

## 9.2 Estados da semana

Usar:

- `current` — semana atual;
- `open` — semana já terminou, porém ainda possui pendência financeira;
- `closed` — semana histórica sem pendências.

Não usar estado `future` no MVP.

## 9.3 Transição ao criar nova semana

Ao iniciar uma nova semana:

1. Semana atual anterior deixa de ser `current`.
2. Se possuir pendências, vira `open`.
3. Se não possuir pendências, vira `closed`.
4. Nova semana vira `current`.

Uma semana `open` deve passar automaticamente para `closed` quando todas as pendências relacionadas forem resolvidas.

Caso uma correção financeira recrie uma dívida, uma semana histórica pode voltar de `closed` para `open`.

---

# 10. Cardápio semanal

## 10.1 Fluxo

Na semana atual, admin pode:

**Importar foto do cardápio**

Fluxo:

1. Upload da imagem.
2. Armazenar imagem em bucket privado.
3. Chamar Edge Function de leitura.
4. IA analisa a imagem.
5. IA devolve dados estruturados.
6. Sistema mostra tela obrigatória de revisão.
7. Admin pode corrigir qualquer texto.
8. Admin confirma.
9. Somente após confirmação o cardápio é salvo como válido.

## 10.2 Estrutura esperada da extração

Exemplo conceitual:

```json
{
  "days": [
    {
      "weekday": 1,
      "date": "2026-08-10",
      "items": [
        "Arroz",
        "Feijão",
        "Massa",
        "Filé de frango à milanesa",
        "Bolinho frito"
      ]
    }
  ]
}
```

Nunca confiar cegamente na data detectada pela imagem.

A semana criada no sistema é a referência principal.

## 10.3 Dias fora da configuração

Se a IA detectar sábado, mas sábado estiver desabilitado:

- não criar pedido para sábado;
- mostrar o conteúdo detectado como ignorado na revisão;
- permitir que o admin descarte.

## 10.4 Fallback manual

Se a IA falhar:

- mostrar erro amigável;
- manter imagem enviada;
- permitir cadastro manual dos itens de cada dia.

A semana nunca pode ficar bloqueada por indisponibilidade da IA.

---

# 11. Divulgação diária no WhatsApp

Não haverá integração com WhatsApp no MVP.

Admin terá botão:

**Copiar mensagem do dia**

A mensagem deve ser automaticamente formatada com:

- dia da semana;
- data;
- cardápio;
- horário limite;
- link da aplicação.

Formato sugerido:

```text
🍽️ *VIANDA — QUARTA-FEIRA (12/08)*

Cardápio de hoje:
• Arroz
• Feijão
• Sobrecoxa assada
• Polenta frita
• Massa

⏰ Pedidos até *10:30*.

Faça seu pedido:
https://dominio/pedido
```

O texto deve ser gerado em função pura/utilitário, separado da UI e coberto por teste.

---

# 12. Tela do pedido diário — funcionário

Mobile-first.

## 12.1 Cabeçalho

Exibir:

- saudação/nome;
- dia e data;
- status do pedido;
- horário limite.

Exemplo:

`Quarta-feira — 12/08`

`Pedidos abertos até 10:30`

## 12.2 Cardápio

Mostrar itens do cardápio do dia de forma clara.

## 12.3 Pedido

Mostrar tipos ativos:

```text
P        [-] 0 [+]
M        [-] 0 [+]
G        [-] 0 [+]
Salada   [-] 0 [+]
```

## 12.4 Observação

Campo opcional:

`Observação para o restaurante`

Placeholder:

`Ex.: sem massa, colocar mais salada`

Máximo: 300 caracteres.

## 12.5 Ações

- Confirmar pedido;
- Confirmar pedido padrão, quando existir;
- Não vou pedir hoje.

## 12.6 Sem resposta x não pedir

Diferenciar obrigatoriamente:

- nenhuma resposta = funcionário ainda não respondeu;
- resposta `declined` = funcionário informou que não pedirá;
- resposta `ordered` = existe pedido.

Isso é importante para o painel administrativo.

## 12.7 Alteração

Enquanto pedidos estiverem abertos:

- funcionário pode editar;
- nova confirmação substitui o estado anterior do pedido daquele dia;
- manter `updated_at`.

Depois do fechamento:

- usuário não pode alterar;
- admin pode alterar ou reabrir.

---

# 13. Controle do horário e fechamento automático

O sistema deve garantir o fechamento no backend, não apenas escondendo botões no frontend.

## 13.1 Estado do dia

Cada dia terá:

- `scheduled`;
- `open`;
- `closed`;
- `reopened`.

## 13.2 Regra normal

Considerar o pedido aberto quando:

- dia pertence à semana atual;
- dia é ativo;
- horário atual >= abertura;
- horário atual < fechamento;
- não houve fechamento manual.

Após o horário de fechamento, novas alterações de funcionário devem ser recusadas mesmo que a página esteja antiga ou aberta em outra aba.

Não depender exclusivamente de cron para isso.

## 13.3 Reabrir

Admin pode clicar:

**Reabrir pedidos**

Estado vira `reopened`.

Enquanto `reopened`, funcionários podem alterar pedido novamente.

Admin deve clicar:

**Fechar pedidos**

para encerrar novamente.

Opcionalmente a UI pode permitir definir um novo horário de fechamento, mas isso não é obrigatório na primeira implementação.

## 13.4 Admin override

Admin pode criar/alterar pedido mesmo após fechamento, sempre com registro de auditoria.

---

# 14. Painel administrativo da semana

Esta é a principal tela administrativa.

Deve remeter visualmente ao controle atual em planilha, mas ser responsiva.

## 14.1 Cabeçalho

Mostrar:

- semana;
- status;
- total geral de pedidos;
- valor bruto da semana;
- total aprovado recebido;
- total pendente;
- quantidade de comprovantes aguardando validação.

## 14.2 Grade principal

Desktop:

| Funcionário | Seg | Ter | Qua | Qui | Sex | Semana | Pagamentos | Status |
|---|---|---|---|---|---|---:|---:|---|
| João | 1P | — | 1M | 1P | — | R$ 45 | R$ 45 | Pago |

Cada célula diária pode mostrar:

- `1P`;
- `2P`;
- `1M + 1 Salada`;
- `Não pediu`;
- `Não respondeu`.

Indicador discreto se houver observação.

Em mobile, substituir a tabela larga por cards expansíveis.

## 14.3 Totais por dia

Mostrar ao final de cada coluna/dia:

- total P;
- total M;
- total G;
- total Salada.

---

# 15. Painel administrativo do dia

Exibir:

- cardápio;
- estado do pedido;
- abertura e fechamento;
- quantos pediram;
- quantos informaram que não pedirão;
- quantos ainda não responderam;
- totais por tipo.

Tabela/lista:

| Funcionário | P | M | G | Salada | Observação | Situação |
|---|---:|---:|---:|---:|---|---|

Ações:

- Copiar mensagem do dia;
- Adicionar pedido manualmente;
- Editar pedido;
- Fechar;
- Reabrir;
- Copiar pedido do restaurante.

---

# 16. Geração do pedido para o restaurante

Botão:

**Copiar pedido do restaurante**

## 16.1 Regra de agrupamento

### Pedidos sem observação

Agrupar por tipo e somar quantidades.

Exemplo:

```text
8P Normal
2M Normal
1 Salada Normal
```

### Pedidos com observação

Não agrupar com normais.

Cada pedido especial deve aparecer em linha própria.

Exemplos:

```text
1P sem massa, pode colocar mais salada
2P sem feijão
1M + 1 Salada sem molho
```

Não incluir nome do funcionário por padrão.

## 16.2 Formato final

Quando houver normais e especiais:

```text
Bom dia! Pedido de hoje:

8P Normal
2M Normal

+
1P sem massa, pode colocar mais salada
1M sem feijão
```

Quando houver apenas normais:

```text
Bom dia! Pedido de hoje:

8P Normal
2M Normal
```

Quando houver apenas especiais, não exibir `+` solto.

## 16.3 Ordenação

Ordem fixa:

1. P
2. M
3. G
4. Salada

---

# 17. Ajustes excepcionais de valor

Não criar sistema de adicionais para o funcionário.

A observação não altera preço automaticamente.

Quando houver situação excepcional, admin pode adicionar ajuste financeiro ao pedido daquele dia.

Campos:

- valor;
- sinal positivo ou negativo;
- justificativa obrigatória.

Exemplo:

```text
+ R$ 5,00
Motivo: 1 bife adicional
```

Outro exemplo:

```text
- R$ 3,00
Motivo: ajuste combinado com o restaurante
```

O ajuste deve aparecer no detalhamento financeiro.

Nunca sobrescrever silenciosamente o preço original.

---

# 18. Cálculo semanal por funcionário

Para cada funcionário, mostrar:

- pedidos de cada dia;
- subtotal por dia;
- ajustes;
- total bruto da semana;
- crédito aplicado;
- pagamentos aprovados aplicados;
- pagamentos aguardando validação;
- saldo restante.

Exemplo:

```text
Segunda-feira: 1P — R$ 15,00
Terça-feira: —
Quarta-feira: 1P — R$ 15,00
Quinta-feira: 1P — R$ 15,00
  Ajuste: + R$ 5,00 — 1 bife adicional
Sexta-feira: 1M — R$ 18,00

Consumo da semana: R$ 68,00
Crédito utilizado: - R$ 5,00
Total considerado: R$ 63,00
Pagamento aprovado: R$ 63,00
Saldo: R$ 0,00
```

---

# 19. Estados financeiros do funcionário

A interface deve usar estados compreensíveis:

- `Pendente` — existe saldo a pagar;
- `Parcial` — houve pagamento aprovado, mas ainda existe saldo;
- `Aguardando validação` — existe comprovante pendente de revisão;
- `Pago` — não existe dívida da semana;
- `Crédito` — usuário possui valor excedente disponível.

A presença de um comprovante pendente nunca deve reduzir o saldo oficialmente devido.

---

# 20. Cobrança de sexta-feira

No painel semanal, cada funcionário terá botão:

**Copiar cobrança**

Formato sugerido:

```text
Luis Henrique — R$ 63,00 — Pendente

Segunda-feira: 1P — R$ 15,00
Quarta-feira: 1P — R$ 15,00
Quinta-feira: 1P — R$ 15,00
Sexta-feira: 1M — R$ 18,00

Total da semana: R$ 63,00

Detalhamento e pagamento:
https://dominio/minha-semana/<week-id>
```

Se houver saldo anterior ou crédito:

```text
Consumo da semana: R$ 63,00
Crédito anterior aplicado: - R$ 5,00
Total a pagar: R$ 58,00
```

Se houver ajuste, exibir no detalhamento.

Não mostrar dias sem pedido se isso deixar a mensagem excessivamente longa, mas o detalhamento dentro do site deve mostrar todos os dias.

---

# 21. Tela de detalhamento e pagamento — funcionário

Rota protegida.

Exemplo:

`/minha-semana/:weekId`

Se não estiver autenticado:

1. direcionar para login;
2. após login, voltar automaticamente para a mesma semana.

## 21.1 Conteúdo

Mostrar:

- período;
- pedidos por dia;
- ajustes;
- consumo total;
- créditos aplicados;
- pagamentos aprovados;
- comprovantes pendentes;
- saldo atual.

## 21.2 Pagamento

Se houver saldo positivo:

mostrar valor sugerido igual ao saldo devido.

Permitir:

**Alterar valor a pagar**

O usuário pode pagar:

- exatamente o saldo;
- menos que o saldo;
- mais que o saldo.

Não impedir valor superior.

Exibir aviso simples:

- pagamento menor deixará saldo pendente;
- pagamento maior será convertido em crédito após aprovação.

---

# 22. PIX

## 22.1 Dados

Usar configurações administrativas:

- chave;
- favorecido;
- cidade;
- valor informado;
- identificador da transação compatível com o padrão utilizado.

## 22.2 Interface

Mostrar:

- valor;
- QR Code;
- PIX Copia e Cola;
- botão `Copiar PIX`;
- chave PIX visível como fallback.

## 22.3 Segurança

O QR Code apenas facilita o pagamento.

O sistema não deve assumir que a leitura do QR ou clique em copiar significa que o pagamento foi feito.

---

# 23. Envio de comprovante

Depois de realizar o PIX, funcionário pode registrar o pagamento.

Campos:

- valor pago;
- comprovante obrigatório;
- observação opcional.

Aceitar:

- JPEG;
- PNG;
- WEBP;
- PDF.

Ao enviar:

status = `pending`.

Exibir:

**Pagamento aguardando validação**

---

# 24. Validação de pagamento — admin

Criar tela:

**Pagamentos para validar**

Card/tabela:

- funcionário;
- semana de origem;
- valor declarado;
- data/hora;
- comprovante;
- observação;
- saldo antes da aprovação.

Ações:

- Ver comprovante;
- Aprovar;
- Rejeitar.

## 24.1 Aprovar

Somente ao aprovar o valor entra na conta financeira do funcionário.

## 24.2 Rejeitar

Permitir motivo opcional/curto.

Funcionário vê o pagamento como rejeitado e pode enviar outro comprovante.

## 24.3 Correção após aprovação

Não apagar silenciosamente pagamento aprovado.

Criar ação administrativa segura de correção/reversão, registrando:

- quem fez;
- data;
- motivo.

---

# 25. Crédito, débito e pagamentos parciais

Esta é uma regra central do sistema.

## 25.1 Pagamento parcial

Exemplo:

- devido: R$ 63;
- aprovado: R$ 60;
- saldo: R$ 3.

O R$ 3 continua pendente.

## 25.2 Pagamento excedente

Exemplo:

- devido: R$ 63;
- aprovado: R$ 70;
- semana é quitada;
- R$ 7 tornam-se crédito do funcionário.

## 25.3 Uso automático de crédito

Semana seguinte:

- consumo: R$ 45;
- crédito disponível: R$ 7;
- sistema aplica crédito automaticamente;
- total devido: R$ 38.

## 25.4 Débito atravessando semanas

Se funcionário terminar semana com dívida, ela não desaparece.

Pagamentos futuros devem ser aplicados primeiro às pendências mais antigas.

### Regra FIFO

Ao aprovar um pagamento:

1. localizar contas semanais pendentes do funcionário;
2. ordenar da mais antiga para a mais recente;
3. aplicar pagamento até quitar cada uma;
4. aplicar eventual restante à semana atual;
5. se ainda houver sobra, gerar crédito.

Isso permite saber corretamente quais semanas estão encerradas e quais continuam abertas.

---

# 26. Modelo financeiro recomendado

Evitar um simples campo `ja_pago`.

Criar estrutura auditável.

## 26.1 Contas semanais

Tabela lógica `weekly_accounts`:

- funcionário;
- semana;
- total de consumo;
- total de ajustes;
- crédito aplicado;
- pagamentos aplicados;
- saldo;
- status financeiro.

Os totais podem ser recalculados por função, mas deve existir uma única regra central de cálculo.

## 26.2 Pagamentos

Tabela `payments`:

- funcionário;
- semana de onde o pagamento foi enviado;
- valor declarado;
- status;
- comprovante;
- data de envio;
- data de aprovação/rejeição;
- admin responsável;
- motivo de rejeição/correção.

## 26.3 Alocações

Tabela `payment_allocations`:

- pagamento aprovado;
- conta semanal;
- valor aplicado.

Um pagamento pode ser dividido entre várias semanas antigas.

## 26.4 Créditos

Criar ledger de créditos:

`credit_ledger`

Entradas possíveis:

- crédito gerado por pagamento excedente;
- crédito utilizado em uma semana;
- correção administrativa.

Nunca guardar apenas um número mutável sem histórico.

---

# 27. Histórico

## 27.1 Histórico geral

Tela com semanas:

```text
10/08 – 14/08    Atual
03/08 – 07/08    Em aberto    2 pendências
27/07 – 31/07    Encerrada
```

Filtros:

- todas;
- atual;
- em aberto;
- encerradas.

## 27.2 Histórico por funcionário

Perfil do funcionário deve exibir:

- saldo global atual;
- crédito atual;
- semanas;
- consumo;
- pagamentos;
- status.

Ao abrir uma semana:

- detalhes de todos os pedidos;
- ajustes;
- pagamentos;
- saldo.

---

# 28. Funcionários

Tela admin:

- busca por nome;
- ativos/inativos;
- participantes/não participantes;
- status de acesso.

Campos:

- nome;
- telefone;
- papel;
- participa;
- ativo;
- pedido padrão.

Ações:

- editar;
- inativar;
- reativar;
- copiar convite;
- gerar novo convite;
- redefinir acesso;
- ver histórico.

Não excluir funcionário que possua histórico.

Usar inativação lógica.

---

# 29. Modelo de dados

Os nomes abaixo são recomendados e podem sofrer pequenos ajustes técnicos sem alterar as regras.

## 29.1 `profiles`

```text
id uuid PK -> auth.users.id
name text not null
phone text unique not null
role enum(admin, employee)
is_participant boolean default true
is_active boolean default true
default_meal_type_id uuid nullable
default_quantity integer default 1
created_at timestamptz
updated_at timestamptz
```

## 29.2 `activation_tokens`

```text
id uuid PK
profile_id uuid
hashed_token text
expires_at timestamptz
used_at timestamptz nullable
created_at timestamptz
created_by uuid
```

Nunca persistir token puro se não for necessário.

## 29.3 `app_settings`

Singleton.

```text
id uuid
app_name text
timezone text
restaurant_name text
restaurant_phone text nullable
pix_key text
pix_recipient_name text
pix_city text
pix_description text nullable
order_open_time time
order_close_time time
active_weekdays smallint[]
updated_at timestamptz
updated_by uuid
```

## 29.4 `meal_types`

```text
id uuid
code text unique
name text
current_price numeric(10,2)
is_active boolean
sort_order integer
created_at timestamptz
updated_at timestamptz
```

Seeds:

- P
- M
- G
- SALADA

## 29.5 `weeks`

```text
id uuid
start_date date
end_date date
status enum(current, open, closed)
created_at timestamptz
created_by uuid
closed_at timestamptz nullable
```

Constraint: no máximo uma semana `current`.

## 29.6 `week_days`

```text
id uuid
week_id uuid
date date unique
weekday smallint
status enum(scheduled, open, closed, reopened)
manual_closed_at timestamptz nullable
reopened_at timestamptz nullable
created_at timestamptz
```

## 29.7 `menu_days`

```text
id uuid
week_day_id uuid unique
raw_text text nullable
confirmed boolean default false
created_at timestamptz
updated_at timestamptz
```

## 29.8 `menu_items`

```text
id uuid
menu_day_id uuid
name text
sort_order integer
```

## 29.9 `menu_imports`

```text
id uuid
week_id uuid
storage_path text
status enum(uploaded, processing, review, confirmed, failed)
provider text nullable
raw_result jsonb nullable
error_message text nullable
created_by uuid
created_at timestamptz
```

## 29.10 `orders`

Uma resposta por funcionário por dia.

```text
id uuid
week_day_id uuid
profile_id uuid
response_status enum(ordered, declined)
observation text nullable
created_at timestamptz
updated_at timestamptz
created_by uuid
updated_by uuid
```

Unique:

`(week_day_id, profile_id)`

## 29.11 `order_items`

```text
id uuid
order_id uuid
meal_type_id uuid
quantity integer
unit_price_snapshot numeric(10,2)
created_at timestamptz
```

Unique:

`(order_id, meal_type_id)`

## 29.12 `order_adjustments`

```text
id uuid
order_id uuid
amount numeric(10,2)
reason text not null
created_by uuid
created_at timestamptz
reversed_at timestamptz nullable
reversed_by uuid nullable
reversal_reason text nullable
```

`amount` pode ser positivo ou negativo.

## 29.13 `weekly_accounts`

```text
id uuid
week_id uuid
profile_id uuid
charges_total numeric(10,2)
adjustments_total numeric(10,2)
credit_applied numeric(10,2)
payments_applied numeric(10,2)
balance_due numeric(10,2)
status enum(pending, partial, waiting_validation, paid, credit)
updated_at timestamptz
```

Unique:

`(week_id, profile_id)`

Não permitir que frontend altere cálculos diretamente.

## 29.14 `payments`

```text
id uuid
profile_id uuid
submitted_from_week_id uuid nullable
amount numeric(10,2)
status enum(pending, approved, rejected, reversed)
receipt_path text
user_note text nullable
admin_note text nullable
submitted_at timestamptz
reviewed_at timestamptz nullable
reviewed_by uuid nullable
rejection_reason text nullable
```

## 29.15 `payment_allocations`

```text
id uuid
payment_id uuid
weekly_account_id uuid
amount numeric(10,2)
created_at timestamptz
```

## 29.16 `credit_ledger`

```text
id uuid
profile_id uuid
week_id uuid nullable
payment_id uuid nullable
type enum(generated, applied, correction, reversal)
amount numeric(10,2)
description text nullable
created_by uuid nullable
created_at timestamptz
```

Definir convenção única e documentada para sinal positivo/negativo.

Recomendação:

- positivo = aumenta crédito disponível;
- negativo = consome crédito.

## 29.17 `audit_logs`

```text
id uuid
actor_id uuid
action text
entity_type text
entity_id uuid nullable
metadata jsonb
created_at timestamptz
```

Registrar pelo menos:

- reabertura/fechamento;
- alteração de pedido pelo admin;
- ajuste financeiro;
- aprovação/rejeição/reversão de pagamento;
- mudança de preço;
- alteração de configuração sensível.

---

# 30. Funções/RPCs de negócio

Não espalhar regras financeiras e de horário por vários componentes.

Criar funções centralizadas.

Sugestões:

## 30.1 `is_order_window_open(date, user_role)`

Determina se funcionário pode editar pedido.

## 30.2 `submit_daily_order(...)`

Valida no backend:

- usuário autenticado;
- próprio profile;
- dia válido;
- janela aberta;
- quantidades;
- tipos ativos;
- snapshots de preço.

## 30.3 `decline_daily_order(...)`

Registra explicitamente que não pedirá.

## 30.4 `admin_upsert_order(...)`

Admin override.

## 30.5 `recalculate_weekly_account(profile_id, week_id)`

Única fonte de verdade do total semanal.

## 30.6 `apply_available_credit(profile_id, week_id)`

Aplica crédito quando existir saldo devido.

## 30.7 `approve_payment(payment_id)`

Transação atômica:

1. validar status pending;
2. aplicar FIFO;
3. gerar allocations;
4. gerar crédito excedente;
5. recalcular contas afetadas;
6. recalcular status das semanas;
7. marcar pagamento approved;
8. registrar auditoria.

## 30.8 `reject_payment(payment_id, reason)`

## 30.9 `recalculate_week_status(week_id)`

Se histórica:

- qualquer saldo > 0 => `open`;
- nenhuma pendência => `closed`.

---

# 31. Segurança / Row Level Security

RLS obrigatória em todas as tabelas expostas.

## 31.1 Funcionário

Pode ler:

- próprio profile;
- cardápio da semana atual/histórico necessário;
- próprios pedidos;
- próprias contas semanais;
- próprios pagamentos;
- próprios créditos.

Pode criar/alterar:

- próprio pedido, somente por função segura e dentro da janela;
- próprio comprovante/pagamento pendente.

Nunca pode:

- consultar pedido de colega;
- consultar saldo de colega;
- consultar comprovante de colega;
- alterar preço;
- alterar cardápio;
- aprovar pagamento.

## 31.2 Admin

Pode acessar todos os registros necessários.

Operações privilegiadas devem usar role/claims e funções seguras, não confiar apenas em esconder botões.

## 31.3 Storage

Buckets privados:

### `menu-images`

- escrita: admin;
- leitura: admin/Edge Function.

### `payment-receipts`

- upload: funcionário somente em seu próprio caminho;
- leitura: próprio funcionário e admin;
- nunca público.

Estrutura sugerida:

```text
payment-receipts/<profile-id>/<payment-id>/<filename>
```

## 31.4 Secrets

Nunca colocar no bundle frontend:

- chave de provider de IA;
- Supabase secret/service key;
- qualquer segredo administrativo.

Frontend recebe apenas credenciais publicáveis apropriadas.

---

# 32. Rotas frontend

## 32.1 Públicas

```text
/login
/primeiro-acesso/:token
```

## 32.2 Funcionário autenticado

```text
/pedido
/minha-semana
/minha-semana/:weekId
/meu-historico
/minha-conta
```

## 32.3 Admin

```text
/admin
/admin/semana/:weekId
/admin/dia/:weekDayId
/admin/cardapio/:weekId
/admin/funcionarios
/admin/funcionarios/:profileId
/admin/pagamentos
/admin/historico
/admin/configuracoes
```

Separar layouts Admin e Funcionário.

---

# 33. UX / interface

## 33.1 Direção visual

- clean;
- moderna;
- funcional;
- pouca ornamentação;
- excelente legibilidade;
- feedback visual claro;
- sem aparência de ERP pesado.

## 33.2 Funcionário

Prioridade total para celular.

- botões grandes;
- poucos campos;
- pedido em uma única tela;
- confirmação explícita;
- mensagens simples.

## 33.3 Admin

Prioridade para desktop sem abandonar responsividade.

Dashboard deve aproveitar largura para reproduzir visão semanal de planilha.

## 33.4 Estados visuais

Padronizar badges:

- aberto;
- fechado;
- atual;
- em aberto;
- encerrado;
- pendente;
- parcial;
- aguardando validação;
- pago;
- crédito.

Não depender apenas de cor; sempre mostrar texto/ícone.

## 33.5 Feedback

Todas as ações importantes devem mostrar feedback:

- pedido confirmado;
- pedido alterado;
- mensagem copiada;
- PIX copiado;
- comprovante enviado;
- pagamento aprovado;
- cardápio salvo.

---

# 34. Estados vazios e erros

Tratar explicitamente:

- nenhuma semana atual;
- cardápio ainda não importado;
- cardápio sem item no dia;
- nenhum pedido recebido;
- nenhum pagamento pendente;
- histórico vazio;
- IA indisponível;
- upload falhou;
- comprovante inválido;
- pedido fechou enquanto usuário estava com a página aberta;
- sessão expirou;
- funcionário inativo;
- preço não configurado.

Nunca exibir stack trace ao usuário.

---

# 35. Regras especiais e casos extremos

## 35.1 Pedido sem item

Não permitir `ordered` com todas as quantidades zero.

Nesse caso, usuário deve usar **Não vou pedir hoje**.

## 35.2 Observação sem pedido

Não permitir observação se status for `declined`.

## 35.3 Pedido com tipo inativado

Pedidos históricos continuam válidos.

Tipos inativados deixam de aparecer para novos pedidos.

## 35.4 Mudança de preço

Não alterar snapshots antigos.

## 35.5 Funcionário inativado durante semana

Histórico permanece.

Ele não pode fazer novos pedidos.

Pedidos já feitos não são apagados automaticamente.

## 35.6 Novo funcionário no meio da semana

Admin cadastra normalmente.

Após ativação, ele pode pedir nos próximos dias abertos.

Não criar respostas retroativas.

## 35.7 Admin altera pedido depois do fechamento

Permitir.

Recalcular:

- total do dia;
- conta semanal;
- financeiro;
- status da semana, quando necessário.

Registrar auditoria.

## 35.8 Pagamento pendente duplicado

Permitir mais de um comprovante pendente somente se usuário conscientemente enviar pagamentos separados.

Antes de enviar novo, alertar se já existir comprovante aguardando validação.

## 35.9 Pagamento maior

Não bloquear.

Excesso vira crédito somente após aprovação.

## 35.10 Pagamento menor

Não bloquear.

Saldo continua pendente.

---

# 36. Geração de links

As mensagens copiadas devem usar `APP_BASE_URL`.

Não hardcodar domínio.

Link diário pode ser genérico:

`{APP_BASE_URL}/pedido`

A aplicação resolve automaticamente o dia atual.

Link da cobrança:

`{APP_BASE_URL}/minha-semana/{weekId}`

Não incluir identificador de outro usuário na URL.

Autenticação define quem pode ver os dados.

---

# 37. Variáveis de ambiente

Frontend:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_APP_BASE_URL=
```

Edge Functions / secrets:

```env
OPENAI_API_KEY=
OPENAI_VISION_MODEL=
```

Se necessário, usar secrets fornecidos automaticamente pelo ambiente Supabase para operações administrativas.

Criar:

- `.env.example`;
- nunca versionar `.env` real.

---

# 38. Estrutura de pastas sugerida

```text
/
├─ src/
│  ├─ app/
│  │  ├─ router/
│  │  ├─ providers/
│  │  └─ layouts/
│  ├─ components/
│  │  ├─ ui/
│  │  ├─ common/
│  │  ├─ employee/
│  │  └─ admin/
│  ├─ features/
│  │  ├─ auth/
│  │  ├─ employees/
│  │  ├─ weeks/
│  │  ├─ menus/
│  │  ├─ orders/
│  │  ├─ billing/
│  │  ├─ payments/
│  │  └─ settings/
│  ├─ lib/
│  │  ├─ supabase/
│  │  ├─ pix/
│  │  ├─ whatsapp/
│  │  ├─ currency/
│  │  └─ dates/
│  ├─ hooks/
│  ├─ types/
│  └─ main.tsx
│
├─ supabase/
│  ├─ migrations/
│  ├─ functions/
│  │  ├─ extract-menu/
│  │  ├─ create-activation/
│  │  ├─ activate-user/
│  │  └─ payment-admin/  # somente se RPC SQL não for suficiente
│  └─ seed.sql
│
├─ tests/
├─ public/
├─ .env.example
├─ README.md
└─ PROJECT_SPEC.md
```

Não transformar toda pequena ação em Edge Function.

Preferir PostgreSQL/RPC quando a lógica é transacional e pertence ao banco.

---

# 39. Utilitários obrigatórios

Criar funções puras para:

- normalização de telefone;
- formatação de moeda BRL;
- datas/dias da semana em pt-BR;
- geração da mensagem diária;
- geração do pedido ao restaurante;
- geração da cobrança;
- resumo de quantidades;
- cálculo visual do pedido;
- geração/validação do payload PIX;
- regras de status.

Isso facilita testes e evita duplicação.

---

# 40. Testes

Usar pelo menos testes unitários para regras críticas.

## 40.1 Obrigatórios

### Pedidos

- 1P;
- 2P;
- combinação P + Salada;
- pedido zero inválido;
- declined válido;
- edição antes do fechamento;
- bloqueio após fechamento.

### Geração de restaurante

- somente normais;
- normais + observações;
- somente observações;
- múltiplos tipos;
- quantidade > 1;
- ordem P/M/G/Salada.

### Financeiro

- pagamento exato;
- pagamento parcial;
- pagamento excedente;
- geração de crédito;
- uso automático de crédito;
- débito atravessando semana;
- pagamento FIFO em duas semanas;
- ajuste positivo;
- ajuste negativo.

### Segurança

Testar políticas críticas de RLS:

- funcionário A não lê pedido B;
- funcionário A não lê pagamento B;
- funcionário não altera preço;
- funcionário não aprova pagamento.

### PIX

Testar geração de payload e CRC/validação de estrutura antes de considerar concluído.

---

# 41. Critérios de aceite do MVP

O MVP só deve ser considerado funcional quando for possível executar este cenário do início ao fim:

## Segunda-feira

1. Admin entra no sistema.
2. Cria nova semana.
3. Envia foto do cardápio.
4. Sistema tenta extrair texto.
5. Admin revisa.
6. Salva cardápio.

## Dia útil — manhã

7. Admin abre o dia.
8. Clica em copiar mensagem.
9. Cola manualmente no WhatsApp.
10. Funcionário abre link.
11. Login persistido ou autenticação por telefone + PIN.
12. Vê cardápio.
13. Faz pedido.
14. Outro funcionário registra `Não vou pedir hoje`.
15. Admin vê em tempo real quem respondeu e quem não respondeu.

## 10:30

16. Funcionário deixa de conseguir alterar automaticamente.
17. Admin copia pedido agrupado.
18. Pedido segue exatamente a regra de normais + observações.
19. Admin consegue reabrir.
20. Funcionário altera.
21. Admin fecha novamente.

## Durante a semana

22. Admin adiciona ajuste de +R$ 5 a um pedido com justificativa.
23. Total semanal é atualizado.

## Sexta-feira

24. Sistema mostra total de cada funcionário.
25. Admin copia cobrança individual.
26. Funcionário abre detalhamento.
27. Gera PIX com valor.
28. Altera valor para um pagamento parcial ou maior.
29. Anexa comprovante.
30. Admin vê pagamento aguardando validação.
31. Admin aprova.
32. Sistema atualiza saldo.
33. Se excedente, gera crédito.
34. Crédito é usado na semana seguinte.
35. Semana antiga muda para encerrada quando não possui pendências.

---

# 42. Fora do MVP

Não implementar agora:

- envio automático para grupo do WhatsApp;
- WhatsApp Business API;
- leitura automática de respostas do WhatsApp;
- integração bancária;
- conciliação bancária automática;
- confirmação automática de PIX;
- SMS para recuperação de senha;
- push notifications;
- e-mail automático;
- aplicativo nativo Android/iOS;
- delivery/logística;
- estoque;
- múltiplas empresas/tenants;
- múltiplos restaurantes simultâneos;
- inteligência para sugerir pedido pelo cardápio;
- cobrança automática;
- integração com Google Sheets.

Não implementar funcionalidades fora do escopo apenas porque parecem úteis.

---

# 43. Fases de implementação

## Fase 0 — Bootstrap

- criar projeto React + TypeScript + Vite;
- configurar Tailwind;
- configurar ESLint/formatador;
- configurar Supabase client;
- criar `.env.example`;
- configurar router;
- criar layouts;
- criar design base;
- README de setup.

## Fase 1 — Banco e autenticação

- migrations;
- enums;
- tabelas base;
- RLS;
- admin inicial;
- funcionários;
- convite;
- primeiro acesso;
- telefone + PIN;
- sessão;
- proteção de rotas.

## Fase 2 — Configurações e semana

- settings;
- tipos/preços;
- dias ativos;
- horários;
- criação de semana;
- status de semana;
- dashboard inicial.

## Fase 3 — Cardápio manual

Antes da IA:

- cadastro manual;
- edição;
- visualização no pedido;
- mensagens diárias.

O sistema deve ser utilizável mesmo sem IA antes de avançar.

## Fase 4 — Pedidos

- tela funcionário;
- pedido padrão;
- quantidades;
- observação;
- não vou pedir;
- fechamento automático por regra de backend;
- reabertura;
- painel admin diário;
- resumo semanal.

## Fase 5 — Mensagem para restaurante

- agregador;
- regras normais/especiais;
- copiar para clipboard;
- testes.

## Fase 6 — Financeiro base

- snapshots de preço;
- ajustes;
- weekly_accounts;
- detalhamento;
- cobrança copiável.

## Fase 7 — PIX e comprovantes

- configurações PIX;
- payload;
- QR;
- valor editável;
- upload privado;
- pagamentos pending;
- admin revisão.

## Fase 8 — Crédito/débito

- allocations;
- FIFO;
- credit ledger;
- parcial;
- excedente;
- fechamento de semanas;
- testes completos.

## Fase 9 — IA do cardápio

Somente depois do fluxo manual estar estável:

- upload da foto;
- Edge Function;
- provider;
- saída estruturada;
- revisão;
- fallback.

## Fase 10 — Polimento

- histórico;
- filtros;
- responsividade;
- estados vazios;
- loading/error;
- auditoria;
- testes finais;
- deploy.

---

# 44. Estratégia de implementação para o Cursor

O Cursor não deve tentar implementar o projeto inteiro em uma única resposta/execução.

Para cada fase:

1. ler este `PROJECT_SPEC.md`;
2. identificar dependências da fase;
3. implementar somente a fase atual;
4. rodar lint/typecheck/testes relevantes;
5. corrigir erros;
6. atualizar README quando necessário;
7. apresentar resumo objetivo do que foi criado;
8. indicar arquivos principais alterados;
9. listar qualquer configuração manual necessária;
10. parar e aguardar instrução para próxima fase.

Não substituir requisito por solução diferente sem explicar o motivo.

Se houver dúvida funcional real que possa alterar dados ou comportamento, perguntar antes de assumir.

---

# 45. Qualidade de código

- TypeScript com tipagem forte.
- Evitar `any` sem justificativa.
- Componentes pequenos e focados.
- Regras de negócio fora de componentes visuais.
- Não duplicar cálculo financeiro.
- Não duplicar geradores de mensagem.
- Validar dados tanto no frontend quanto no backend.
- Usar transação para aprovação financeira.
- Datas sempre tratadas usando timezone configurada.
- Dinheiro usando `numeric` no banco; nunca float para valores monetários.
- Formatar BRL apenas na camada de apresentação.
- Logs de erro sem vazar segredo.
- Erros amigáveis ao usuário.

---

# 46. README obrigatório

O README deve explicar:

- objetivo do projeto;
- stack;
- requisitos locais;
- instalação;
- variáveis de ambiente;
- criação do projeto Supabase separado;
- aplicação das migrations;
- criação do primeiro admin;
- execução local;
- deploy;
- configuração da IA;
- configuração do PIX;
- como rodar testes.

Não inserir credenciais reais no README.

---

# 47. Seed inicial

Criar seed apenas com estrutura não sensível:

## Tipos

```text
P
M
G
Salada
```

## Configuração

```text
Timezone: America/Sao_Paulo
Abertura: 08:30
Fechamento: 10:30
Dias ativos: segunda a sexta
```

Preços devem começar configuráveis e não assumir valores reais sem input do administrador.

PIX/restaurante devem usar placeholders até serem configurados.

---

# 48. Primeira tela esperada após setup

Se ainda não houver configuração completa:

Admin deve visualizar um onboarding curto:

1. Configurar restaurante;
2. Configurar PIX;
3. Configurar preços;
4. Cadastrar funcionários;
5. Iniciar primeira semana.

Não bloquear navegação, mas destacar itens pendentes.

---

# 49. Dashboard ideal do admin

Priorizar ações do dia.

Ordem sugerida:

## Hoje

- cardápio;
- status de pedidos;
- horário;
- pedidos recebidos;
- não pedirão;
- sem resposta;
- total P/M/G/Salada.

Ações:

- Copiar mensagem do dia;
- Ver pedidos;
- Fechar/Reabrir;
- Copiar pedido do restaurante.

## Semana

- grade de funcionários x dias;
- total financeiro;
- pendências.

## Pagamentos

- quantidade aguardando validação;
- acesso rápido.

---

# 50. Tela ideal do funcionário

A home do funcionário deve decidir a prioridade automaticamente.

Se pedido de hoje está aberto e ainda não respondeu:

**principal CTA = Fazer pedido de hoje**

Se já pediu:

mostrar resumo e botão **Alterar pedido** enquanto aberto.

Se marcou que não vai pedir:

mostrar confirmação e permitir mudar enquanto aberto.

Se dia fechou:

mostrar pedido final do dia.

Na sexta ou quando houver dívida:

mostrar card:

**Saldo a pagar: R$ X**

com ação:

**Ver detalhes e pagar**

---

# 51. Não negociáveis

O Cursor não deve remover ou simplificar estes pontos sem autorização:

1. Projeto isolado de todos os outros.
2. Cadastro fechado de funcionários.
3. Login por telefone + PIN.
4. Pedido P/M/G/Salada com quantidade.
5. Observação opcional.
6. `Não vou pedir hoje` diferente de sem resposta.
7. Fechamento no backend às 10:30 por padrão.
8. Admin pode reabrir e fechar novamente.
9. Mensagem para restaurante separa normais e observações.
10. Ajuste de valor somente pelo admin e com justificativa.
11. Snapshot de preço por item.
12. Comprovante obrigatório para pagamento informado.
13. Pagamento só vale após aprovação.
14. Pagamento parcial.
15. Pagamento excedente gera crédito.
16. Crédito atravessa semanas.
17. Débito atravessa semanas.
18. Pagamentos aplicados às dívidas mais antigas primeiro.
19. Histórico semanal e por usuário.
20. OCR/IA com revisão humana obrigatória e fallback manual.
21. Sem integração com WhatsApp no MVP.
22. Sem integração bancária no MVP.
23. Dados de outros funcionários protegidos por RLS.

---

# 52. Definição de pronto

Uma funcionalidade só está pronta quando:

- regra de negócio funciona;
- interface possui loading/error/sucesso quando aplicável;
- autorização foi considerada;
- dados persistem corretamente;
- não quebra mobile;
- não quebra desktop;
- cálculos críticos possuem testes;
- não existem erros de TypeScript;
- não existem secrets no frontend/repositório;
- documentação necessária foi atualizada.

---

# 53. Instrução de início recomendada para o Cursor

Após adicionar este arquivo na raiz do repositório, enviar ao Cursor:

```text
Leia integralmente o arquivo PROJECT_SPEC.md antes de alterar qualquer coisa.

Este é um projeto novo e totalmente independente. Não consulte, copie ou reutilize código, configurações, banco, .env, estilos ou decisões de outros projetos/repositórios existentes na máquina.

Quero começar somente pela Fase 0 — Bootstrap definida no PROJECT_SPEC.md.

Primeiro analise os requisitos da Fase 0 e me diga de forma objetiva o que será criado. Em seguida, implemente a Fase 0 dentro deste repositório, configure a estrutura inicial, rode as verificações disponíveis e corrija eventuais erros.

Não avance para autenticação, banco funcional, pedidos, financeiro, PIX ou IA ainda. Ao terminar, apresente:
1. resumo do que foi implementado;
2. estrutura principal criada;
3. comandos para executar localmente;
4. qualquer passo manual que eu precise fazer;
5. confirmação de que a Fase 0 está concluída e que aguardará minha autorização para a Fase 1.
```

---

# 54. Observação final

O objetivo não é construir um ERP genérico de refeições.

O objetivo é resolver de forma simples, segura e muito rápida o fluxo específico:

**cardápio → divulgação → pedido → fechamento → resumo para restaurante → cobrança → PIX → comprovante → validação → crédito/débito → histórico.**

Toda decisão de produto deve preservar esse foco.
