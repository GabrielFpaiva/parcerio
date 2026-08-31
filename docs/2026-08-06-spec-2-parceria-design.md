---
date: "2026-08-06"
type: spec
spec: 2
title: "Spec 2 — Parceria"
depends_on: "Spec 1 (Fundação)"
status: approved
---

# Spec 2 — Parceria

Convite, aceite, nascimento e ciclo de vida. Depende da Spec 1 (auth, perfil, design
system, security rules) e é pré-requisito das Specs 3 (mapa) e 4 (progressão).

Referência: `docs/2026-08-03-parceria-design.md`, §4 (Atos I e II), §5, §6, §7, §19.

> **Sem Cloud Functions.** O plano Blaze recusou o cartão, e a validação com amigos não
> pode esperar faturamento. Toda a escrita acontece no cliente, dentro de transações do
> Firestore, e **as security rules são o servidor**: cada valor em que o cliente não pode
> ser confiado é fixado por regra, e cada regra tem um teste que a mostra negando.
> A §4 explica o que esse desenho garante e o que ele não garante.

---

## 1. O que esta spec entrega

| # | Entrega |
|---|---|
| 1 | Criação de convite — código de 8 caracteres, 7 dias, uso único |
| 2 | Landing estática no Firebase Hosting, com preview rico para o WhatsApp |
| 3 | Onboarding com primeiro convite (Ato I) e tela de espera com preview animado |
| 4 | Entrada por código no app + tela de aceite com o perfil de quem convidou |
| 5 | Aceite — nascimento da parceria numa transação, com valores fixados por regra |
| 6 | Cerimônia de nascimento, simultânea nos dois aparelhos |
| 7 | Lista de parcerias e visão geral da parceria |
| 8 | Pausar, retomar e encerrar |
| 9 | Propagação de perfil para `memberProfiles`, feita pelo dono do perfil |
| 10 | Ponte `onSnapshot` → React Query (`useFirestoreDoc` / `useFirestoreCollection`) |
| 11 | Suíte de negação das rules, cobrindo cada campo fixado |

### Fora de escopo

| Item | Onde entra |
|---|---|
| `visibleTo` / presença | **Spec 3** — ver §4.4 |
| Hibernação (`hibernating`) | Spec 4 — depende do motor de temperatura |
| Mapa, marcadores, escrita de localização | Spec 3 |
| Emoji diário, handshake de encontro, timeline visual | Spec 4 |
| Catálogo de conquistas | Spec 5 |
| Push remota | V1 (dev build) |

---

## 2. Decisões que se afastam do documento de produto

Cinco. As três primeiras foram verificadas contra documentação oficial; as duas últimas
são consequência de não haver servidor.

### 2.1 `pending` não existe como documento de parceria

O §5 desenha `PENDING → ACTIVE`, mas o `pid` é `[uidA, uidB].sort().join('_')` e o
segundo uid só existe no instante do aceite. Não há documento a criar antes disso.

**O `invites/{code}` é o estado pendente.** A parceria nasce já `active`, e `'pending'`
sai do union `PartnershipStatus`. Efeito colateral bem-vindo: convite nunca aceito não
deixa parceria fantasma para limpar.

### 2.2 Deep link deixa de ser o caminho primário do convite

A documentação do Expo é explícita: *"Support for incoming links in Expo Go is
limited"*, e sobre `Linking.createURL()`: *"The behavior of this method in Expo Go for
published updates is undefined and should not be relied upon. The created URL in this
case is neither stable nor predictable during the lifetime of the app."*

Um produto cujo funil inteiro passa pelo convite não pode apoiar a conversão em
comportamento indefinido. Então:

- **Primário:** código de 8 caracteres, digitado na tela "Tenho um convite".
- **Contexto:** landing https estática, que é o que aparece com preview no WhatsApp.
  Hosting está no plano gratuito — não depende do Blaze.
- **Bônus:** a rota `invite/[code]` também atende `exp://.../--/invite/CODE` quando o
  link funcionar. Nada depende disso.

Deep link de verdade (Universal Links / App Links) entra no V1, com o dev build.

### 2.3 Reaceite reativa a parceria encerrada

