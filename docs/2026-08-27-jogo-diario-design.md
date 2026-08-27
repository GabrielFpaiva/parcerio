---
date: "2026-08-27"
type: project
tags:
  - project
  - parcerio
  - react-native
  - expo
  - firebase
  - product-design
  - active
status: active
---

# Jogo Diário — Design

> Mecânica nova dentro da **Spec 6 (Super Parceria e LLM)**. Uma pergunta por dia, a
> mesma para o app inteiro, votada dentro da Super Parceria. Este documento define o
> produto, o modelo de dados e as regras. Não altera nada das Specs 1 a 5.

---

## 1. O que é

Todo dia o app faz uma pergunta ao grupo — *"quem é mais provável de ter um pirrai?"* —
e cada membro vota em um membro. Quando todos votam, a contagem é revelada.

É o jogo de festa clássico, com uma diferença: o grupo não é aleatório. Uma Super
Parceria é um trio ou mais que já provou, por encontro real, que se gosta. Isso é o que
torna a zoeira segura o bastante para existir.

### O que ele deliberadamente não é

- **Não é ranking de amizade.** O doc de produto trata como inegociável que nunca existe
  "melhor parceiro do grupo" e que competição é sempre do grupo contra o próprio passado.
  O jogo aponta uma pessoa por piada, nunca por mérito. Nenhuma pergunta do catálogo
  ordena os membros por qualidade de amizade, esforço ou dedicação.
- **Não é feed nem chat.** A rodada abre, revela e fecha. Não tem comentário.
- **Não é caminho de progressão.** O XP é simbólico e limitado (§9). Encontro continua
  sendo a única coisa que move número de verdade.

---

## 2. Onde vive, e o preço disso

O jogo vive na **Super Parceria**, e a Super Parceria nasce por descoberta: todas as
arestas do trio em `level >= 8` e `temperature >= 75`. Como o teto digital de temperatura
é 70, isso é inalcançável sem encontro real.

**Consequência aceita:** ninguém vê o jogo diário no teste de campo (semanas 5 a 8), e
possivelmente ninguém o vê nos primeiros meses. O jogo é recompensa de fim de jogo, não
ferramenta de aquisição ou de retenção inicial.

Isso foi decidido conscientemente, contra duas alternativas descartadas:

| Alternativa | Por que foi descartada |
|---|---|
| Um "grupo leve" só para o jogo, sem exigir nível/temperatura | Cria um segundo conceito de grupo ao lado da Super Parceria. Dois grupos no mesmo app é confusão de produto, e barateia o que a Super Parceria significa |
| Baixar 8/75 durante o teste de campo | O teste deixaria de validar justamente a tese que a Super Parceria existe para provar |

---

## 3. A rodada

```
00:00 — a pergunta do dia muda (a mesma para todos os grupos do app)
  → card na tela da Super Parceria: a pergunta + quantos já votaram
  → cada membro vota em UM membro, inclusive em si mesmo
  → enquanto a rodada está aberta, ninguém vê voto de ninguém
  → fecha quando TODOS votaram, ou às 23:59 (America/Sao_Paulo)
  → revela: a contagem e quem votou em quem
```

**Votar em si mesmo é permitido, e é importante.** Assumir a piada antes que apontem para
você é a válvula de escape que faz zoeira consentida funcionar. Proibir o autovoto
transforma o jogo em julgamento dos outros sobre você.

**O fechamento é preguiçoso.** Não existe job das 23:59 — não há Cloud Functions
(decisão da Spec 2) e não vai haver por isto. A rodada é *derivada* como fechada quando o
cliente abre e vê que todos votaram ou que a data passou. Mesma estratégia do decaimento
preguiçoso escolhido para a Temperatura na Spec 4.

---

## 4. A pergunta do dia é global

A pergunta é **derivada da data**, idêntica para todos os grupos do app:

```
indice = (dias desde 2026-01-01, em America/Sao_Paulo) módulo tamanhoDoCatalogo
```

Duas razões, uma técnica e uma de produto.

**Técnica:** se o grupo escolhesse a pergunta, quem abrisse primeiro escolheria — e
poderia re-sortear até cair uma que lhe convém. Derivando da data, ninguém escolhe nada e
o problema deixa de existir sem precisar de servidor.

**De produto:** todo mundo respondendo a mesma pergunta no mesmo dia dá ao jogo vida fora
do grupo. É o efeito Wordle — o assunto vaza para o WhatsApp, que é exatamente para onde
este app empurra conversa.

### A verificar antes de implementar

As regras do Firestore têm `request.time` e aritmética inteira, incluindo `%`. Se
`request.time.toMillis()` permitir calcular o índice do dia dentro da regra, **a regra
consegue rejeitar qualquer `questionId` que não seja o do dia** — e o tamanho do catálogo
vira mais um literal fixado na regra, exatamente o padrão que a Spec 2 estabeleceu.

Isso ainda **não foi verificado contra o emulador**. A Spec 2 rendeu três achados que
mudaram o desenho (`getAfter()`, `expiresAt`, deep link no Expo Go) justamente por
verificar antes de assumir. Este item entra na mesma fila.

