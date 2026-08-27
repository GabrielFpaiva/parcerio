---
date: "2026-08-03"
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

# Parcerio — Documento de Produto e Arquitetura

> Documento de primeira entrega. Define visão, produto, arquitetura, dados e roadmap
> **antes** de qualquer linha de código. A implementação é decomposta em 6 specs
> independentes na última seção.

## Decisões que moldam este documento

Quatro restrições foram fechadas antes de escrever, e elas explicam quase todo corte
feito aqui:

| Decisão | Valor | Consequência |
|---|---|---|
| Objetivo | MVP para validar com 10–50 amigos | Corta ~70% das mecânicas do escopo original para o V0 |
| Distribuição | **Expo Go** (iOS + Android, custo zero) | Sem background location, sem push remota no V0 |
| Emoji diário | Livre (teclado completo) + sugeridos curados | Sugerido tem peso semântico; livre conta como ritual |
| Dedicação | 30h+/semana | V0 denso, primeiro teste real em ~3 semanas |

### Por que Expo Go, e o que se perde

O Expo Go permite que qualquer amigo — iPhone ou Android — rode o app abrindo um link,
sem loja, sem os US$ 99 da Apple, com atualização instantânea via EAS Update. Em troca,
só roda o que já vem embutido nele.

**Funciona:** Expo Router, NativeWind, Reanimated, Gesture Handler, `expo-blur`,
`expo-haptics`, `expo-image`, `react-native-maps`, `expo-location` em foreground,
Google Places (é HTTP), notificação **local**, e o Firebase pelo **JS SDK**.

**Não funciona:** background location, geofencing, push **remota** (a partir do SDK 53
o Expo Go não recebe mais notificação disparada por servidor), e
`@react-native-firebase/*` — a versão nativa. Usamos o JS SDK.

**Ressalva:** no iPhone o `react-native-maps` desenha **Apple Maps**, não Google Maps
(Google no iOS exige dev build). Na prática o Apple Maps favorece o visual minimalista
pretendido.

O loop principal de retenção — o ritual diário do emoji — sobrevive inteiro, porque
depende de notificação **local**. O que fica para o V1 é a mágica ambiente
("João está a 400m"), que exige dev build.

---

## 1. Visão do produto

Todo app de localização responde à pergunta **"onde essa pessoa está?"**. Life360,
Buscar, Zenly: a resposta é um ponto no mapa, e o ponto não significa nada. Por isso
ninguém abre o Life360 por prazer — abre por vigilância, culpa ou preocupação.

O Parcerio responde outra pergunta:

> **Como está minha amizade com aquela pessoa?**

A inversão que sustenta o produto inteiro: **o protagonista não é o usuário, é a
parceria**. Cada amizade é uma entidade própria, com nome, nível, histórico, temperatura
e vida. Você não tem um perfil que exibe amigos; você tem *n* parcerias, e cada uma é um
organismo que você cuida ou negligencia.

Isso muda tudo em cascata:

- O mapa não mostra pessoas, mostra **relações** (o anel do avatar é o estado da
  amizade, não do amigo).
- A notificação não diz "João se moveu", diz "faz 18 dias".
- A conquista não é sua, é **de vocês** — e por isso é compartilhável sem narcisismo.
- A métrica de sucesso não é tempo no app. É **encontro na vida real**.

### O que o produto se recusa a ser

Definir o não-produto é tão importante quanto o produto:

- **Não é vigilância.** Sem parceria aceita pelos dois lados, a localização não é
  escondida na interface — ela é negada no banco de dados. Não existe modo "ver quem
  está online" nem lista de pessoas próximas.
- **Não é rede social.** Sem feed, sem curtida, sem seguidor, sem descoberta de
  estranhos. Todo vínculo nasce de um convite direto e mútuo.
- **Não é ranking de amigos.** O app nunca ordena suas amizades da melhor para a pior.
- **Não é punitivo.** Nenhuma mecânica tira algo que você já conquistou.

### Métrica-norte

**Encontros confirmados por parceria ativa por mês.**

Deliberadamente não é DAU. Um app que vira dopamina diária mas não faz ninguém sair de
casa **falhou**, mesmo com retenção linda. DAU é métrica de saúde, não de sucesso.

| Métrica | Tipo | Meta no teste (30 dias, 10–50 amigos) |
|---|---|---|
| Encontros confirmados / parceria / mês | **Norte** | ≥ 2,0 |
| "Encontrei mais por causa do app" (survey) | **Validação** | ≥ 40% dizem sim |
| Ritual do emoji cumprido / dia | Saúde | ≥ 55% das parcerias ativas |
| D7 / D30 de retenção | Saúde | 60% / 35% |
| Parcerias que morrem (Temperatura < 15) | Contra-métrica | < 25% |

---

## 2. Público-alvo

### Núcleo — "o grupo que já existe"

**16 a 26 anos, brasileiros, com um grupo fechado de 3 a 8 amigos próximos que se
encontram com frequência mas menos do que gostariam.** Ensino médio final,
universitários, primeiro emprego. Órfãos do Zenly — usaram, amaram, e o app morreu em
fevereiro de 2023 sem substituto real.

A dor concreta não é "não sei onde meus amigos estão". É:

> *"A gente era inseparável e hoje se fala por story. Ninguém chama ninguém porque
> chamar dá trabalho e parece carência."*

O Parcerio remove o custo social de tomar a iniciativa. Não é você que está sendo
carente — é o app dizendo que a parceria esfriou. A responsabilidade sai da pessoa.

### Por que esse núcleo, e não "todo mundo"

Grupo fechado, alta densidade de rede, celular na mão o dia inteiro, e — o mais
importante — **já existe o hábito de se encontrar**. O app precisa aumentar uma
frequência existente, não criar uma do zero. Criar hábito social novo é problema
muito mais difícil, e não é o que estamos validando.

### Adjacentes (pós-validação, não agora)

- **Casais à distância** — usariam com intensidade brutal, mas distorcem o produto:
  a mecânica de encontro presencial não funciona, e o app viraria outra coisa.
- **Repúblicas e turmas de faculdade** — encaixe natural com Super Parceria.
- **Famílias** — é o mercado do Life360, mas exige tom completamente diferente
  (segurança, não diversão). Produto separado, não um modo.

### Anti-público

Quem quer monitorar alguém: pais rastreando filho, parceiro controlador. **Toda decisão
de design deve tornar o app ruim para esse uso** — parceria sempre mútua, revogável a
qualquer momento por qualquer lado, sem histórico de rota, sem alerta de "saiu de área".

---

## 3. Diferenciais competitivos

| | Zenly (†2023) | Life360 | Buscar (Apple) | Snapchat | **Parcerio** |
|---|---|---|---|---|---|
| Pergunta central | Onde você está? | Você está seguro? | Onde está meu iPhone? | O que rolou hoje? | **Como está nossa amizade?** |
| Unidade do produto | Pessoa | Família | Dispositivo | Conversa | **Parceria** |
| Gamificação | Leve (rank de melhores amigos) | Nenhuma | Nenhuma | Streak, emoji automático | **Nível + XParceria + Temperatura por relação** |
| Vínculo | Mútuo | Imposto pelo dono do círculo | Unilateral | Mútuo | **Mútuo e revogável** |
| Recompensa | Curiosidade | Alívio | Utilidade | Streak | **Encontro na vida real** |
| Tom | Divertido | Ansioso | Neutro | Efêmero | **Afetivo** |

### Os cinco diferenciais defensáveis

**1. A parceria é a entidade, não a pessoa.**
Nenhum concorrente modela a relação como objeto de primeira classe. É simples de copiar
tecnicamente e difícil de copiar culturalmente — reposiciona o produto inteiro. O Life360
não pode virar isso sem abandonar o mercado de pais.

**2. XParceria permanente + Temperatura decaindo.**
Dois números em vez de um (detalhado na §11). Resolve o conflito entre orgulho acumulado
e urgência presente sem punir ninguém. É a decisão mais original do produto.

**3. O sistema acusa, a pessoa não.**
Você nunca marca um amigo como "sumido". O app é que informa "faz 18 dias" e transforma
isso em desafio. Remover o custo social da cobrança é o desbloqueio emocional central.

**4. Encontro real vale 10–30x qualquer ação digital.**
O app é explicitamente ruim de farmar sem sair de casa. Um par que só cumpre o ritual
digital satura por volta do nível 12 — e o número comunica sozinho o que está faltando.

**5. Handshake bilateral de encontro.**
Encontro só conta quando os dois confirmam. Torna o Nível verdadeiro (invulnerável a
farm) e cria um micro-ritual social: virar o celular para o amigo tocar.

### Onde somos frágeis — e a resposta

| Fragilidade | Resposta |
|---|---|
| Rede: sozinho o app não vale nada | Onboarding só termina com 1 convite enviado; o convidado entra direto na parceria |
| Novidade se esgota em 2–3 semanas | Missões e desafios geram conteúdo novo; retrospectiva cria evento de longo prazo |
| Apple/Google podem clonar em um trimestre | Nenhum dos dois quer o vínculo emocional; ambos otimizam utilidade |
| Localização assusta parte do público | V0 já funciona sem background; a proposta é a amizade, não o mapa |

---

## 4. Jornada completa do usuário

### Ato I — Da instalação à primeira parceria (meta: < 3 min)

```
Abre o app
  → Tela-manifesto: "Toda amizade tem uma história. Essa aqui começa agora."
  → Login (Google / Apple / telefone)
  → Nome + foto + apelido
  → PERGUNTA-CHAVE: "Quem é o seu parceiro?"   ← o app pede UMA pessoa, não a agenda
  → Gera link de convite → compartilha no WhatsApp
  → Tela de espera COM CONTEÚDO (não é spinner):
      "Enquanto o João não aceita, olha o que vocês vão construir"
      → preview animado de uma parceria nível 12 fictícia
```

**Decisão de design:** o app pede **um** parceiro, não permissão de contatos. Pedir a
agenda inteira é o momento em que apps sociais mais perdem usuário, e comunica
"quero sua rede", não "quero sua amizade". Um convite é um gesto; a agenda é uma
extração.

**A permissão de localização não é pedida aqui.** É pedida depois que a parceria nasce,
com contexto: *"O João aceitou! Para vocês aparecerem no mapa um do outro..."*. Pedir
permissão antes de a pessoa entender o porquê derruba a taxa de aceite pela metade.