`endPartnership` marca `ended`, e o `pid` determinístico significaria que duas pessoas
que encerraram nunca mais poderiam ser parceiras. Como *"XParceria nunca é perdido"* é
princípio fundador (§11), aceitar um convite sobre uma parceria `ended`:

- reativa **o mesmo documento** — XParceria, nível, conquistas e timeline intactos;
- reseta `temperature` para `TEMPERATURE.INITIAL`;
- **não** concede os +100 de novo;
- grava evento `partnership_resumed`.

Parceria já `active` ou `paused` → recusa. Retomar uma pausa não é convite.

Quatro membros novos no union `EventType` de `shared/types.ts`: `partnership_born`,
`partnership_paused`, `partnership_resumed`, `partnership_ended`. `streak.lastDay`
também passa a aceitar `null`: no nascimento não existe dia anterior.

### 2.4 `users.stats` deixa de ser escrito e passa a ser derivado

O §7 guarda `stats.partnershipCount` e `stats.totalXParceria` no documento do usuário.
Sem servidor isso é impossível de manter: quem aceita o convite **não pode escrever no
documento do outro**, e afrouxar essa regra deixaria qualquer pessoa reescrever os stats
de qualquer pessoa — hipótese pior que o problema que resolve.

**Os campos continuam existindo, congelados em zero e imutáveis pela regra que a Spec 1
já escreveu.** A tela de perfil (Spec 4) calcula os números a partir da lista de
parcerias, que o cliente já carrega inteira. Denormalizar volta a fazer sentido quando
houver servidor, e aí é uma migração de uma função.

### 2.5 A propagação de `memberProfiles` é feita pelo dono do perfil

Sem trigger, quem edita o perfil atualiza `memberProfiles[próprioUid]` em cada uma das
suas parcerias, em lote, logo após salvar. A regra permite alterar **apenas a própria
chave**.

Se o app morrer no meio do lote, alguma parceria fica com nome ou foto velhos até a
próxima edição. É uma janela pequena, num evento raro, com dado cosmético — aceito.

---

## 3. Modelo de dados

### 3.1 `invites/{code}`

```ts
{
  code: string;              // 8 chars, base32 Crockford sem I, L, O, U
  fromUid: string;
  fromProfile: { displayName: string; photoURL: string | null; avatarEmoji: string; handle: string };
  createdAt: Timestamp;      // == request.time, imposto pela regra
  usedBy: string | null;
  status: 'pending' | 'accepted';
  maxUses: 1;
}
```

**Não existe campo `expiresAt`,** e a razão é uma armadilha que só aparece ao escrever a
regra: o cliente não sabe o valor de `request.time` antes do commit, então não consegue
gravar `createdAt + 7d` de um jeito que a regra possa conferir. Deixar o campo livre
criaria o convite que nunca expira — o abuso mais óbvio possível.

O vencimento é **derivado** de `createdAt + 7 dias`, no cliente e na regra. Um campo a
menos e nada a forjar.

`'expired'` também não é persistido, pelo mesmo espírito: sem job agendado, um status
gravado ficaria mentindo até alguém rodar a limpeza. O valor `'expired'` sai do campo
`status` previsto no §7.

O alfabeto sem `I`, `L`, `O` e `U` existe porque o código será **digitado à mão** e lido
em voz alta no WhatsApp. `1/I/l` e `0/O` são a maior fonte de erro de digitação; `U` sai
para reduzir a chance de o gerador formar palavras infelizes.

**Não há teto de convites pendentes.** Regras não sabem contar. O dano é limitado por
construção: cada convite carrega o uid de quem o criou e serve uma vez só.

### 3.2 `partnerships/{pid}` no nascimento

```ts
{
  id: pid,                                  // [uidA, uidB].sort().join('_')
  members: [uidA, uidB],                    // ordenado — array-contains depende disso
  memberProfiles: { [uid]: { displayName, photoURL, avatarEmoji } },

  status: 'active',
  createdBy: inviterUid,
  bornFromInvite: code,                     // ← como a regra prova o consentimento
  createdAt: request.time,
  activatedAt: request.time,

  xparceria: 100,                           // XP.PARTNERSHIP_BORN
  level: 1,
  xpIntoLevel: 100,
  xpForNextLevel: 122,                      // xpForNextLevel(1) = 100 + 22

  temperature: 50,                          // TEMPERATURE.INITIAL
  temperatureBand: 'mild',

  streak: { current: 0, longest: 0, lastDay: null, freezesLeft: 2 },
  stats: { encounterCount: 0, totalMinutesTogether: 0, lastEncounterAt: null,
           daysSinceLastEncounter: 0, firstEncounterAt: null,
           longestEncounterMinutes: 0, maxDistanceKm: 0, placesVisited: 0 },

  achievements: ['o-comeco'],
  superPartnershipId: null,
  updatedAt: request.time,
}
```