**Se não der:** `questionId` é escrito pelo primeiro votante e travado como imutável pela
regra. Um cliente adulterado corromperia o histórico do próprio grupo e de mais ninguém.
Risco aceito e documentado, não silenciado.

---

## 5. Catálogo e fila de sugestão

**O catálogo é curado por você.** ~100 a 150 perguntas escritas e revisadas uma a uma.
Tom sob controle total. Sem LLM: gerar pergunta por LLM foi avaliado e descartado para
esta entrega — tom não determinístico é risco que este jogo especificamente não pode
correr, ainda que a Spec 6 já tenha Claude por outros motivos.

**Qualquer membro pode sugerir uma pergunta**, num campo dentro da tela do jogo. A
sugestão vai para uma fila global que só você lê, e entra no catálogo para todo mundo se
você aprovar.

O ponto importante: **sugestão não vira jogo no grupo que a escreveu**. Foi a decisão
explícita, contra a alternativa mais divertida de a pergunta cair só no pote daquele
grupo. A piada interna seria melhor, mas o pote privado é um vetor de bullying direto —
uma pergunta escrita para ferir uma pessoa específica, jogada só onde ela está. A fila
global custa a recompensa imediata e compra o controle de tom inteiro.

A fila funciona só com regras: `create` para qualquer usuário autenticado, `read: false`
para todo mundo. Você lê pelo console.

### Regras de curadoria do catálogo

Uma pergunta entra se, e só se:

1. A resposta é uma **previsão sobre o futuro ou um traço engraçado**, não um juízo sobre
   o valor da pessoa.
2. Ser apontado por ela é, no pior caso, **constrangedor**, nunca humilhante.
3. Ela não toca em: dinheiro, aparência, peso, doença, morte, vício, fracasso amoroso,
   competência profissional, família de origem.
4. Ela funciona igualmente bem apontando para **qualquer** membro do grupo.

O critério 4 é o mais útil na prática: pergunta que só faz sentido apontando para uma
pessoa específica é ofensa disfarçada de jogo.

### Tirar uma pergunta do ar

Uma pergunta ruim que escapou é **substituída, nunca removida**. Você reescreve o `text`
daquele mesmo `order` e a troca vale para todos os grupos no mesmo instante, sem deploy.

Remover o documento não é opção: o índice do dia (§4) endereça `order`, então apagar uma
pergunta abre um buraco na sequência e o app fica sem pergunta naquele dia. Se um dia o
catálogo precisar encolher de verdade, o `order` tem que ser recompactado inteiro — e
isso muda a pergunta de todos os dias futuros de uma vez, o que é aceitável mas não é
manutenção de rotina.

---

## 6. Voto escondido até a revelação, aberto depois

São duas coisas diferentes, e vale separar:

**Escondido até fechar** — obrigatório. Ver o voto dos outros antes de votar destrói o
jogo. Resolvido no modelo de dados (§7), não na tela.

**Aberto depois de fechar** — decidido. Depois da revelação, aparece quem votou em quem.

Anonimato permanente foi considerado e **descartado por ser impossível de entregar com
honestidade**. Sem servidor, a soma dos votos é feita no cliente; se o cliente soma, o
cliente leu quem votou em quem. "Anônimo" seria verdade só na tela, e qualquer pessoa com
o app aberto e a aba de rede derrubaria a promessa. Promessa de privacidade que não se
sustenta é pior que ausência de promessa.

Voto aberto também é onde o jogo é divertido: a graça é saber quem te apontou.

---

## 7. Modelo de dados

Espelha o `partnerships/{pid}/days/{YYYY-MM-DD}` que já existe — um documento por dia,
consulta de histórico por range no id do documento.

### `superPartnerships/{spid}/games/{YYYY-MM-DD}`

```ts
{
  date: string;              // "2026-08-27"
  questionId: string;        // imutável depois do create
  voterUids: string[];       // QUEM votou. Público. Não diz em quem.
  xpAwarded: number;         // literal fixado na regra
}
```

`voterUids` ser público é de propósito: alimenta o *"faltam 2"* do card sem vazar nada.

### `superPartnerships/{spid}/games/{YYYY-MM-DD}/votes/{uid}`

```ts
{
  votedFor: string;          // uid de um membro do grupo
  votedAt: Timestamp;
}
```

Um documento por votante. **É esta separação que esconde o voto:** a regra de leitura de
`votes/*` só libera quando a rodada fechou. O documento do dia, que qualquer um lê, não
contém voto nenhum.

### `gameQuestions/{qid}`

```ts
{
  text: string;              // "Quem é mais provável de ter um pirrai?"
  emoji: string;
  order: number;             // estável, é o que o índice do dia endereça
}
```

Leitura liberada para autenticado, escrita para ninguém.

### `questionSuggestions/{sid}`

```ts
{
  text: string;
  suggestedBy: string;       // uid
  suggestedAt: Timestamp;
}
```

`create` para autenticado, `read` e `update` para ninguém.

---

## 8. As regras são o servidor

Seguindo a linha fechada na Spec 2, cada valor em que o cliente não pode ser confiado é
literal fixado na regra, e cada regra tem um teste que a vê negando.