### Ato II — O nascimento (o momento mais importante do app)

```
João abre o link
  → Landing: "O Gabriel quer construir uma parceria com você"
  → Instala Expo Go → abre o app → login
  → Aceita
  → 🎉 CERIMÔNIA DE NASCIMENTO (animação de ~4s, tela cheia)
      "Gabriel 🤝 João — Parceria Nível 1"
      +100 XParceria · Temperatura 50
      Conquista desbloqueada: "O Começo"
  → OS DOIS recebem a mesma cerimônia, ao mesmo tempo
  → Prompt de localização, agora com contexto
  → Primeiro emoji: "Como está essa parceria hoje?"
```

A simultaneidade importa: os dois vivem o mesmo momento, provavelmente lado a lado ou
no WhatsApp. É o primeiro ato compartilhado — e a primeira coisa que dá vontade de
mostrar para outra pessoa.

### Ato III — O ritual diário (meta: 20 segundos)

```
19h — notificação LOCAL: "Como foi sua parceria com o João hoje?"
  → abre direto no seletor de emoji (não na home)
  → escolhe entre sugeridos ou abre o teclado completo
  → +6 XParceria · animação de envio
  → se o João já mandou hoje: revelação do emoji dele + bônus de reciprocidade (+6)
  → fecha o app
```

Vinte segundos. Deliberadamente curto. O app **não tenta reter** nesse momento — sessões
longas não são o objetivo, e o ritual sobrevive a dias corridos justamente porque é
barato. O que segura o hábito é a **revelação do emoji do outro**, não o tempo de tela.

Horário da notificação é aprendido: a partir da 2ª semana, dispara na hora em que o
usuário costuma abrir.

### Ato IV — O encontro (o clímax)

```
Gabriel e João estão juntos
  → Gabriel abre o app → banner: "Você está com o João agora?"   [SIM]
  → João recebe (notificação local + banner ao abrir) → CONFIRMA
  → 🤝 ENCONTRO REGISTRADO — animação em ambos os aparelhos
  → cronômetro roda em segundo plano enquanto o app está aberto
  → ao encerrar: "2h14 juntos — +194 XParceria — Temperatura 45 → 73"
  → entra na timeline com data, duração e local
  → se subiu de nível: cerimônia + card compartilhável
```

No V0 o app *sugere* o handshake quando as duas localizações batem com o app aberto; se
não bateu, qualquer um dos dois inicia manualmente. No V1, com background, a detecção é
automática e o handshake vira só confirmação.

### Ato V — O resfriamento (onde o produto prova seu valor)

```
Dia 12 sem encontro — Temperatura 42 🌤
  → card na home: "Faz 12 dias que vocês não se encontram"

Dia 18 — Temperatura 33 🌧 → DESAFIO DE RESGATE gerado
  → "Sua parceria com o João está esfriando.
     Encontrem-se antes de domingo. Recompensa: +500 XParceria"
  → botão [CHAMAR O JOÃO] → abre o WhatsApp com mensagem pronta
  → o João recebe o MESMO desafio — os dois sabem, ninguém precisa cobrar

Dia 45 — Temperatura 8 ❄️ → HIBERNAÇÃO
  → "Essa parceria está hibernando. O XParceria de vocês continua guardado."
  → sai do mapa principal, vai para uma aba própria
  → decai mais devagar; um único encontro traz de volta
```

O ponto crítico: **hibernar não apaga nada**. Nível e história ficam intactos. E o botão
que abre o WhatsApp com texto pronto é o que converte intenção em encontro — o app não
tenta ser o canal de conversa, ele empurra para onde a conversa já acontece.

### Ato VI — O longo prazo

Marcos de nível (10, 25, 50) com molduras e conquistas; aniversário da parceria com card
do ano; **Retrospectiva Anual** — o evento de compartilhamento mais forte do produto,
por parceria e não por usuário; nascimento espontâneo da Super Parceria.

---

## 5. Fluxo de navegação

### Estrutura de rotas (Expo Router)

```
app/
├── (auth)/
│   ├── welcome.tsx              manifesto
│   ├── sign-in.tsx
│   └── onboarding/
│       ├── profile.tsx
│       ├── first-invite.tsx     ← onboarding não termina sem isso
│       └── waiting.tsx
│
├── (app)/
│   ├── (tabs)/
│   │   ├── index.tsx            🗺  MAPA (raiz, protagonista)
│   │   ├── partnerships.tsx     🤝  Parcerias
│   │   └── profile.tsx          👤  Perfil
│   │
│   ├── partnership/[id]/
│   │   ├── index.tsx            visão geral
│   │   ├── timeline.tsx
│   │   ├── missions.tsx
│   │   └── achievements.tsx
│   │
│   ├── super/[id].tsx
│   ├── invite/[code].tsx        deep link do convite
│   └── settings/
│       ├── index.tsx
│       ├── privacy.tsx
│       └── notifications.tsx
│
└── (modals)/
    ├── emoji-picker.tsx         sugeridos + teclado completo
    ├── encounter-handshake.tsx
    ├── level-up.tsx             cerimônia
    ├── partnership-born.tsx     cerimônia
    └── share-card.tsx
```

### Princípios de navegação

**Três abas, nunca quatro.** Mapa, Parcerias, Perfil. Toda tentação de adicionar uma
quarta aba (missões, ranking, descobrir) é sinal de que o produto está perdendo o foco —
missões vivem dentro da parceria, que é onde fazem sentido.

**O mapa é a rota raiz.** Abrir o app cai no mapa, sempre. Nada de splash com menu.

**Cerimônias são modais de tela cheia, não telas.** Level up, nascimento e encontro
interrompem o fluxo, brilham e devolvem o usuário exatamente onde ele estava.

**Toda notificação abre no destino final**, nunca na home. Notificação de emoji abre o
seletor daquele parceiro; desafio abre o desafio.

**Profundidade máxima de 3.** Mapa → Parceria → Timeline. Nada mais fundo que isso.

### Diagrama de estados de uma parceria

```
                    convite enviado
                          ↓
   ┌──────────┐  aceita  ┌────────┐
   │ PENDING  │─────────▶│ ACTIVE │◀────────┐
   └──────────┘          └────────┘         │
        │ recusa/expira      │              │ 1 encontro
        ↓                    │ Temp < 15    │
   ┌──────────┐              ↓              │
   │ DECLINED │        ┌────────────┐───────┘
   └──────────┘        │ HIBERNATING│
                       └────────────┘
                             │ qualquer lado encerra
        ┌────────────────────┴───┐
        ↓                        ↓
   ┌─────────┐            ┌──────────┐
   │ PAUSED  │            │  ENDED   │  (dados retidos 90d, depois anonimizados)
   └─────────┘            └──────────┘
```

`PAUSED` existe para não forçar a escolha binária entre "compartilho localização" e
"encerro a amizade". Pausar mantém nível, história e ritual do emoji — só desliga o
mapa. É a válvula de escape que evita desinstalação.

---

## 6. Arquitetura do aplicativo

### Princípio central

> **O cliente propõe, o servidor decide.**

Nenhuma regra de XParceria, nível, temperatura, missão ou conquista roda no dispositivo.
O app chama uma Cloud Function, ela valida e escreve; o app só reage à mudança no
Firestore. Isso não é preciosismo: gamificação executada no cliente é hackeável em
minutos, e num app cuja moeda é confiança social, número falso mata o produto.

O cliente calcula apenas o que é **derivado e barato**: barra de progresso a partir de
XP já escrito, distância entre coordenadas, formatação de "faz 18 dias".

### Camadas

```
┌─────────────────────────────────────────────────────────┐
│  app/            rotas Expo Router — finas, sem lógica  │
├─────────────────────────────────────────────────────────┤
│  src/features/   UI + hooks + serviços por domínio      │
│    partnership · map · emoji · encounter · mission ·    │
│    profile · super · insight                            │
├─────────────────────────────────────────────────────────┤
│  src/core/       design system, firebase, libs, tipos   │
├─────────────────────────────────────────────────────────┤
│  React Query (servidor)  ·  Zustand (UI efêmera)        │
├─────────────────────────────────────────────────────────┤
│  Firebase JS SDK — Auth · Firestore · Functions · Storage│
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│  Cloud Functions (2ª geração, TypeScript)               │
│    callable:  invite · accept · emoji · handshake       │
│    trigger:   onEncounterWrite → XP, nível, conquista   │
│    scheduled: decaimento · missões · desafios · insights │
└─────────────────────────────────────────────────────────┘
```

### Divisão de estado — a regra

| Estado | Onde | Por quê |
|---|---|---|
| Parcerias, XP, nível, missões | **React Query** | Vem do servidor, tem cache e revalidação |
| Localização dos parceiros | **Zustand** | Muda a cada segundos, não deve invalidar query |
| Bottom sheet aberto, modal, aba | **Zustand** | UI efêmera, morre com o app |
| Rascunho de emoji, filtros | **Zustand** | Local, não persiste |
| Sessão do usuário | **Context** + AsyncStorage | Raiz da árvore |

Regra prática: **se veio do Firestore, é React Query. Se some ao fechar o app, é
Zustand.** Não há terceira categoria, e não existe estado de servidor duplicado no
Zustand.

### Fluxo de dados em tempo real

Firestore tem listener nativo, e usá-lo direto brigaria com o cache do React Query. A
ponte é um hook único:

```ts
// src/core/firebase/useFirestoreQuery.ts
// onSnapshot → queryClient.setQueryData → componentes reagem normalmente
export function useFirestoreDoc<T>(path: string, key: QueryKey) {
  const qc = useQueryClient();
  useEffect(() => onSnapshot(doc(db, path), snap => {
    qc.setQueryData(key, snap.data() as T);
  }), [path]);
  return useQuery<T>({ queryKey: key, queryFn: () => getDoc(...) });
}
```

Um único ponto de integração, testável isoladamente. Nenhum componente chama
`onSnapshot` diretamente.

### Localização — orçamento de escrita

Sem controle, localização em tempo real é o item que estoura o custo do Firestore e a
bateria do usuário. As regras:

- Escreve no máximo **1 vez a cada 30 s**
- E somente se deslocou **> 50 m** desde a última escrita
- Só com o app em **foreground** (V0)
- Precisão degradada para **~100 m** quando o parceiro mais próximo está a mais de 5 km
  — ninguém precisa de precisão de metros para saber que o amigo está em outra cidade

Com 50 usuários × 6 min de app aberto por dia: **~600 escritas/dia**. Irrelevante no
plano gratuito. Sem o throttle, o mesmo uso passa de 100 mil escritas/dia.

### Offline

Persistência offline do Firestore ligada. O app abre e mostra o último estado conhecido
com um selo discreto de "atualizado há X". Emoji enviado sem rede entra na fila e sobe
depois — o servidor valida a data, então não dá para burlar streak escrevendo com data
antiga.

### Testes

| Camada | Ferramenta | Cobertura alvo |
|---|---|---|
| Regras de XP, temperatura, nível | Jest, funções puras | **100%** |
| Cloud Functions | Firebase Emulator Suite | Caminho feliz + fraude |
| Security rules | `@firebase/rules-unit-testing` | **Toda regra tem teste de negação** |
| Hooks | React Native Testing Library | Principais |
| Fluxos críticos | Maestro | Nascimento, emoji, handshake |

O motor de progressão (§11–13) é **função pura sem dependência de Firebase**, testada
antes de existir infraestrutura. É o coração do produto e o lugar onde bug destrói
confiança.

---

## 7. Modelagem do banco de dados (Firestore)

### Visão geral

```
users/{uid}
partnerships/{pid}
  ├── days/{YYYY-MM-DD}
  ├── events/{eventId}
  ├── missions/{missionId}
  └── insights/{insightId}
presence/{uid}
superPartnerships/{spid}
invites/{code}
```

### `users/{uid}`

```ts
{
  uid: string;
  displayName: string;
  handle: string;              // único, minúsculo
  photoURL: string | null;
  avatarEmoji: string;         // fallback quando não há foto
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  timezone: string;            // "America/Sao_Paulo"

  stats: {
    partnershipCount: number;
    totalXParceria: number;    // soma de todas as parcerias
    totalEncounters: number;
    daysUsing: number;
    strongestPartnershipId: string | null;
  };

  settings: {
    shareLocation: boolean;    // desliga tudo de uma vez
    ritualHour: number;        // 19 — aprendido com o uso
    notifications: { ritual: boolean; challenges: boolean; encounters: boolean };
  };
}
```

### `partnerships/{pid}` — a entidade central

```ts
{
  id: string;                  // uids ordenados e unidos: "abc_xyz"
  members: [string, string];   // SEMPRE ordenado — array-contains funciona
  memberProfiles: {            // desnormalizado: evita N leituras no mapa
    [uid: string]: { displayName: string; photoURL: string | null; avatarEmoji: string }
  };

  status: 'pending' | 'active' | 'hibernating' | 'paused' | 'ended';
  createdBy: string;
  createdAt: Timestamp;
  activatedAt: Timestamp | null;   // quando o 2º aceitou — data de aniversário

  // PROGRESSÃO — só Cloud Function escreve
  xparceria: number;           // acumulado, NUNCA diminui
  level: number;
  xpIntoLevel: number;         // progresso dentro do nível atual
  xpForNextLevel: number;

  temperature: number;         // 0–100, decai com o tempo
  temperatureBand: 'burning' | 'warm' | 'mild' | 'cooling' | 'hibernating';

  streak: { current: number; longest: number; lastDay: string; freezesLeft: number };

  stats: {
    encounterCount: number;
    totalMinutesTogether: number;
    lastEncounterAt: Timestamp | null;
    daysSinceLastEncounter: number;   // recalculado no job diário
    firstEncounterAt: Timestamp | null;
    longestEncounterMinutes: number;
    maxDistanceKm: number;
    placesVisited: number;
  };

  achievements: string[];
  superPartnershipId: string | null;
  updatedAt: Timestamp;
}
```

**`pid` determinístico** (`[uidA, uidB].sort().join('_')`) elimina duplicata por
construção: duas pessoas se convidando ao mesmo tempo geram o mesmo documento, e a
segunda escrita simplesmente falha. Sem transação de deduplicação, sem parceria fantasma.

**`memberProfiles` desnormalizado** existe porque o mapa precisa desenhar 8 avatares:
com referência, seriam 8 leituras extras a cada abertura. Uma Cloud Function propaga
mudança de foto/nome para as parcerias do usuário — operação rara, leitura constante.

### `partnerships/{pid}/days/{YYYY-MM-DD}`

```ts
{
  date: string;                          // "2026-08-03"
  emojis: {
    [uid: string]: {
      emoji: string;                     // qualquer emoji
      isSuggested: boolean;              // veio da lista curada?
      sentiment: number | null;          // -1..1, só se isSuggested
      sentAt: Timestamp;
    }
  };
  reciprocal: boolean;                   // os dois enviaram no mesmo dia
  xpAwarded: number;
}
```

Um documento por dia por parceria. Consulta de calendário é range simples no ID; o
histórico completo de um ano são 365 documentos minúsculos.

### `partnerships/{pid}/events/{eventId}` — a timeline

```ts
{
  type: 'partnership_born' | 'encounter' | 'level_up' | 'mission_completed'
      | 'achievement' | 'streak_milestone' | 'anniversary' | 'super_born';
  occurredAt: Timestamp;
  xpAwarded: number;

  encounter?: {
    startedAt: Timestamp; endedAt: Timestamp; minutes: number;
    location: { lat: number; lng: number } | null;
    placeName: string | null;            // Google Places
    confirmedBy: [string, string];       // os DOIS — sem isso não existe
  };
  levelUp?: { from: number; to: number };
  mission?: { missionId: string; title: string };
  achievement?: { id: string; title: string; emoji: string };
}
```

Append-only. É o registro emocional do produto e a fonte da retrospectiva anual.

### `presence/{uid}` — localização

```ts
{
  uid: string;
  location: GeoPoint;
  accuracy: number;
  updatedAt: Timestamp;
  isStale: boolean;              // > 15 min
  batteryLevel: number | null;
  visibleTo: string[];           // ← a chave de tudo
}
```

Coleção **separada** de `users` de propósito: escreve com frequência, tem regra de acesso
diferente e nunca deve carregar junto do perfil.

`visibleTo` contém apenas uids com parceria `active` — mantido por Cloud Function nas
transições de estado. Isso permite a regra de segurança mais importante do app em uma
linha, **sem `get()` aninhado** (que custaria uma leitura cobrada por verificação):

```js
match /presence/{uid} {
  allow read:   if request.auth.uid in resource.data.visibleTo;
  allow write:  if request.auth.uid == uid;
}
```

Sem parceria aceita, a localização **não existe** para você. Não é escondida na
interface — é negada no banco.

### `superPartnerships/{spid}`

```ts
{
  id: string;
  members: string[];               // 3 a 8
  memberProfiles: { [uid: string]: {...} };
  partnershipIds: string[];        // todas as arestas do grafo
  name: string;                    // editável — "Os Fominhas"
  emoji: string;
  bornAt: Timestamp;
  level: number;
  xparceria: number;               // do grupo, separado das arestas
  bonusMultiplier: number;         // 1.5
  status: 'active' | 'dormant';
  stats: { groupEncounters: number; lastGroupEncounterAt: Timestamp | null };
}
```

### `invites/{code}`

```ts
{
  code: string;                    // 8 chars, base32 sem ambiguidade
  fromUid: string;
  fromProfile: { displayName: string; photoURL: string | null };
  createdAt: Timestamp;
  expiresAt: Timestamp;            // 7 dias
  usedBy: string | null;
  status: 'pending' | 'accepted' | 'expired';
  maxUses: 1;
}
```

### Índices compostos necessários

```
partnerships:  members (array-contains) + status + temperature DESC
partnerships:  members (array-contains) + updatedAt DESC
events:        occurredAt DESC                        (por parceria)
missions:      status + expiresAt ASC                 (por parceria)
```