**Todos esses valores são literais fixados pela regra de `create`.** Não há um único
número que o cliente escolha, e a §4.2 mostra como.

`bornFromInvite` é o campo novo em relação ao §7 do doc de produto. Ele existe porque a
regra precisa de um caminho para o convite a fim de provar que a outra pessoa consentiu.

Detalhe de produto que cai de graça da curva de níveis: 100 XParceria contra os 122 do
nível 2 deixa a barra em **82% já na cerimônia**. A parceria nasce a um passo de subir
de nível.

A conquista `'o-comeco'` é gravada como literal. O catálogo é da Spec 5; adiantar só o
id mantém a cerimônia inteira sem antecipar o sistema.

### 3.3 Eventos

`partnerships/{pid}/events/{eventId}`, append-only.

O evento de nascimento tem **id fixo `born`**, o que torna a escrita idempotente. Os
demais têm id automático.

| Evento | `xpAwarded` |
|---|---|
| `partnership_born` | 100 |
| `partnership_paused`, `partnership_resumed`, `partnership_ended` | 0 |

A regra fixa o `xpAwarded` de cada tipo. Evento de encontro continua `if false` — é da
Spec 4, e é onde XParceria de verdade seria forjável.

---

## 4. A arquitetura sem servidor

### 4.1 O princípio, reformulado

O §6 diz *"o cliente propõe, o servidor decide"*. Sem servidor:

> **As security rules são o servidor.** Cada valor que o cliente não pode escolher é um
> literal na regra. Cada regra tem um teste que a vê negando.

A diferença prática em relação a Cloud Functions é que a regra **valida**, mas não
**calcula**. Serve para o nascimento, em que todos os valores são constantes conhecidas.
Não serve para o motor de progressão, em que o valor depende de estado anterior — e é
por isso que a §7 desta spec trata o que a Spec 4 vai precisar.

### 4.2 Como a regra prova o consentimento

A pergunta que decide a segurança deste desenho: *o que impede a Carol de criar uma
parceria com a Alice sem que a Alice queira?*

O documento de convite. A parceria carrega `bornFromInvite`, e a regra de `create`
segue esse ponteiro:

```js
function inviteAuthorizes(code, inviterUid, accepterUid) {
  let inv = get(/databases/$(database)/documents/invites/$(code)).data;
  return inv.fromUid == inviterUid
      && inv.fromUid != accepterUid
      && inv.usedBy == null
      && inv.status == 'pending'
      && inv.createdAt + duration.value(7, 'd') > request.time;
}
```

A Carol só cria a parceria se estiver de posse de um convite válido e não usado que a
Alice gerou. É exatamente o mesmo nível de garantia que a Cloud Function daria: quem tem
o código pode aceitar, e ninguém mais.

A mesma transação marca o convite como usado. As duas escritas são avaliadas contra o
estado **anterior** à transação, então `usedBy == null` vale para as duas. Dois aceites
simultâneos: as duas transações escrevem o mesmo documento de convite, o Firestore aborta
uma. Sem parceria duplicada, sem convite reutilizado.

### 4.3 A birth cabe numa transação só — graças a `getAfter()`

Há uma armadilha aqui, e a saída dela é uma função pouco conhecida.

Numa transação, `get()` dentro de uma regra enxerga o estado **anterior** à transação.
A regra do evento precisa verificar se quem escreve é membro da parceria — mas no
nascimento a parceria está sendo criada na mesma transação, e para o `get()` ela ainda
não existe. A verificação falharia sempre.

A documentação do Firestore resolve isso explicitamente: *"For writes, you can use the
`getAfter()` function to access the state of a document after a transaction or batch of
writes completes but before the transaction or batch commits."*