| Regra | O que ela garante |
|---|---|
| `votes/{uid}` só é criado pelo próprio `uid` | Ninguém vota pelos outros |
| `votes/{uid}` não aceita `update` nem `delete` | Voto não muda depois de dado |
| `votedFor` tem que estar em `members` da Super Parceria | Não dá para votar em quem não é do grupo |
| Leitura de `votes/*` exige rodada fechada **ou** ser o próprio voto | Voto escondido até a revelação, sem impedir você de reler o que votou |
| `voterUids` só cresce, e só com o próprio uid | Não dá para forjar quórum nem apagar quem votou |
| `xpAwarded` só aceita os literais de §9 | XP não é inventado pelo cliente |
| `questionId` imutável depois do create | Histórico do dia não é reescrito |

**Rodada fechada**, na regra, é: `voterUids.size()` igual ao número de membros, **ou**
`request.time` depois de 23:59 do dia no id do documento. O número de membros sai de um
`get()` no documento da Super Parceria.

O voto e o `voterUids` são escritos **na mesma transação**. A Spec 2 já provou com
`getAfter()` que a regra enxerga o estado pós-transação, então a regra do voto consegue
exigir que o `voterUids` correspondente esteja sendo escrito junto.

### O que testar com mutação, especificamente

A lição cobrada da Spec 1 e da Spec 2 vale aqui inteira: *uma mutação não valida uma
suíte*, e fixture de negação que difere do documento válido em mais de um campo não isola
nada. Cada guarda abaixo precisa do seu próprio teste, com o resto do documento válido:

- Ler o voto **de outro membro** com a rodada aberta e faltando exatamente um votante.
- Ler o **próprio** voto com a rodada aberta — este tem que *passar*.
- Ler `votes/*` às 23:58 e às 23:59:01 do dia do documento.
- Votar em um uid que não é membro, com todo o resto válido.
- Escrever `votes/{uid}` sem tocar em `voterUids` na mesma transação.
- Remover um uid de `voterUids` mantendo o próprio voto intacto.
- Escrever `xpAwarded` fora dos literais, um literal errado de cada vez.

---

## 9. XParceria

O jogo alimenta o `xparceria` da Super Parceria, que **já existe no modelo, separado das
arestas**. Não encosta em XP de parceria nem em temperatura.

| Ação | XParceria do grupo |
|---|---|
| Votar | +6 |
| Todos votaram | +9 |
| **Teto diário** | **15** |

Os números espelham de propósito o ritual diário da dupla (emoji +6, reciprocidade +6,
teto 15). Um encontro de duas horas continua valendo +180 numa aresta. A proporção que
sustenta a tese do produto fica intacta.

**O jogo não segura a dormência.** Dormência é movida por temperatura de aresta, que é
movida por encontro real. Um grupo que joga todo dia e não se encontra continua caindo
para `dormant` — e deve mesmo. Foi a alternativa mais tentadora e a mais perigosa: seria
o furo mais direto na tese do app inteiro.

---

## 10. Telas

| Tela | O que tem |
|---|---|
| Card na tela da Super Parceria | A pergunta do dia, quantos votaram, botão de votar ou de ver o resultado |
| Modal de voto | A pergunta, a lista de membros com avatar, confirmar. Um toque para votar |
| Revelação | A contagem, e embaixo quem votou em quem |
| Sugerir pergunta | Campo de texto e enviar. Sem status de aprovação — a sugestão some de vista |

A revelação é o único momento com animação. O resto é seco, na linha dos 20 segundos do
ritual diário.

---

## 11. O que fica de fora, e riscos abertos

**Fora do escopo:** pergunta gerada por LLM, pote de perguntas por grupo, jogo na dupla,
comentário na revelação, histórico navegável além do range simples por data.

| Risco | Tamanho | O que se sabe hoje |
|---|---|---|
| **Sem push remota no Expo Go** | Alto | Notificação local só dispara para quem já abriu o app. Um jogo *diário* sem push é frágil por construção. Só melhora no dev build, no V1 |
| **"Todos votaram" fica raro em grupo de 8** | Médio | O +9 vira inalcançável justamente nos grupos maiores. Pode ser que o bônus tenha que virar proporcional ao quórum. **Sem dado para decidir agora** — decidir depois de ver rodada real |
| **O catálogo esgota** | Médio | 150 perguntas jogadas todo dia repetem em cinco meses. A fila de sugestão ajuda, mas depende de você curar |
| **Uma pergunta ruim escapa** | Baixo, impacto alto | Mitigado pelas quatro regras de curadoria de §5, e reversível na hora reescrevendo o `text` daquele `order` |

---

## 12. Onde isso entra

**Spec 6 — Super Parceria e LLM**, depois de a detecção de triângulos existir. Depende
de: `superPartnerships` criado e povoado, `members` confiável, XP de grupo funcionando.

Não depende de LLM, apesar de morar na mesma spec. Pode ser construído e testado antes de
qualquer integração com Claude.

---

*Design de feature — Jogo Diário, Parcerio. Próximo passo: plano de implementação, junto
com o resto da Spec 6.*