### Segurança — o desenho completo

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    function isSignedIn()  { return request.auth != null; }
    function isMember(p)   { return request.auth.uid in p.members; }

    match /users/{uid} {
      allow read:   if isSignedIn();                    // perfil público mínimo
      allow write:  if request.auth.uid == uid
                    && !request.resource.data.diff(resource.data)
                         .affectedKeys().hasAny(['stats']);   // stats é do servidor
    }

    match /presence/{uid} {
      allow read:  if isSignedIn() && request.auth.uid in resource.data.visibleTo;
      allow write: if request.auth.uid == uid;
    }

    match /partnerships/{pid} {
      allow read:   if isSignedIn() && isMember(resource.data);
      allow create, update, delete: if false;           // SÓ Cloud Function

      // days, events, missions, insights — leitura só para membros,
      // escrita SEMPRE via callable (sendEmoji, handshake, jobs)
      match /{sub=**} {
        allow read:  if isMember(get(/databases/$(db)/documents/partnerships/$(pid)).data);
        allow write: if false;
      }
    }

    match /invites/{code} {
      allow read:   if isSignedIn();                    // precisa ler pra aceitar
      allow create: if isSignedIn() && request.resource.data.fromUid == request.auth.uid;
      allow update, delete: if false;
    }
  }
}
```

**Toda escrita de progressão é `if false` no cliente.** O único caminho é a Cloud
Function. Cada regra acima tem um teste de **negação** correspondente na suíte — o teste
que importa não é "o membro consegue ler", é "o não-membro é bloqueado".

---

## 8. Estrutura de pastas

```
parceria/
├── app/                              # rotas — finas, sem lógica de negócio
│   ├── _layout.tsx
│   ├── (auth)/
│   ├── (app)/(tabs)/
│   ├── (app)/partnership/[id]/
│   └── (modals)/
│
├── src/
│   ├── core/
│   │   ├── firebase/
│   │   │   ├── client.ts             # initializeApp + persistência AsyncStorage
│   │   │   ├── useFirestoreDoc.ts    # ponte onSnapshot ↔ React Query
│   │   │   ├── useFirestoreQuery.ts
│   │   │   └── functions.ts          # wrappers tipados dos callables
│   │   ├── ui/                       # DESIGN SYSTEM — sem regra de negócio
│   │   │   ├── theme.ts
│   │   │   ├── GlassCard.tsx
│   │   │   ├── Sheet.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── ProgressRing.tsx
│   │   │   ├── XPBar.tsx
│   │   │   └── ...
│   │   ├── lib/                      # date, distance, format, haptics
│   │   ├── auth/
│   │   └── types/                    # tipos COMPARTILHADOS com functions/
│   │
│   └── features/
│       ├── partnership/{components,hooks,services,types.ts}
│       ├── map/
│       ├── emoji/
│       ├── encounter/
│       ├── mission/
│       ├── super/
│       ├── insight/
│       └── profile/
│
├── functions/                        # projeto TS separado
│   ├── src/
│   │   ├── callable/                 # invite, accept, sendEmoji, handshake
│   │   ├── triggers/                 # onEncounterConfirmed, onProfileUpdate
│   │   ├── scheduled/                # decay, missions, challenges, insights
│   │   └── engine/                   # ⭐ MOTOR — funções puras, 100% testadas
│   │       ├── xparceria.ts
│   │       ├── temperature.ts
│   │       ├── level.ts
│   │       ├── missions.ts
│   │       └── insights.ts
│   └── package.json
│
├── shared/                           # tipos e constantes usados pelos dois lados
│   ├── types.ts
│   └── constants.ts                  # tabela de XP, faixas de temperatura
│
├── docs/
├── firestore.rules
├── firestore.indexes.json
└── app.json
```

### Regras de organização

1. **`app/` não tem lógica.** Uma rota importa uma tela de `features/` e renderiza. Se
   um arquivo em `app/` passa de 30 linhas, tem código no lugar errado.
2. **`core/ui` não conhece o domínio.** Um `GlassCard` não sabe o que é parceria. Se um
   componente de `core/ui` importa algo de `features/`, a dependência está invertida.
3. **`features/` não importa de `features/`.** Se duas features precisam da mesma coisa,
   ela sobe para `core/`. Isso mantém cada feature removível.
4. **`shared/` é a única fronteira com `functions/`.** Tipo de domínio se define uma vez.
   XP calculado com constante diferente nos dois lados é a classe de bug mais cara aqui.
5. **`engine/` é puro.** Sem `firebase-admin`, sem `Date.now()` — o tempo entra por
   parâmetro. É o que torna 100% de cobertura viável e testes determinísticos.
6. **Limite de ~200 linhas por arquivo.** Passou disso, está fazendo coisa demais.

---

## 9. Design System

### Filosofia

**O mapa é o herói; a interface é vidro sobre ele.** Toda a UI flutua translúcida por
cima, nunca compete. Referências: Zenly (energia), Apple Find My (calma), Linear
(precisão), Arc (leveza).

Três regras que evitam o app virar infantil apesar da gamificação pesada:

1. **Cor vem do conteúdo, não do container.** Superfícies são brancas ou vidro; a cor
   entra pelo avatar, pelo emoji, pelo anel de temperatura.
2. **Uma animação por vez.** Cerimônias interrompem tudo; o resto da UI fica quieto.
3. **Emoji é ilustração, não ícone.** Grande, respirando, protagonista. Nenhum ícone
   decorativo compete com ele.

### Cor

```ts
// Neutros — a base de quase tudo
ink:      { 900:'#0A0A0B', 700:'#2E2E33', 500:'#6B6B75', 300:'#A8A8B3', 100:'#E8E8ED' }
paper:    { 0:'#FFFFFF', 50:'#FAFAFC', 100:'#F4F4F7' }

// Marca — usada com parcimônia: CTA principal, nível, marca
brand:    { 600:'#4A3AFF', 500:'#5B4BFF', 400:'#7C6FFF', 100:'#EDEBFF' }

// TEMPERATURA — a paleta semântica mais importante do app
temp: {
  burning:     '#FF4D4D',   // 85–100  🔥
  warm:        '#FF9A3C',   // 60–84   ☀️
  mild:        '#FFD166',   // 35–59   🌤
  cooling:     '#7CC4FF',   // 15–34   🌧
  hibernating: '#B8C4D9',   // 0–14    ❄️
}

// Suporte
success:'#22C55E'   warning:'#F59E0B'   danger:'#EF4444'
```

**A escala de temperatura é a única cor que carrega significado.** Ela aparece no anel do
avatar, na borda do card, no gráfico da timeline — sempre com o mesmo sentido. Quente
não é "bom" e frio não é "ruim": frio é **acionável**, e o tom azul-claro foi escolhido
para ser convidativo, não acusatório. Vermelho de alarme nunca é usado para amizade
esfriando.

Acessibilidade: cor nunca é o único sinal. Toda faixa de temperatura tem emoji e rótulo.

### Tipografia

```ts
fontFamily: 'Inter' (variável),  numérico: 'tabular-nums'
display:  { size: 34, weight: 700, tracking: -0.5 }   // nível na cerimônia
title:    { size: 24, weight: 700, tracking: -0.3 }
headline: { size: 18, weight: 600 }
body:     { size: 16, weight: 400, lineHeight: 24 }
callout:  { size: 15, weight: 500 }
caption:  { size: 13, weight: 500 }
micro:    { size: 11, weight: 600, tracking: 0.4, uppercase: true }
```

`tabular-nums` em todo número é obrigatório: sem isso o contador de XP treme durante a
animação de incremento.

### Espaço, raio, elevação

```ts
space:  [0, 4, 8, 12, 16, 24, 32, 48, 64]     // escala de 4
radius: { sm:8, md:12, lg:20, xl:28, sheet:32, full:9999 }