Então a regra do evento usa `getAfter()`, e **tudo cabe numa transação**: cria a
parceria, cria `events/born`, marca o convite como usado. Ou nasce inteira, ou não
nasce.

O orçamento de chamadas fecha com folga. O limite documentado é *"10 for
single-document requests"* e *"20 for multi-document reads, transactions, and batched
writes"*: três escritas com no máximo duas consultas cada dão 6.

O evento de nascimento mantém o id fixo `born` mesmo assim — custa nada e deixa a
escrita idempotente caso um dia seja preciso repeti-la.

### 4.4 `visibleTo` sai da Spec 2

O plano com Cloud Functions preenchia `visibleTo` no nascimento. Sem servidor não dá:
quem aceita não pode escrever o documento de presença do outro, e o próprio não pode ser
escrito na mesma transação pelo motivo da §4.3.

O desenho correto passa a ser **cada usuário mantém o próprio `visibleTo`**, reconciliado
ao abrir o app: o cliente lê as parcerias ativas e sincroniza a lista. A regra libera o
dono a adicionar um uid por vez, provando com `get()` que existe parceria ativa com
aquela pessoa:

```js
function pid(a, b) { return a < b ? a + '_' + b : b + '_' + a; }
```

Isso é presença, e presença é a **Spec 3**. A Spec 2 garante que a parceria seja a fonte
da verdade; a Spec 3 escreve a reconciliação e as regras correspondentes. Nada se perde:
não há localização escrita até lá.

### 4.5 O que este desenho não garante

Honestidade sobre a diferença em relação a Cloud Functions:

| Risco | Situação |
|---|---|
| Forjar XParceria, nível ou temperatura no nascimento | **Impedido.** Todos são literais na regra |
| Criar parceria sem consentimento | **Impedido.** Exige convite válido do outro |
| Reutilizar um convite | **Impedido.** `usedBy` e a transação |
| Escrever evento de encontro | **Impedido.** `if false` até a Spec 4 |
| Mentir no `occurredAt` de um evento de ciclo de vida | **Possível.** Cosmético |
| Encerrar ou pausar a parceria unilateralmente | **Possível — e é o comportamento desejado** |
| Criar muitos convites | **Possível.** Cada um serve uma vez e carrega o uid do dono |
| Mentir sobre o próprio `displayName` em `memberProfiles` | **Possível** — e equivale a mudar o próprio nome, que já é permitido |

Nenhum desses toca o número que é o produto. O que **precisaria** de servidor de verdade
é o motor da Spec 4, e a §7 trata disso.

---

## 5. Security rules

O centro de gravidade desta spec. Sem servidor, é aqui que mora a garantia.

### 5.1 `invites`

```js
match /invites/{code} {
  // `get` sim, `list` não: com o código a pessoa lê o convite; sem ele, não
  // varre a coleção. São 32^8 ≈ 1,1 trilhão de códigos — adivinhar é inviável.
  allow get:  if isSignedIn();
  allow list: if false;

  allow create: if isOwner(request.resource.data.fromUid)
                && request.resource.data.usedBy == null
                && request.resource.data.status == 'pending'
                && request.resource.data.maxUses == 1
                && request.resource.data.createdAt == request.time
                && matchesOwnProfile(request.resource.data.fromProfile);

  // Só a transição pendente → usado, e só por quem não é o dono.
  allow update: if isSignedIn()
                && resource.data.usedBy == null
                && request.resource.data.usedBy == request.auth.uid
                && request.auth.uid != resource.data.fromUid
                && request.resource.data.status == 'accepted'
                && request.resource.data.diff(resource.data)
                     .affectedKeys().hasOnly(['usedBy', 'status']);

  allow delete: if false;
}
```

`matchesOwnProfile` compara com `get(/users/$(request.auth.uid))` — sem isso, qualquer
um geraria um convite exibindo o nome e a foto de outra pessoa, que é o vetor de
engenharia social mais óbvio de um produto de convite.

### 5.2 `partnerships` — create

Todo campo é literal. A regra é longa de propósito: é a fronteira inteira do produto.

```js
allow create: if isSignedIn()
              && pidMatches(pid, request.resource.data.members)
              && request.auth.uid in request.resource.data.members
              && request.resource.data.status == 'active'
              && request.resource.data.createdBy != request.auth.uid
              && request.resource.data.createdBy in request.resource.data.members
              && inviteAuthorizes(request.resource.data.bornFromInvite,
                                  request.resource.data.createdBy,
                                  request.auth.uid)
              && request.resource.data.xparceria == 100
              && request.resource.data.level == 1
              && request.resource.data.xpIntoLevel == 100
              && request.resource.data.xpForNextLevel == 122
              && request.resource.data.temperature == 50
              && request.resource.data.temperatureBand == 'mild'
              && request.resource.data.achievements == ['o-comeco']
              && request.resource.data.superPartnershipId == null
              && request.resource.data.streak == zeroStreak()
              && request.resource.data.stats == zeroPartnershipStats()
              && request.resource.data.createdAt == request.time
              && request.resource.data.activatedAt == request.time;
```

`createdBy != request.auth.uid` é o que impede alguém de criar uma parceria consigo
mesmo como convidante. `pidMatches` prova que o id do documento é de fato
`members[0] + '_' + members[1]` com `members` ordenado e de tamanho 2 — sem isso, o
mesmo par geraria documentos diferentes e o `array-contains` do mapa mostraria duplicata.

### 5.3 `partnerships` — update

Três ramos disjuntos, cada um com `affectedKeys().hasOnly(...)`. Misturá-los num único
ramo é como se abre um buraco sem perceber.

| Ramo | Chaves | Condição |
|---|---|---|
| **Ciclo de vida** | `status`, `updatedAt` | membro, e transição em `{active→paused, paused→active, active→ended, paused→ended}` |
| **Reativação** | `status`, `temperature`, `temperatureBand`, `memberProfiles`, `bornFromInvite`, `updatedAt` | `resource.data.status == 'ended'`, novos valores fixados (`active`, 50, `mild`) e `inviteAuthorizes(...)` |
| **Perfil** | `memberProfiles`, `updatedAt` | membro, e o diff de `memberProfiles` afeta **apenas** `request.auth.uid` |

`delete` continua `if false`: encerrar é mudar `status`, nunca apagar.

### 5.4 `partnerships/{pid}/events/{id}`

```js
// Leitura olha o estado atual; escrita olha o estado pós-transação, para que
// o evento de nascimento possa ser gravado junto com a parceria (§4.3).
function isMemberAfter(pid) {
  return isSignedIn() && request.auth.uid in
    getAfter(/databases/$(database)/documents/partnerships/$(pid)).data.members;
}

allow read:   if isMember(partnership(pid));
allow create: if isMemberAfter(pid)
              && request.resource.data.occurredAt == request.time
              && lifecycleEventXp(request.resource.data.type)
                   == request.resource.data.xpAwarded;
allow update, delete: if false;
```

`lifecycleEventXp` devolve 100 para `partnership_born`, 0 para os três de ciclo de vida,
e `-1` para qualquer outro tipo — o que nega encontro, level up e missão, que são das
Specs 4 e 5. Um tipo novo aparecendo sem entrada na função é negado por omissão, que é
o padrão correto.

### 5.5 Cobertura de teste

**Cada literal fixado acima tem um teste que tenta forjá-lo e o vê ser negado.** São
cerca de 40 casos novos. Não é excesso: sem servidor, essa suíte é a única coisa entre
o produto e um número inventado.

E vale a lição da Spec 1 — *uma mutação não valida uma suíte*. Para cada regra, mutar
**aquela** condição e ver o teste correspondente falhar.

---

## 6. Cliente

### 6.1 Rotas

```
app/(app)/onboarding/
    first-invite.tsx      "Quem é o seu parceiro?" → gera e compartilha
    waiting.tsx           espera com preview animado

app/(app)/
    index.tsx             lista de parcerias        ← temporário
    invite/enter.tsx      "Tenho um convite" → digita o código
    invite/[code].tsx     preview + aceitar          (também atende exp://)
    partnership/[id]/index.tsx   visão geral + pausar / encerrar

app/(modals)/
    partnership-born.tsx  cerimônia
```