glass: {
  intensity: 60,                     // expo-blur
  tint: 'light',
  border: 'rgba(255,255,255,0.35)',  // 1px — o brilho que separa do mapa
}
shadow: {                            // sombras difusas e baixas; nunca duras
  sheet: { y: -4, blur: 32, color: 'rgba(10,10,11,0.12)' },
  card:  { y:  2, blur: 12, color: 'rgba(10,10,11,0.06)' },
}
```

### Movimento

```ts
duration: { instant:120, fast:200, base:300, slow:500, ceremony:2400 }
spring:   { gentle:{damping:20,stiffness:180}, bouncy:{damping:12,stiffness:220} }
```

- **Toda transição de estado é mola, não curva.** Reanimated com `withSpring`.
- **Toda ação com consequência tem háptico.** Emoji enviado: `impactLight`. Encontro
  confirmado: `notificationSuccess`. Level up: sequência de três.
- **`reduceMotion` respeitado**: cerimônias viram fade, sem parallax nem partícula.

### Modo escuro

Suportado desde o início, mas o **claro é o padrão** — o Zenly era claro, e mapa branco
com vidro é a identidade visual. No escuro, o vidro passa a `tint: 'dark'` e a paleta de
temperatura ganha saturação (cores frias somem em fundo escuro).

---

## 10. Componentes reutilizáveis

### `core/ui` — genéricos, sem domínio

| Componente | Responsabilidade | Nota |
|---|---|---|
| `GlassCard` | Superfície com blur + borda luminosa | Base de quase toda a UI |
| `Sheet` | Bottom sheet com snap points e gesto | Wrapper de `@gorhom/bottom-sheet` |
| `Button` | `primary` / `glass` / `ghost` / `danger` | Háptico embutido |
| `Avatar` | Foto, fallback de emoji, tamanhos | Puro, sem anel |
| `ProgressRing` | Anel animado com cor e progresso | Reanimated; base do mapa |
| `XPBar` | Barra com incremento animado | `tabular-nums` |
| `EmojiBubble` | Emoji grande com micro-animação | Escala + rotação sutil |
| `Skeleton` | Placeholder com shimmer | Nunca spinner em conteúdo |
| `EmptyState` | Ilustração + texto + ação | Vazio sempre oferece saída |
| `Countdown` | Tempo restante formatado | Desafios e missões |
| `Stat` | Número grande + rótulo | Perfil e timeline |
| `ShareableCard` | Card exportável como imagem | `react-native-view-shot` |

### `features/*` — específicos de domínio

| Componente | Onde | Nota |
|---|---|---|
| `PartnerMarker` | Mapa | Avatar + anel de temperatura + emoji do dia + pulso de atividade |
| `PartnershipSheet` | Mapa | Sheet ao tocar num marcador |
| `PartnershipCard` | Lista | Avatar, nível, temperatura, dias sem encontro |
| `TemperatureRing` | Vários | `ProgressRing` + semântica de temperatura |
| `LevelBadge` | Vários | Moldura muda em 10/25/50 |
| `EmojiPicker` | Modal | **Sugeridos + teclado completo** |
| `DailyEmojiPrompt` | Home | Card do ritual, some quando cumprido |
| `EmojiRevealCard` | Modal | Revelação do emoji do parceiro |
| `EncounterBanner` | Mapa | "Você está com o João agora?" |
| `HandshakeModal` | Modal | Confirmação bilateral |
| `EncounterTimer` | Encontro | Cronômetro ao vivo |
| `TimelineEvent` | Timeline | Renderiza por `type` |
| `TimelineMap` | Timeline | Mapa estático dos lugares |
| `MissionCard` | Parceria | Estados: disponível/ativa/concluída/expirada |
| `ChallengeCard` | Home | Desafio de resgate, visual urgente |
| `InsightCard` | Home | Insight da IA, dispensável |
| `LevelUpCeremony` | Modal | Tela cheia, ~2,4 s |
| `PartnershipBornCeremony` | Modal | O momento mais importante |
| `SuperPartnershipOrb` | Super | Visual orbital dos membros |
| `StreakFlame` | Vários | Chama com intensidade por streak |

### Regras de composição

- **Todo componente de domínio é construído sobre `core/ui`.** `PartnerMarker` = `Avatar`
  + `ProgressRing` + `EmojiBubble`. Zero estilo solto.
- **Componente não busca dado.** Recebe por prop; o hook da feature busca. Isso mantém
  tudo renderizável em Storybook e testável sem Firebase.
- **Cerimônia é sempre `Modal` de tela cheia** com callback `onDone`, nunca inline.
- **Todo estado vazio tem componente próprio.** "Nenhuma parceria ainda" é uma tela
  desenhada, não um texto cinza no meio da tela.

---

## 11. Mecânicas de XParceria

### A decisão fundadora: dois números, não um

O escopo original pedia uma mecânica de **perder** XParceria. Isso está errado por dois
motivos, e corrigi-lo é a decisão de design mais importante do produto.

**Emocionalmente é falso.** Um churrasco de 2019 aconteceu. Nada desfaz aquilo. Um número
que representa a história de uma amizade e que *diminui* está mentindo sobre o passado.

**Comportamentalmente é destrutivo.** Perda gera ansiedade, e ansiedade gera desinstalação
— não engajamento. O Duolingo precisou inventar o *streak freeze* justamente porque
descobriu que punir quebra de sequência afastava exatamente os usuários que queriam
manter.

Mas o impulso por trás do pedido é legítimo: **sem decaimento, não há urgência**, e sem
urgência ninguém sai de casa. A solução é separar os dois papéis que estavam sendo pedidos
de um único número:

| | **XParceria** | **Temperatura** |
|---|---|---|
| Representa | A **história** acumulada | O **estado atual** |
| Direção | Só sobe. Nunca desce. | Sobe e desce |
| Escala | 0 → ∞ | 0 → 100 |
| Gera | Nível, conquistas, molduras | Faixa, desafios, insights |
| Emoção | Orgulho | Urgência |
| Onde aparece | Número e barra | **Anel colorido** do avatar |

O usuário vê: *"Nível 21 — mas a temperatura caiu pra 33."* Orgulho do que construíram
**e** clareza do que está acontecendo agora, sem nunca perder nada.

### Curva de níveis

```ts
xpParaProximoNivel(n) = 100 + 22n
xpTotalParaNivel(n)   = 11n² + 89n - 100
```

| Nível | XP p/ o próximo | XP total acumulado |
|---|---|---|
| 1 → 2 | 122 | 0 |
| 5 → 6 | 210 | 620 |
| 10 → 11 | 320 | 1.890 |
| 18 → 19 | **496** | 5.066 |
| 21 → 22 | 562 | 6.620 |
| 50 → 51 | 1.200 | 31.850 |

O nível 18 exigindo ~500 é intencional: bate com a mockup do escopo original
("420 / 500"), e a barra permanece legível em qualquer nível — nunca vira "12.400 /
48.000", que não significa nada para ninguém.

### Tabela de ganho

**Digital — teto de 15 XParceria por dia, por parceria**

| Ação | XParceria | Limite |
|---|---|---|
| Abrir o app | +3 | 1×/dia |
| Enviar o emoji do dia | +6 | 1×/dia |
| Reciprocidade (os dois no mesmo dia) | +6 | para ambos |

**Encontro — o que realmente move o número**

| Ação | XParceria |
|---|---|
| Encontro confirmado pelos dois | **+60** de base |
| Tempo juntos | **+1 por minuto**, até 240 min |
| Teto por encontro | 300 |
| Teto diário por parceria | 500 |
| Intervalo mínimo entre encontros contados | 6 h |

> Duas horas juntos = 60 + 120 = **+180 XParceria**.

**Eventos**

| Evento | XParceria |
|---|---|
| Nascimento da parceria | +100 |
| Missão concluída | +100 a +400 |
| Desafio de resgate | +500 |
| Marco de streak (7 / 30 / 100 dias) | +50 / +200 / +600 |
| Aniversário da parceria | +365 |
| Encontro em Super Parceria | ×1,5 |

### Por que essa proporção

Um dia inteiro de ritual digital vale **15**. Um encontro de duas horas vale **180**.
A razão é **12×** — e um encontro de fim de semana inteiro chega a 20×.

Consequências desenhadas de propósito:

- **Farmar é inútil.** Abrir o app 40 vezes por dia rende os mesmos 3 pontos.
- **Um par que nunca se encontra estagna visivelmente.** 450 XP/mês contra ~1.250 de um
  par ativo. O número comunica sozinho o que está faltando, sem o app precisar acusar
  ninguém.
- **A Temperatura reforça a mesma mensagem por outro canal:** interação digital sozinha
  **satura em 70** — nunca alcança a faixa 🔥, nunca destrava moldura de nível alto,
  nunca forma Super Parceria (que exige ≥ 75 em todas as arestas). Encontro real é a
  única chave para o topo do produto, e isso está codificado em uma constante, não num
  texto de marketing.

### Anti-fraude

| Vetor | Defesa |
|---|---|
| Auto-confirmar encontro | **Handshake bilateral obrigatório** — sem os dois uids em `confirmedBy`, o evento não existe |
| Handshake repetido | Intervalo mínimo de 6 h entre encontros contados |
| GPS falso | V0 não usa GPS como prova, usa confirmação humana. V1 valida coerência de trajetória |
| Escrever XP direto | Regra de segurança: `allow write: if false` em toda a coleção |
| Emoji com data retroativa | Servidor carimba a data pelo fuso do usuário, o cliente não escolhe |
| Conta falsa para farmar | Sem lucro: farmar não dá nada além de um número que só os dois veem |

O último ponto é o mais importante: **não existe ranking global**, então não existe
incentivo real para fraudar. A melhor defesa contra trapaça é não haver prêmio por
trapacear.

---

## 12. Algoritmo de evolução das parcerias

### Motor de Temperatura

```ts
// functions/src/engine/temperature.ts — função PURA, sem Firebase, sem Date.now()

const DECAY_PER_DAY        = 1.5;
const DECAY_HIBERNATING    = 0.5;   // mais lento no fundo: não vira poço sem saída
const DIGITAL_CEILING      = 70;    // ← a regra que define a tese do produto
const FLOOR = 0, CEILING = 100;

const GAIN = {
  emojiSent:        2,    // digital
  emojiReciprocal:  3,    // digital
  missionCompleted: 8,
  challengeRescued: 25,
  encounterBase:    15,
  encounterPerMin:  0.1,  // teto de +20
} as const;

function applyDecay(temp: number, days: number): number {
  let t = temp;
  for (let d = 0; d < days; d++) {
    t -= t <= 14 ? DECAY_HIBERNATING : DECAY_PER_DAY;
  }
  return Math.max(FLOOR, t);
}

function applyGain(temp: number, gain: number, isDigital: boolean): number {
  // ganho digital nunca ultrapassa o teto — mas nunca REDUZ o que já foi conquistado
  const ceiling = isDigital ? Math.max(DIGITAL_CEILING, temp) : CEILING;
  return Math.min(ceiling, temp + gain);
}
```

O detalhe em `Math.max(DIGITAL_CEILING, temp)`: se a parceria está em 90 graças a
encontros, o emoji diário não a puxa para baixo — ele só não a empurra para cima. Teto,
nunca teto-que-derruba.

### Faixas

| Faixa | Temp | Símbolo | Cor | Comportamento do app |
|---|---|---|---|---|
| Em chamas | 85–100 | 🔥 | `#FF4D4D` | Anel pulsante, moldura especial |
| Aquecida | 60–84 | ☀️ | `#FF9A3C` | Estado saudável, sem intervenção |
| Morna | 35–59 | 🌤 | `#FFD166` | Card discreto: "faz X dias" |
| Esfriando | 15–34 | 🌧 | `#7CC4FF` | **Dispara desafio de resgate** |
| Hibernando | 0–14 | ❄️ | `#B8C4D9` | Sai do mapa, vai para aba própria |

### Trajetória de referência

Partindo de 60 (parceria estabelecida), sem nenhuma interação:

| Dia | Temp | Faixa | O que o app faz |
|---|---|---|---|
| 0 | 60 | ☀️ | nada |
| 12 | 42 | 🌤 | card: "faz 12 dias que vocês não se encontram" |
| 18 | 33 | 🌧 | **desafio de resgate** + botão que abre o WhatsApp |
| 30 | 15 | 🌧/❄️ | último aviso |
| 45 | ~8 | ❄️ | hibernação — XParceria preservado |

Um único encontro de 2 h no dia 18: 33 + 15 + 12 = **60**. Volta inteira para a faixa
saudável. **A recuperação precisa ser rápida** — se resgatar custasse semanas, ninguém
tentaria.

### Motor de níveis

```ts
// functions/src/engine/level.ts
export function applyXP(current: {level: number; xp: number}, amount: number) {
  let { level, xp } = current;
  const total = xp + amount;
  let into = total, leveledTo = level;
  while (into >= xpParaProximoNivel(leveledTo)) {
    into -= xpParaProximoNivel(leveledTo);
    leveledTo++;
  }
  return {
    level: leveledTo,
    xpIntoLevel: into,
    xpForNextLevel: xpParaProximoNivel(leveledTo),
    leveledUp: leveledTo > level,
    levelsGained: leveledTo - level,
  };
}
```

Subir vários níveis de uma vez (após uma viagem, por exemplo) é tratado: a cerimônia
mostra a sequência inteira, não só o último.

### Job diário (`scheduled`, 04:00 America/Sao_Paulo)

```
para cada parceria com status active | hibernating:
  1. dias = diasDesde(updatedAt)
  2. temperature = applyDecay(temperature, dias)
  3. temperatureBand = faixaDe(temperature)
  4. stats.daysSinceLastEncounter = recalcular
  5. se faixa caiu para 'cooling'    → gerar DESAFIO DE RESGATE
  6. se faixa caiu para 'hibernating'→ status = 'hibernating' + notificar com carinho
  7. se streak quebrou e freezesLeft > 0 → consumir freeze, preservar streak
  8. rodar motor de insights (§16)
  9. se hoje é aniversário           → evento + XP + card compartilhável
```

Uma escrita por parceria por dia. Com 50 usuários e ~5 parcerias cada: **~125 escritas
diárias**. Irrelevante. Com 100 mil parcerias, vira escrita em lote particionada — mas
esse é um problema que só existe depois do sucesso.

### Streak e o freeze

Streak = dias consecutivos em que **os dois** enviaram emoji. Unilateral não conta —
streak é da parceria, não do indivíduo.

**Um freeze automático por mês.** Falhou um dia, o freeze entra sozinho e o app avisa
com bom humor no dia seguinte: *"Salvamos sua sequência de 43 dias 🧊"*. Isso converte o
pior momento do app (perder algo) no melhor (ser salvo). O usuário não precisa comprar,
não precisa lembrar, não precisa fazer nada.

---

## 13. Algoritmo de perda (decaimento)

> Reafirmando: **XParceria nunca é perdido.** Só a Temperatura decai. Esta seção existe
> porque o escopo original a pediu, e responde ao problema real por trás dela.

### O que decai, e a que ritmo

| Situação | Efeito diário |
|---|---|
| Nenhuma interação | −1,5 de Temperatura |
| Nenhuma interação, já hibernando | −0,5 (freio, para não morrer de vez) |
| Emoji unilateral | −1,5 + 2 = **+0,5** — segura, mas não aquece |
| Emoji recíproco | −1,5 + 5 = **+3,5** — sobe até o teto de 70 |
| Encontro | +15 a +35, sem teto além de 100 |

Note o desenho: **um lado sozinho quase não sustenta**. Amizade unilateral é
matematicamente representada como tal — e isso é honesto, não cruel, porque o custo cai
sobre a *relação*, não sobre a pessoa que está tentando.

### O que nunca é perdido

Nível, XParceria acumulado, conquistas, timeline, recordes, streak mais longo, primeiro
encontro. Uma parceria hibernando por dois anos volta **exatamente** onde parou. A tela
de hibernação diz isso com todas as letras:

> *"Essa parceria está hibernando. Os 6.620 XParceria de vocês continuam guardados.
> Um encontro traz tudo de volta."*

### Escadinha de intervenção

O app tem quatro chances de agir antes de aceitar a hibernação — cada uma mais forte,
nenhuma culpando ninguém:

1. **Morna (dia ~12)** — card discreto na home. *"Faz 12 dias."* Sem CTA agressivo.
2. **Esfriando (dia ~18)** — desafio de resgate com prazo e recompensa alta (+500), com
   **botão que abre o WhatsApp com mensagem pronta**. **Os dois recebem o mesmo desafio**
   — ninguém precisa ser o chato que cobrou.
3. **Últimos dias (dia ~30)** — o app lembra de um momento específico da timeline:
   *"No dia 14 de março vocês ficaram 5 horas juntos."* Memória concreta é o gatilho mais
   forte que existe; genérico não funciona.
4. **Hibernação (dia ~45)** — sai do mapa sem drama, com a promessa explícita de
   preservação. **Sem notificação de culpa. Nunca.**

### As regras de tom — inegociáveis

- Nunca "você abandonou o João".
- Nunca notificação que só existe para provocar culpa.
- Nunca comparar parcerias entre si.
- Nunca insinuar que a outra pessoa deixou de se importar.
- Sempre linguagem sobre **a parceria**, nunca sobre a **pessoa**: *"a parceria esfriou"*,
  jamais *"o João sumiu"*.

Esta é a regra que impede o produto de virar uma máquina de mal-estar — o destino natural
de todo app que gamifica relacionamento sem cuidado.

---

## 14. Sistema de missões

### Como funcionam

Missões são geradas pelo servidor, têm prazo, e **a maioria só é completável saindo de
casa**. No máximo **duas ativas** por parceria — mais que isso vira lista de tarefas, e
lista de tarefas é a morte de qualquer app afetivo.

```ts
interface Mission {
  id: string;
  templateId: string;
  title: string;                 // "Tomem um café juntos"
  description: string;
  emoji: string;
  xpReward: number;
  status: 'available' | 'active' | 'completed' | 'expired';
  expiresAt: Timestamp;
  requirement: {
    type: 'encounter' | 'encounter_duration' | 'encounter_place'
        | 'encounter_time' | 'ritual_streak' | 'distance';
    minMinutes?: number;
    placeCategory?: string;      // 'cafe' | 'gym' | 'movie_theater' | ...
    newPlaceOnly?: boolean;
    timeWindow?: [number, number];
    minDistanceKm?: number;
    days?: number;
  };
  progress: { current: number; target: number };
  completedAt: Timestamp | null;
}
```

### Catálogo inicial

| Missão | Requisito | XP | Prazo |
|---|---|---|---|
| ☕ Tomem um café | encontro ≥ 20 min em local `cafe` | 150 | 7 d |
| 🍽 Almocem juntos | encontro ≥ 40 min entre 11h–15h | 180 | 7 d |
| ⏱ Duas horas | encontro ≥ 120 min | 250 | 14 d |
| 🗺 Lugar novo | encontro em local nunca visitado pela dupla | 300 | 14 d |
| 🎬 Vão ao cinema | encontro ≥ 90 min em `movie_theater` | 280 | 21 d |
| 🏋️ Treinem juntos | encontro ≥ 45 min em `gym` | 250 | 14 d |
| 📚 Estudem juntos | encontro ≥ 90 min em `library`/`university` | 220 | 14 d |
| 🌙 Madrugada | encontro iniciado após 23h | 200 | 30 d |
| ✈️ Viagem | encontro a > 100 km da base dos dois | 800 | 90 d |
| 🔁 Semana cheia | 7 dias seguidos de emoji recíproco | 200 | 14 d |
| 🎂 Aniversário | encontro no dia do aniversário do parceiro | 500 | fixo |

### Regras de geração

O job diário sorteia entre os templates **elegíveis**, ponderado por contexto:

```
elegível se:
  - a dupla não completou esse template nos últimos 30 dias
  - a parceria tem nível ≥ nível mínimo do template
  - existe local da categoria a < 5 km de pelo menos um dos dois (Google Places)
  - a temperatura está na faixa alvo do template

peso:
  - +3 se a missão bate com um padrão histórico da dupla (sempre vão ao cinema)
  - +2 se a temperatura está caindo (missões de encontro ganham prioridade)
  - −5 se a dupla ignorou esse template duas vezes seguidas
```

O último peso importa: o app **aprende o que aquela dupla não quer**. Sem isso, ele
oferece academia indefinidamente para quem nunca vai à academia — e cada missão ignorada
ensina o usuário a ignorar a próxima.

### Verificação

Missão nunca é marcada como concluída pelo usuário. O trigger `onEncounterConfirmed`
avalia todas as missões ativas contra o encontro que acabou de ser registrado. Como
encontro exige handshake bilateral, missão herda a mesma resistência a fraude sem
código adicional.

O local vem do Google Places por proximidade do ponto do encontro; sem correspondência
confiável, missões de categoria simplesmente não completam — melhor não completar do que
completar errado.

### Desafios ≠ Missões

| | Missão | Desafio |
|---|---|---|
| Origem | Rotina, sorteio ponderado | **Temperatura caindo** |
| Frequência | Contínua, até 2 ativas | Raro, um de cada vez |
| Recompensa | 150–800 | **500 + reset de temperatura** |
| Tom | Convite leve | Urgente, mas gentil |
| Visual | Card comum | Card destacado com contagem regressiva |
| Quem vê | Os dois | **Os dois, ao mesmo tempo** |

O desafio ser visível para ambos simultaneamente é o que remove o constrangimento: não é
o Gabriel cobrando o João, é o app dizendo a mesma coisa para os dois.

---

## 15. Sistema de Super Parcerias

### Nascimento

Uma Super Parceria **não é criada, ela é descoberta**. O usuário não cria grupo — o job
semanal encontra triângulos fechados no grafo:

```
para cada trio (A,B,C) onde existem as 3 parcerias:
  se TODAS as arestas têm:
       status  == 'active'
       level   >= 8
       temperature >= 75          ← inalcançável sem encontros reais (teto digital = 70)
  e o trio ainda não pertence a uma Super Parceria
  então → NASCE
```

O limiar de 75 é o que torna a Super Parceria a maior prova social do app: **impossível
de conseguir sem se encontrar de verdade**. Não é uma regra arbitrária — é a tese do
produto expressa como constante.

Descoberta em vez de criação é o que dá o impacto emocional. Uma tela que aparece do nada
dizendo *"vocês três viraram uma Super Parceria"* vale dez vezes mais que um botão
"criar grupo" — e é infinitamente mais compartilhável.

### Crescimento

Um quarto membro entra se tiver todas as arestas com os membros existentes acima do
limiar. **Teto de 8** — acima disso vira grupo de WhatsApp, e grupo grande dilui o que
torna o vínculo especial.

### Benefícios

| Benefício | Detalhe |
|---|---|
| **×1,5 XParceria** | Em encontros com 3+ membros confirmando em janela de 30 min |
| Missões de grupo | Exigem presença simultânea; 500–1.500 XP |
| Identidade | Nome e emoji editáveis pelo grupo — "Os Fominhas 🔥" |
| Órbita no mapa | Membros próximos se agrupam num visual orbital |
| Conquistas exclusivas | "Os Sete Dias", "Turnê" (3 cidades), "Um Ano" |
| Retrospectiva de grupo | Peça compartilhável e o motor viral mais forte do app |
| **Jogo diário** | Uma pergunta por dia, a mesma para o app inteiro, votada dentro do grupo |

### O ranking — e o que ele deliberadamente não é

O escopo original pedia ranking. **Ranking entre amizades é tóxico**: ordenar amigos do
melhor para o pior machuca gente de verdade, e nenhuma retenção compensa isso.

O que existe:
- **Ranking do grupo contra si mesmo no tempo** — "este mês vocês se encontraram 7 vezes,
  recorde anterior 5".
- **Metas coletivas** — "faltam 2 encontros para o recorde do grupo".

O que **nunca** existe:
- Lista ordenada dos membros por XParceria.
- "Melhor parceiro do grupo".
- Comparação entre Super Parcerias diferentes.

Competição é sempre **do grupo contra o próprio passado**, jamais de um membro contra
outro.

### Jogo diário — e por que ele não fere a regra acima

Todo dia o app faz uma pergunta ao grupo — *"quem é mais provável de ter um pirrai?"* — e
cada membro vota em um membro, inclusive em si mesmo. Quando todos votam, a contagem é
revelada.

Isso aponta uma pessoa, o que à primeira vista colide com o parágrafo anterior. A
distinção que faz o jogo caber: o ranking proibido ordena os membros **por qualidade da
amizade**; o jogo aponta alguém **por uma previsão engraçada sobre a vida dele**. O
catálogo é curado sob quatro regras que existem para manter essa fronteira, e o autovoto
é permitido de propósito — assumir a piada antes que apontem para você é o que faz zoeira
consentida funcionar.

O jogo alimenta só o `xparceria` do grupo, com teto de 15/dia, e **não segura a
dormência**: grupo que joga todo dia e não se encontra continua esfriando.

**Design completo:** `docs/2026-08-27-jogo-diario-design.md`.

### Dormência

Se qualquer aresta cai abaixo de 50, a Super Parceria fica `dormant` — perde o bônus,
mantém identidade e história, e o app avisa o grupo inteiro (sem apontar quem). Todas as
arestas voltando a 75 a reativa com nova cerimônia.

---

## 16. Sistema de IA

### O que é IA de verdade, e o que não é

Boa parte do que o escopo pediu como IA é `if`:

> *"Há 18 dias vocês não se encontram"* — isso é subtração de datas.

Chamar isso de IA infla expectativa e, pior, leva a jogar um LLM em problema que
estatística resolve melhor, mais barato e sem alucinar. O V0 tem um **motor de insights
determinístico**; o LLM entra no V1, onde traz valor que regra nenhuma traz.

### Camada 1 — Motor determinístico (V0)

```ts
// functions/src/engine/insights.ts — puro, testável, previsível
interface Insight {
  id: string;
  type: 'pattern' | 'gap' | 'prediction' | 'milestone' | 'suggestion';
  text: string;
  confidence: number;
  actionable: boolean;
  cta?: { label: string; action: 'open_whatsapp' | 'start_mission' | 'send_emoji' };
  expiresAt: Timestamp;
}
```

| Detector | Regra | Saída |
|---|---|---|
| **Dia da semana** | ≥ 5 encontros e ≥ 60% no mesmo dia | "Vocês costumam sair toda sexta." |
| **Gap anômalo** | gap atual > 2× a média histórica (n ≥ 4) | "Faz 18 dias — o normal de vocês é 7." |
| **Previsão** | projeção linear da temperatura cruza 15 | "Nesse ritmo, em 9 dias entra em hibernação." |
| **Horário** | moda da hora de início dos encontros | "Vocês quase sempre se encontram à noite." |
| **Sazonalidade** | encontros por mês vs. média (n ≥ 12) | "Vocês se veem mais em julho." |
| **Recorde iminente** | a 1 encontro do recorde mensal | "Faltam 1 para o recorde de vocês." |
| **Reciprocidade** | um lado envia emoji 3× mais que o outro | *(interno — nunca exposto)* |
| **Proximidade** *(V1)* | parceiro a < 1 km, ambos parados > 15 min | "O João está a 400 m. Chama ele?" |

O detector de reciprocidade nunca vira texto para o usuário. Dizer *"você manda mais
emoji que o João"* é criar mágoa a partir de um dado. Ele só pondera a geração de missões.

**Máximo de um insight visível por parceria por vez.** Insight que aparece demais vira
ruído e treina o usuário a ignorar.

### Camada 2 — LLM (V1+)

Claude via Cloud Function, para o que regra não faz:

| Uso | Frequência | Entrada |
|---|---|---|
| **Retrospectiva narrada** | 1×/ano por parceria | estatísticas agregadas do ano |
| **Missão personalizada** | 1×/semana por parceria | padrões, categorias, histórico de recusa |
| **Título de encontro** | por encontro longo | duração, categoria do local, horário |
| **Resumo do mês** | 1×/mês | eventos do período |

**Guardrails, sem exceção:**

1. O LLM recebe **apenas estatísticas agregadas**. Nunca coordenada precisa, nunca nome
   real, nunca foto. `{ encontros: 23, gapMedio: 6, categoriaTop: "cafe", meses: [...] }`
   — e nada mais.
2. O LLM **nunca calcula número**. Todos os valores chegam prontos; ele só escreve o
   texto ao redor. Isso elimina a classe inteira de alucinação numérica.
3. **Saída estruturada e validada** (Zod) antes de escrever no Firestore.
4. **Orçamento fixo**: no máximo 1 chamada por parceria por semana. Com 500 parcerias e
   Haiku, isso fica na casa de centavos por mês.
5. **Falha silenciosa**: erro ou timeout do LLM cai no insight determinístico. A IA nunca
   é caminho crítico de nenhuma tela.

### Por que a IA é o fosso de longo prazo

Um clone copia o mapa e a barra de XP em duas semanas. O que não se copia é o **histórico
de comportamento de milhares de amizades reais** — que padrão precede um esfriamento,
que missão é aceita por qual tipo de dupla, qual horário de notificação converte em
encontro. Esse dado só se acumula com o tempo e é o que, no futuro, permite ao Parcerio
prever esfriamento antes de ele acontecer.

E é aí que o nome deixa de ser trocadilho: **a IA não gerencia a amizade, ela avisa a
tempo.**

---

## 17. Estratégia de monetização

### No MVP: nenhuma. Zero.

Cobrar de 30 amigos em teste destrói o teste — o feedback vira sobre preço em vez de ser
sobre a mecânica. Esta seção é **tese**, não backlog.

### Princípio inegociável

> **Nada que se compre pode alterar a verdade de uma parceria.**

Sem comprar XParceria. Sem comprar nível. Sem acelerar progresso. Sem ver quem "te viu".
No instante em que o nível puder ser comprado, ele para de significar amizade e passa a
significar dinheiro — e o produto inteiro perde o sentido.

Isso descarta boa parte das monetizações fáceis de app social. É um custo aceito
conscientemente.

### Parcerio+ — R$ 12,90/mês ou R$ 89/ano

| Benefício | Categoria |
|---|---|
| Molduras, anéis e temas de mapa exclusivos | Cosmético |
| Retrospectiva estendida + exportação em vídeo | Conteúdo |
| Histórico ilimitado (grátis retém 12 meses) | Utilidade |
| 3 streak freezes extras por mês | Conveniência |
| Insights avançados e previsões | Utilidade |
| Widget customizável | Cosmético |
| Estatísticas detalhadas por parceria | Utilidade |

**Assinatura é individual, mas os cosméticos são visíveis para o parceiro.** Se o Gabriel
assina, a moldura aparece na parceria dos dois — o João vê e quer. É o loop de conversão
do Discord Nitro, e funciona porque o benefício é compartilhado, não acumulado.

### Plano de Super Parceria — R$ 34,90/mês para até 8

Um membro paga, o grupo inteiro recebe. Ticket maior, churn menor (cancelar prejudica os
amigos), e viralização embutida na estrutura de preço.

### O que nunca será vendido

- Localização, histórico de deslocamento ou qualquer dado pessoal — **em nenhuma hipótese**
- Anúncio dentro do mapa
- Acesso a alguém que não aceitou parceria
- Nível, XParceria ou qualquer forma de progresso

### Missões patrocinadas — a tentação a resistir por ora

Um cinema pagar por *"vão ao cinema esta semana, +400 XParceria"* é a monetização mais
natural que existe aqui: o app já sugere lugares, e o patrocínio manda gente para o
mundo real — alinhado com a métrica-norte, ao contrário de anúncio.

Mas exige escala, rotulagem clara de publicidade e um limite rígido (nunca mais que 1 em
5 missões). **Não antes da versão 2.0.** Introduzir cedo demais ensina o usuário a
desconfiar das sugestões, e a confiança nas sugestões é o ativo central do produto.

### Ordem de grandeza

Conversão realista de 3–5% num app social de nicho. 100 mil MAU → ~4 mil assinantes →
~R$ 45 mil/mês bruto. Não é unicórnio, é negócio sustentável para time pequeno. E é a
métrica correta para calibrar ambição.

---

## 18. Roadmap — do MVP à 1.0

### V0 · "A parceria existe" — semanas 1 a 3 (Expo Go)

| Semana | Entrega |
|---|---|
| 1 | Auth, perfil, convite por link, nascimento da parceria, design system, security rules com suíte de negação |
| 2 | Mapa com marcadores, presença com throttle, bottom sheet, emoji diário (sugeridos + teclado), ritual por notificação local |
| 3 | Motor de XParceria/Temperatura/Nível, handshake de encontro, timeline, cerimônias, telas de perfil |

**Critério de saída:** duas pessoas conseguem virar parceiras, cumprir o ritual por 7 dias
e registrar um encontro real — sem que nada quebre.

### V0.5 · "A parceria pede algo" — semana 4

Missões, desafios de resgate, motor de insights determinístico, conquistas, streak com
freeze automático.

### 🔬 Teste de campo — semanas 5 a 8

10 a 50 amigos, 30 dias. Instrumentação obrigatória antes do primeiro convidado entrar:
funil de onboarding, ritual cumprido/dia, encontros confirmados, missões
aceitas/ignoradas, desafios resolvidos, D1/D7/D30, desinstalação.

Ao final, **survey de uma pergunta**: *"O Parcerio fez você encontrar seus amigos mais
vezes? (sim / não / não sei)"*. Abaixo de 40% de "sim", a mecânica é revista antes de
qualquer código novo — não se constrói V1 sobre hipótese não validada.

### V1 · "A parceria vive sozinha" — semanas 9 a 14 (dev build)

Background location, detecção automática de encontro (handshake vira só confirmação),
push remota, geofencing de lugares recorrentes, Super Parcerias, Google Maps no iOS,
modo fantasma, widget.

Aqui entram os US$ 99 da Apple + US$ 25 do Google — mas só depois da validação. Pagar
antes é apostar; pagar depois é investir.

### V1.5 · "A parceria conta a história" — semanas 15 a 20

LLM (Claude) para retrospectiva narrada e missão personalizada, fotos na timeline,
retrospectiva anual compartilhável, cards de compartilhamento, cápsula do tempo.

### V1.0 público · semanas 21 a 26

App Store e Play Store, LGPD e política de privacidade, exclusão de conta e exportação de
dados, Parcerio+, onboarding refinado, i18n (pt-BR + en), suporte, observabilidade
(Crashlytics + Sentry).

### O que fica de fora, e por quê

| Cortado | Motivo |
|---|---|
| Chat | O WhatsApp já venceu. Empurramos para lá; competir seria suicídio |
| Feed | Transformaria relação em audiência — contra a tese |
| Stories | Mesmo motivo |
| Descoberta de pessoas | Anti-produto: todo vínculo nasce de convite direto |
| Ranking global | Tóxico e sem função |
| Web app | O produto é presença física; navegador não tem GPS confiável |
| Modo família | Mercado e tom diferentes — outro produto, não um modo |

---

## 19. Telas detalhadas

### Autenticação e onboarding

| # | Tela | Elementos | Nota |
|---|---|---|---|
| 1 | **Welcome** | Manifesto animado, "Toda amizade tem uma história" | Sem carrossel de features |
| 2 | **Sign In** | Google / Apple / telefone | Sem senha |
| 3 | **Perfil** | Foto, nome, apelido, emoji de avatar | 3 campos, nada mais |
| 4 | **Primeiro convite** | "Quem é o seu parceiro?" + gerar link | **Não pede a agenda** |
| 5 | **Espera** | Preview animado de uma parceria nível 12 | Espera com conteúdo, não spinner |
| 6 | **Aceite do convite** | "O Gabriel quer construir uma parceria" | Deep link |
| 7 | **Cerimônia de nascimento** | Tela cheia, ~4 s, nomes + nível 1 | Nos dois aparelhos |
| 8 | **Permissão de localização** | Explicação + botão | Só **depois** da parceria |

### Principais

| # | Tela | Elementos | Nota |
|---|---|---|---|
| 9 | **Mapa** (raiz) | Marcadores, chip de temperatura, banner de encontro, card de insight, botão de recentrar | O herói |
| 10 | **Sheet da parceria** | Avatar, nível, barra de XParceria, temperatura, distância, dias sem encontro, 3 ações | Ao tocar num marcador |
| 11 | **Parcerias** | Lista ordenada por temperatura; seção de hibernando recolhida | Busca acima de 10 |
| 12 | **Perfil** | Nível geral, nº de parceiros, maior parceria, horas com amigos, dias de uso, badges | Vitrine emocional |

### Parceria (profundidade 2)

| # | Tela | Elementos |
|---|---|---|
| 13 | **Visão geral** | Cabeçalho com os dois avatares, nível, XParceria, temperatura, emoji do dia dos dois lados, missões ativas, últimos eventos |
| 14 | **Timeline** | Lista cronológica por tipo, agrupada por mês, com mapa estático dos lugares |
| 15 | **Missões** | Ativas, disponíveis, concluídas |
| 16 | **Conquistas** | Grade com bloqueadas em silhueta |
| 17 | **Estatísticas** | Recordes, gráfico de temperatura, mapa de calor de encontros por dia da semana |

### Modais e cerimônias

| # | Tela | Nota |
|---|---|---|
| 18 | **Seletor de emoji** | Sugeridos curados em destaque + teclado completo |
| 19 | **Revelação do emoji** | Emoji do parceiro com animação |
| 20 | **Handshake de encontro** | Confirmação bilateral com estado de espera |
| 21 | **Encontro em andamento** | Cronômetro ao vivo, XP projetado, encerrar |
| 22 | **Level up** | Cerimônia de ~2,4 s; encadeia se subiu vários |
| 23 | **Nascimento de Super Parceria** | Órbita dos membros, nome editável |
| 24 | **Card de compartilhamento** | Exporta imagem para story |

### Super Parceria e ajustes

| # | Tela | Nota |
|---|---|---|
| 25 | **Super Parceria** | Órbita, nome, nível do grupo, missões coletivas, metas contra o próprio recorde |
| 26 | **Ajustes** | Conta, privacidade, notificações, sobre |
| 27 | **Privacidade** | Desligar localização global, por parceria, modo fantasma, exportar/apagar dados |
| 28 | **Notificações** | Horário do ritual, tipos ativos |

**28 telas no total; 20 no V0** (tudo menos missões, conquistas, estatísticas, Super
Parceria e os modais de compartilhamento). Cada uma tem estado vazio, de carregamento
(skeleton, nunca spinner) e de erro desenhados.

---

## 20. Melhorias e ideias adicionais

Ideias que não estavam no escopo original e que, na minha avaliação, elevam o Parcerio de
"app legal" para produto de nível mundial. Ordenadas por relação impacto/esforço.

### 🔥 1. Sinal de Fumaça — a funcionalidade que falta

**Um botão. "Tô livre hoje."** Fica visível por 4 horas apenas para os parceiros ativos.
Sem explicação, sem compromisso, sem exposição.

Isso resolve o **problema real** que o app se propõe a atacar e que nenhuma outra
mecânica resolve: ninguém chama ninguém porque chamar parece carência. O Sinal de Fumaça
declara disponibilidade sem declarar necessidade — e transforma o app de observador
passivo em **causador de encontro**.

Se eu pudesse acrescentar uma única coisa ao produto, seria esta. Barata de construir,
e é a mecânica com maior chance de mover a métrica-norte diretamente.

### 🔥 2. Retrospectiva da Parceria

Não a retrospectiva do usuário (que todo app faz), mas **de vocês dois**. Encontros do
ano, o lugar de vocês, o recorde, a evolução da temperatura, os emojis mais usados —
narrada e exportável como carrossel.

O detalhe que a torna viral: **os dois recebem a mesma peça, ao mesmo tempo**. Não é
autopromoção, é homenagem a outra pessoa — e conteúdo sobre outra pessoa se compartilha
sem constrangimento, ao contrário de "meu Spotify Wrapped". É o motor de aquisição mais
forte do produto.

### 🔥 3. Widget de tela inicial

"14 dias desde o último encontro com o João." Fora do app, na cara do usuário todo dia.
Retenção sem notificação — e notificação é o recurso mais escasso e mais fácil de
queimar que um app tem.

### 4. Cápsula do tempo

Ao subir de nível marcante, cada um grava uma mensagem (texto ou áudio) que só abre no
**aniversário da parceria**. Cria antecipação de longo prazo — algo que praticamente
nenhum app tem, e o antídoto perfeito contra a novidade se esgotando em 3 semanas.

### 5. Presença sem mapa

Para quem não quer compartilhar localização: um estado grosso — 🏠 em casa, 💼 trabalho,
🌎 na rua, ✈️ viajando. Deriva de lugares recorrentes, sem revelar coordenada.

Abre o produto para o público que rejeita rastreamento por princípio — e são muitos.
A parceria continua funcionando inteira; só o mapa fica menos preciso.

### 6. Modo fantasma temporário

Invisível por 1h, 8h ou 24h, **com prazo obrigatório**. Nunca permanente. Sumiço
permanente destrói a confiança do outro lado; sumiço com prazo é privacidade legítima.
O parceiro vê "modo fantasma até 22h" — honesto, sem mistério.

### 7. Primeira Foto

Uma única foto por encontro, opcional, que vive na timeline. **Não é feed, não tem
curtida, não tem comentário.** É álbum privado de duas pessoas. Toda a emoção da foto,
zero da dinâmica de rede social.

### 8. Encontro reconhecido pelo lugar

Quando a dupla se encontra 3× no mesmo lugar, ele vira **"o lugar de vocês"** — nome
editável, aparece na timeline e na retrospectiva. Memória construída pelo comportamento,
não digitada pelo usuário.

### 9. Anti-vício explícito

O Parcerio deve ser o app que **comemora quando você o fecha**. Depois de registrar um
encontro: *"Guarda o celular e aproveita. A gente conta o tempo."* Nenhum feed infinito,
nenhuma tela projetada para prender.

Isso não é só ética — é posicionamento. Num mercado onde todo app briga por tempo de
tela, ser o app que devolve tempo é diferenciação real, defensável e comunicável.

### 10. Convite com contexto

O link do convite carrega uma prévia rica: *"Gabriel quer construir uma parceria com
você"*, com foto e o preview do que vai nascer. A conversão do convite é a métrica mais
importante do funil — é o gargalo de qualquer produto de rede.

### 11. Nível como prova social

Card exportável para story: **"Gabriel & João — Parceria Nível 21"**. Exibir amizade é
socialmente aceito de um jeito que exibir conquista pessoal não é. Feito certo, é
aquisição orgânica gratuita.

### 12. Modo Reencontro

Detecta que um parceiro voltou de viagem longa ou saiu de hibernação e cria um momento
próprio: *"O João voltou. Faz 47 dias."* + desafio especial. O retorno merece cerimônia.

---

## Riscos abertos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Grupo de teste não tem massa crítica | **Alta** | Onboarding exige convite; recrutar por grupo, nunca indivíduo |
| Novidade se esgota em 3 semanas | Alta | Missões, cápsula do tempo e retrospectiva geram conteúdo novo |
| Sem push remota no V0, retenção sofre | Média | Notificação local cobre o ritual; medir o impacto no teste |
| Handshake bilateral vira atrito | Média | Medir taxa de confirmação; se < 60%, revisar para confirmação passiva |
| Emoji livre usado com hostilidade | Média | Monitorar no teste; opção de silenciar emoji de uma parceria |
| Custo do Firestore escalar | Baixa (agora) | Throttle já desenhado; revisar em 10 mil usuários |
| Apple recusar "Always Location" no V1 | Média | Justificativa e tela de contexto prontas antes do submit |

---

## Decomposição em specs de implementação

Este documento é grande demais para virar um único plano. A implementação se divide em
**6 specs independentes**, cada uma com seu ciclo spec → plano → implementação:

| # | Spec | Escopo | Depende de |
|---|---|---|---|
| 1 | **Fundação** | Setup Expo, design system, Firebase, auth, perfil, security rules + suíte de negação | — |
| 2 | **Parceria** | Convite, deep link, aceite, ciclo de vida, cerimônia de nascimento, Cloud Functions base | 1 |
| 3 | **Mapa e presença** | Mapa, marcadores, presença com throttle, bottom sheet, permissões | 2 |
| 4 | **Progressão** | Motor puro (XParceria, Temperatura, Nível), emoji diário, handshake, timeline, cerimônias, job diário | 2 |
| 5 | **Missões e insights** | Catálogo, geração ponderada, verificação, desafios de resgate, motor determinístico, conquistas | 4 |
| 6 | **Super Parceria e LLM** | Detecção de triângulos, bônus de grupo, jogo diário, retrospectiva, integração com Claude | 4, 5 |

**Ordem de execução:** 1 → 2 → 3 ∥ 4 → 5 → *(teste de campo)* → 6.

As specs 3 e 4 são paralelizáveis: mapa e progressão só se tocam no bottom sheet, e a
interface entre eles é um tipo em `shared/types.ts`.

A **spec 4 é a mais crítica** — é o coração do produto, e todo o motor é função pura
testada antes de existir infraestrutura. Bug em cálculo de XParceria destrói a confiança
no número, e o número é o produto.

---

*Documento de primeira entrega — Parcerio. Próximo passo: plano de implementação da
Spec 1 (Fundação).*