O onboarding fica em **`(app)/`**, não em `(auth)/`: o `(auth)/_layout.tsx` da Spec 1
redireciona para `/` assim que o perfil existe, e o convite acontece depois do perfil.
Em `(auth)/` as telas seriam inalcançáveis.

**A raiz é a lista, não o mapa.** O §5 manda o mapa ser a raiz, e ele será — na Spec 3,
quando existir. Montar um tab bar de três abas com duas vazias agora é andaime a
demolir depois.

### 6.2 Módulos

```
src/features/invite/
    services/invites.ts       criar, ler e aceitar (transação)
    hooks/useCreateInvite.ts · useInvitePreview.ts · useAcceptInvite.ts
    FirstInviteScreen.tsx · WaitingScreen.tsx · EnterCodeScreen.tsx · AcceptInviteScreen.tsx
src/features/partnership/
    services/partnerships.ts  pausar, retomar, encerrar, propagar perfil
    hooks/usePartnerships.ts · usePartnership.ts
    PartnershipListScreen.tsx · PartnershipCard.tsx · PartnershipOverviewScreen.tsx
src/features/ceremony/
    PartnershipBornCeremony.tsx · useBornCeremony.ts
src/core/firebase/
    useFirestoreDoc.ts · useFirestoreCollection.ts    ponte para o React Query
    firestoreError.ts                                  código → mensagem em pt-BR
```

Mesmo padrão da Spec 1: `services/` puro sobre o SDK, `hooks/` com React Query, telas
sem lógica de negócio.

A ponte do §6 do doc de produto é necessária pela primeira vez aqui. **Nenhum componente
chama `onSnapshot` diretamente** — um ponto único de integração, testável isolado.

### 6.3 Erros

Sem callables não há `details.reason`; o que volta é `permission-denied` para tudo que a
regra recusa. O cliente **valida antes** — lê o convite, checa expiração, uso e
auto-convite com `checkInvite()` de `shared/`, e só então tenta a transação. A regra
continua sendo a autoridade; a validação prévia existe para a mensagem ser específica em
vez de "sem permissão".

### 6.4 A cerimônia simultânea

Os dois aparelhos escutam a mesma query (`members array-contains uid`). Quando uma
parceria aparece e o aparelho ainda não marcou aquele `pid` como visto no AsyncStorage
(`ceremony:born:{pid}`), o modal sobe.

Quem aceitou vê ao voltar da transação. Quem convidou vê na tela de espera, no mesmo
instante, sem push e sem polling. A flag persistida é o que impede a cerimônia de
reprisar a cada abertura do app.

### 6.5 Estados de tela

Toda tela tem estado vazio, de carregamento (skeleton, nunca spinner) e de erro, como
manda o §19. A lista vazia é a mais importante: é onde mora o convite.

---

## 7. O que a Spec 4 vai precisar resolver

Registrado agora para que a decisão de hoje não vire surpresa em três semanas.

O motor de progressão precisa de duas coisas que regras não fazem: **calcular a partir
do estado anterior** e **rodar sozinho todo dia**. Duas saídas, nenhuma exigindo cartão:

1. **Decaimento preguiçoso.** Em vez de um job baixar a temperatura toda madrugada,
   guardar `temperatureBase` e `temperatureAt` e derivar a temperatura atual na leitura,
   com a função pura que a Spec 1 já tem. O job diário deixa de existir. Vale para
   temperatura, `daysSinceLastEncounter` e banda.
2. **XParceria por delta com teto na regra.** Emoji e encontro concedem valores
   conhecidos, e a regra pode exigir `xparceria == resource.data.xparceria + 6` com o
   teto diário lido do documento do dia. É mais trabalhoso que a Cloud Function, mas é
   o mesmo tipo de fixação que esta spec já faz.

A saída 1 é boa o bastante para ser preferível mesmo com servidor disponível. Se o
Blaze abrir antes da Spec 4, vale reavaliar — mas o produto não fica bloqueado se não
abrir.

---

## 8. Testes

### 8.1 Puro, sem Firebase

`shared/`:

- `partnershipId(uidA, uidB)` — comutatividade, ordenação, recusa de auto-parceria
- `buildBirthPartnership(inviter, accepter)` — o documento inteiro, reutilizado na
  reativação. É a decisão de negócio do nascimento como função pura, e o que a regra
  fixa tem de bater com o que ela produz
- `checkInvite(invite, accepterUid, now)` — expiração, uso, auto-convite
- gerador e normalizador de código — alfabeto, comprimento, correção de `I/L/O/U`

### 8.2 Rules — a suíte que carrega esta spec

Além dos 38 testes da Spec 1, cerca de 40 casos novos:

| Grupo | Casos |
|---|---|
| `invites` | criar com `fromUid` alheio · forjar `fromProfile` · `createdAt` no futuro · `usedBy` preenchido no create · `list` da coleção · marcar como usado sendo o dono · alterar campo fora de `{usedBy, status}` · delete |
| `partnerships` create | sem convite · convite de terceiro · convite expirado · convite já usado · `createdBy` sendo o próprio · não estar em `members` · `pid` fora de ordem · `members` com 1 ou 3 uids · **cada** literal forjado (`xparceria`, `level`, `xpIntoLevel`, `xpForNextLevel`, `temperature`, `temperatureBand`, `achievements`, `streak`, `stats`, `superPartnershipId`, `createdAt`) |
| `partnerships` update | não-membro mudando status · transição proibida (`ended→active` pelo ramo de ciclo de vida) · mexer em `xparceria` junto com `status` · alterar `memberProfiles` do outro · reativação sem convite válido |
| `events` | não-membro lendo · membro escrevendo `encounter` · `xpAwarded` errado em `partnership_born` · `occurredAt` no passado · update e delete |

Cada uma com mutação da regra correspondente, vista falhando.

### 8.3 Integração e UI

Serviços de `invites` e `partnerships` testados contra o emulador com dois usuários
reais, cobrindo o caminho de fraude: aceitar o próprio convite, aceitar duas vezes,
convite expirado, já serem parceiros, reativar parceria encerrada.

RNTL para as telas e para a cerimônia, lembrando que `render` e `fireEvent` do RNTL v14
são **assíncronos** — armadilha já paga na Spec 1.

`npm run validate` continua `typecheck && test && test:rules`. Sem workspace novo.

---

## 9. Pré-requisitos manuais

| # | Tarefa | Bloqueia |
|---|---|---|
| 1 | Habilitar o **Firebase Hosting** no projeto (console → Hosting → Começar) | A landing. Está no plano gratuito, não depende de Blaze |

Nada mais. O projeto continua inteiramente no plano Spark.

---

## 10. Riscos aceitos

| Risco | Situação |
|---|---|
| **Regras carregam a garantia sozinhas** | Mitigado pela suíte de ~40 negações com mutação. É o custo real de não ter servidor, e é onde a revisão deve gastar tempo |
| **Spec 1 nunca foi aberta num celular** | Decisão do Gabriel: verificar no aceite final da Spec 2. Concentra as surpresas de runtime (Reanimated, gesture-handler, worklets) num só momento, e a cerimônia é animação de tela cheia |
| Convite por código é mais friccional que link | Aceito — a alternativa depende de comportamento que a doc do Expo chama de indefinido. Medir a conversão no teste de campo |
| `getAfter()` é caminho menos batido que `get()` | Documentado e suportado pelo emulador, mas a suíte precisa provar o nascimento inteiro numa transação antes de qualquer tela existir |
| `memberProfiles` stale após edição de perfil | Janela pequena, evento raro, dado cosmético. Autocorrige na próxima edição |
| Spec 4 sem servidor | Endereçado na §7: decaimento preguiçoso remove a necessidade do job |

---

## 11. Critério de aceite

1. Duas pessoas, em dois aparelhos, viram parceiras via código de convite — e **as duas
   veem a cerimônia de nascimento**.
2. A parceria aparece na lista das duas com nível 1, 100 XParceria e temperatura 50.
3. Pausar, retomar e encerrar funcionam; encerrar preserva XParceria e nível, e um
   convite novo reativa a mesma parceria sem reconceder os +100.
4. `npm run validate` verde, com a suíte de rules cobrindo cada literal fixado.
5. **O app roda no Expo Go num celular real** — o aceite pendente da Spec 1, cobrado
   aqui.

---

*Próximo passo: plano de implementação em `docs/plans/`.*
