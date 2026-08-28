---
date: "2026-08-28"
type: project
tags:
  - project
  - parcerio
  - react-native
  - expo
  - firebase
  - typescript
  - active
status: active
---

# Jogo Diário — Plano de Implementação (Fase A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o motor puro e as security rules do jogo diário — tudo que pode ser
construído e provado hoje, sem depender da coleção `superPartnerships` existir.

**Architecture:** Duas camadas, nenhuma delas com tela. Primeiro, funções puras em
`shared/` que derivam a pergunta do dia, o estado da rodada e o XP a partir de números —
testáveis sem Firebase. Depois, as regras do Firestore, que são o servidor deste produto:
cada valor em que o cliente não pode ser confiado vira literal fixado na regra, e cada
guarda ganha um teste que a vê negando. As regras são exercitadas contra o emulador com
fixtures semeadas por `withSecurityRulesDisabled`, então **não precisam que exista código
que crie Super Parceria**.

**Tech Stack:** TypeScript estrito, Jest 29 (`jest-expo` para o app, config separada em
Node para as regras), `@firebase/rules-unit-testing`, emulador do Firestore, Java 21.

**Spec:** `docs/2026-08-27-jogo-diario-design.md`

## Global Constraints

- Fuso do produto: **America/Sao_Paulo**, offset fixo `-03:00` (sem horário de verão no
  Brasil desde 2019). Em milissegundos: `10800000`.
- `GAME_CATALOG_SIZE` em `shared/dailyGame.ts` e `gameCatalogSize()` em `firestore.rules`
  **têm que bater**. São duplicados de propósito, no mesmo espírito de `INITIAL_STATS` em
  `tests/rules/helpers.ts`: se alguém mudar um sem o outro, um teste quebra — e isso é o
  comportamento desejado.
- XP da rodada: **6** parcial, **15** completa. Do grupo, nunca do votante.
- Não usar Cloud Functions. Não introduzir dependência nova.
- Conteúdo (nome de teste, comentário) em português; identificador em inglês.
- Cada task termina com `npm run validate` verde antes do commit.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `shared/dailyGame.ts` | **Criar.** Constantes do jogo e as funções puras de dia, índice da pergunta, estado da rodada, XP e apuração |
| `shared/__tests__/dailyGame.test.ts` | **Criar.** Testes das funções puras |
| `firestore.rules` | **Modificar.** Bloco novo do jogo diário, antes do `match /{document=**}` final |
| `tests/rules/factories.ts` | **Modificar.** Fábricas e seeds de Super Parceria, rodada e voto |
| `tests/rules/game-catalog.test.ts` | **Criar.** Negação de `gameQuestions` e `questionSuggestions` |
| `tests/rules/game-round.test.ts` | **Criar.** Negação do documento da rodada |
| `tests/rules/game-votes.test.ts` | **Criar.** Negação da escrita e da leitura de voto |

Três arquivos de teste de regras em vez de um: `tests/rules/` já separa por coleção
(`users`, `handles`, `invites`, `locked`), e a suíte de voto sozinha passa de trinta
casos.

---

## Task 1: Funções puras de dia e pergunta

**Files:**
- Create: `shared/dailyGame.ts`
- Test: `shared/__tests__/dailyGame.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `SP_UTC_OFFSET_MS: number`, `MS_PER_DAY: number`, `GAME_CATALOG_SIZE: number`,
  `dayNumber(nowMs: number): number`, `questionIndexFor(day: number, catalogSize?: number): number`,
  `gameDateId(nowMs: number): string`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `shared/__tests__/dailyGame.test.ts`:

```ts
import {
  dayNumber,
  gameDateId,
  questionIndexFor,
  GAME_CATALOG_SIZE,
} from '../dailyGame';

// 2026-08-28T02:59:59Z é 27/08 23:59:59 em São Paulo — ainda o dia 27.
const ANTES_DA_VIRADA = Date.UTC(2026, 7, 28, 2, 59, 59);
// 2026-08-28T03:00:00Z é 28/08 00:00:00 em São Paulo.
const NA_VIRADA = Date.UTC(2026, 7, 28, 3, 0, 0);

describe('dayNumber', () => {
  it('vira na meia-noite de São Paulo, não na de UTC', () => {
    expect(dayNumber(NA_VIRADA)).toBe(dayNumber(ANTES_DA_VIRADA) + 1);
  });

  it('não vira na meia-noite UTC', () => {
    // 00:00Z do dia 28 ainda é 21h do dia 27 em São Paulo.
    const meiaNoiteUtc = Date.UTC(2026, 7, 28, 0, 0, 0);
    expect(dayNumber(meiaNoiteUtc)).toBe(dayNumber(ANTES_DA_VIRADA));
  });

  it('avança de um em um a cada 24h', () => {
    expect(dayNumber(NA_VIRADA + 86_400_000)).toBe(dayNumber(NA_VIRADA) + 1);
  });
});

describe('questionIndexFor', () => {
  it('fica dentro do catálogo', () => {
    for (const dia of [0, 1, 119, 120, 121, 5000]) {
      const i = questionIndexFor(dia, 120);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(120);
    }
  });

  it('cicla no tamanho do catálogo', () => {
    expect(questionIndexFor(120, 120)).toBe(questionIndexFor(0, 120));
  });

  it('dias consecutivos dão perguntas diferentes', () => {
    expect(questionIndexFor(41, 120)).not.toBe(questionIndexFor(42, 120));
  });

  it('usa GAME_CATALOG_SIZE quando o tamanho não é passado', () => {
    expect(questionIndexFor(7)).toBe(questionIndexFor(7, GAME_CATALOG_SIZE));
  });
});

describe('gameDateId', () => {
  it('usa a data de São Paulo, não a de UTC', () => {
    expect(gameDateId(ANTES_DA_VIRADA)).toBe('2026-08-27');
    expect(gameDateId(NA_VIRADA)).toBe('2026-08-28');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest shared/__tests__/dailyGame.test.ts`
Expected: FAIL — `Cannot find module '../dailyGame'`.

- [ ] **Step 3: Implementar o mínimo**

Crie `shared/dailyGame.ts`:

```ts
/**
 * O produto inteiro vive em America/Sao_Paulo, que não tem horário de verão
 * desde 2019 — por isso o offset é constante e não precisa de biblioteca.
 * Este mesmo número aparece literal em firestore.rules; se um mudar, o outro
 * tem que mudar junto.
 */
export const SP_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Precisa bater com gameCatalogSize() em firestore.rules. */
export const GAME_CATALOG_SIZE = 120;

/** Dias inteiros desde a época, contados a partir da meia-noite de São Paulo. */
export function dayNumber(nowMs: number): number {
  return Math.floor((nowMs - SP_UTC_OFFSET_MS) / MS_PER_DAY);
}

/**
 * O módulo é escrito duas vezes porque `%` em JS devolve negativo para
 * entrada negativa, e datas antes da época existem em teste.
 */
export function questionIndexFor(day: number, catalogSize = GAME_CATALOG_SIZE): number {
  return ((day % catalogSize) + catalogSize) % catalogSize;
}

/** Id do documento da rodada: legível por humano e ordenável por range. */
export function gameDateId(nowMs: number): string {
  return new Date(nowMs - SP_UTC_OFFSET_MS).toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest shared/__tests__/dailyGame.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 5: Commit**

```bash
git add shared/dailyGame.ts shared/__tests__/dailyGame.test.ts
git commit -m "feat: pure day and question-of-the-day helpers for the daily game"
```

---

## Task 2: Estado da rodada, XP e apuração

**Files:**
- Modify: `shared/dailyGame.ts`
- Test: `shared/__tests__/dailyGame.test.ts`

**Interfaces:**
- Consumes: `dayNumber` da Task 1.
- Produces: `GAME_XP: { PARTIAL: 6; COMPLETE: 15 }`, `RoundState` (interface com
  `voterCount: number`, `memberCount: number`, `roundDayNumber: number`),
  `isRoundClosed(round: RoundState, nowMs: number): boolean`,
  `xpForRound(voterCount: number, memberCount: number): number`,
  `tallyVotes(votes: Record<string, string>): Array<{ uid: string; count: number }>`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao fim de `shared/__tests__/dailyGame.test.ts`:

```ts
import { GAME_XP, MS_PER_DAY, isRoundClosed, tallyVotes, xpForRound } from '../dailyGame';

const NA_VIRADA_2 = Date.UTC(2026, 7, 28, 3, 0, 0);
const DIA_DA_RODADA = dayNumber(NA_VIRADA_2);

describe('isRoundClosed', () => {
  const rodada = (voterCount: number, memberCount: number) => ({
    voterCount,
    memberCount,
    roundDayNumber: DIA_DA_RODADA,
  });

  it('fecha quando todos votaram, no mesmo dia', () => {
    expect(isRoundClosed(rodada(4, 4), NA_VIRADA_2)).toBe(true);
  });

  it('fica aberta faltando exatamente uma pessoa', () => {
    expect(isRoundClosed(rodada(3, 4), NA_VIRADA_2)).toBe(false);
  });

  it('fecha na virada do dia mesmo faltando gente', () => {
    expect(isRoundClosed(rodada(1, 4), NA_VIRADA_2 + MS_PER_DAY)).toBe(true);
  });

  it('continua aberta às 23:59:59 do próprio dia', () => {
    const quaseVirada = NA_VIRADA_2 + MS_PER_DAY - 1000;
    expect(isRoundClosed(rodada(1, 4), quaseVirada)).toBe(false);
  });
});

describe('xpForRound', () => {
  it('vale 6 enquanto está parcial', () => {
    expect(xpForRound(1, 5)).toBe(GAME_XP.PARTIAL);
    expect(xpForRound(4, 5)).toBe(GAME_XP.PARTIAL);
  });

  it('vale 15 quando todos votaram', () => {
    expect(xpForRound(5, 5)).toBe(GAME_XP.COMPLETE);
  });

  it('não cresce com o tamanho do grupo — 8 votos valem o mesmo que 3', () => {
    // Este é o teste que segura a tese: grupo grande não ganha mais por ser grande.
    expect(xpForRound(8, 8)).toBe(xpForRound(3, 3));
  });
});

describe('tallyVotes', () => {
  it('conta e ordena do mais votado para o menos', () => {
    const r = tallyVotes({ a: 'x', b: 'x', c: 'y' });
    expect(r).toEqual([
      { uid: 'x', count: 2 },
      { uid: 'y', count: 1 },
    ]);
  });

  it('desempata por uid, para a ordem não piscar entre renderizações', () => {
    expect(tallyVotes({ a: 'z', b: 'm' })).toEqual([
      { uid: 'm', count: 1 },
      { uid: 'z', count: 1 },
    ]);
  });

  it('devolve lista vazia quando ninguém votou', () => {
    expect(tallyVotes({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest shared/__tests__/dailyGame.test.ts`
Expected: FAIL — `isRoundClosed is not a function` (e as outras duas).

- [ ] **Step 3: Implementar o mínimo**

Acrescente a `shared/dailyGame.ts`:

```ts
/**
 * XP da RODADA, não do votante: numa Super Parceria de 6, seis votos não
 * valem 36. Sem isso o teto diário de 15 seria estourado por qualquer grupo
 * com mais de dois membros, e grupo grande ganharia por ser grande.
 */
export const GAME_XP = {
  PARTIAL: 6,
  COMPLETE: 15,
} as const;

export interface RoundState {
  voterCount: number;
  memberCount: number;
  roundDayNumber: number;
}

/**
 * Fechamento é derivado, nunca escrito por um job: não há Cloud Functions.
 * Mesma estratégia do decaimento preguiçoso da Temperatura.
 */
export function isRoundClosed(round: RoundState, nowMs: number): boolean {
  return round.voterCount >= round.memberCount || dayNumber(nowMs) > round.roundDayNumber;
}

export function xpForRound(voterCount: number, memberCount: number): number {
  return voterCount >= memberCount ? GAME_XP.COMPLETE : GAME_XP.PARTIAL;
}

/** `votes` é votante → votado. A saída é o votado com quantos votos recebeu. */
export function tallyVotes(votes: Record<string, string>): Array<{ uid: string; count: number }> {
  const counts = new Map<string, number>();
  for (const votedFor of Object.values(votes)) {
    counts.set(votedFor, (counts.get(votedFor) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([uid, count]) => ({ uid, count }))
    .sort((a, b) => b.count - a.count || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest shared/__tests__/dailyGame.test.ts`
Expected: PASS, 18 testes.

- [ ] **Step 5: Validar e commitar**

```bash
npm run typecheck && npx jest shared/
git add shared/dailyGame.ts shared/__tests__/dailyGame.test.ts
git commit -m "feat: round state, round XP and vote tally for the daily game"
```

---

## Task 3: Regras do catálogo e da fila de sugestão

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/game-catalog.test.ts`

**Interfaces:**
- Consumes: `isSignedIn()`, `isOwner(uid)` — helpers que já existem em `firestore.rules`.
- Produces: coleções `gameQuestions/{qid}` e `questionSuggestions/{sid}` protegidas.

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/rules/game-catalog.test.ts`:

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, serverTimestamp } from 'firebase/firestore';
import { ALICE, BOB, createTestEnv } from './helpers';
import { seedUsers } from './factories';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB]);
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('gameQuestions/q0').set({
      text: 'Quem é mais provável de ter um pirrai?',
      emoji: '👶',
      order: 0,
    });
  });
});

const sugestao = (overrides: Record<string, unknown> = {}) => ({
  text: 'Quem é mais provável de dormir no cinema?',
  suggestedBy: ALICE,
  suggestedAt: serverTimestamp(),
  ...overrides,
});

describe('gameQuestions', () => {
  it('PERMITE que qualquer autenticado leia o catálogo', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(alice.doc('gameQuestions/q0').get());
  });

  it('NEGA leitura anônima', async () => {
    await assertFails(env.unauthenticatedContext().firestore().doc('gameQuestions/q0').get());
  });

  it('NEGA que o cliente crie pergunta', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('gameQuestions/q999').set({ text: 'x', emoji: '🙂', order: 999 }));
  });

  it('NEGA que o cliente reescreva o texto de uma pergunta', async () => {
    // Se isto passasse, qualquer um trocaria a pergunta do dia do app inteiro.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('gameQuestions/q0').update({ text: 'outra coisa' }));
  });

  it('NEGA que o cliente apague uma pergunta', async () => {
    // Apagar abre buraco no `order` e deixa um dia sem pergunta.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('gameQuestions/q0').delete());
  });
});

describe('questionSuggestions', () => {
  it('PERMITE sugerir uma pergunta', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(alice.doc('questionSuggestions/s1').set(sugestao()));
  });

  it('NEGA sugerir em nome de outra pessoa', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('questionSuggestions/s1').set(sugestao({ suggestedBy: BOB })));
  });

  it('NEGA ler a fila, mesmo a própria sugestão', async () => {
    // A fila é só de entrada. Ler daria um canal de mensagem entre usuários
    // sem nenhuma moderação, que é exatamente o que o produto não quer ter.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('questionSuggestions/s1').set({
        text: 'Quem é mais provável de dormir no cinema?',
        suggestedBy: ALICE,
        suggestedAt: new Date(),
      });
    });
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('questionSuggestions/s1').get());
  });

  it('NEGA suggestedAt escolhido pelo cliente', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const futuro = Timestamp.fromMillis(Date.now() + 86_400_000);
    await assertFails(alice.doc('questionSuggestions/s1').set(sugestao({ suggestedAt: futuro })));
  });

  it('NEGA texto curto demais para ser pergunta', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('questionSuggestions/s1').set(sugestao({ text: 'oi' })));
  });

  it('NEGA texto longo demais', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('questionSuggestions/s1').set(sugestao({ text: 'a'.repeat(141) })));
  });

  it('NEGA editar a própria sugestão depois de enviada', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await alice.doc('questionSuggestions/s1').set(sugestao());
    await assertFails(alice.doc('questionSuggestions/s1').update({ text: 'trocando o texto todo' }));
  });

  it('NEGA sugestão com campo além dos três permitidos', async () => {
    // Sem a allowlist, a fila vira depósito de blob: a regra só olha três
    // campos e ignora o resto, num documento que ninguém lê e ninguém modera.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('questionSuggestions/s1').set(sugestao({ approved: true })));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx firebase emulators:exec --only firestore "npx jest -c jest.rules.config.js tests/rules/game-catalog.test.ts"`
Expected: FAIL — as duas asserções `assertSucceeds` falham, porque hoje as duas coleções
caem no `match /{document=**} { allow read, write: if false }`.

- [ ] **Step 3: Escrever as regras**

Em `firestore.rules`, **antes** do bloco `// ---- padrão ----`, insira:

```
    // ---- jogo diário ---------------------------------------------------

    match /gameQuestions/{qid} {
      // O catálogo é curado à mão pelo console. Nenhum cliente escreve aqui:
      // quem escrevesse trocaria a pergunta do dia do app inteiro.
      allow read: if isSignedIn();
      allow write: if false;
    }

    match /questionSuggestions/{sid} {
      // Fila só de entrada: escreve e some da vista. Ninguém lê pelo app, nem
      // quem escreveu — leitura transformaria isso num canal de mensagem sem
      // moderação entre usuários.
      allow create: if isOwner(request.resource.data.suggestedBy)
                    && request.resource.data.text is string
                    && request.resource.data.text.size() >= 10
                    && request.resource.data.text.size() <= 140
                    && request.resource.data.suggestedAt == request.time
                    && request.resource.data.keys().hasOnly(['text', 'suggestedBy', 'suggestedAt']);
      allow read, update, delete: if false;
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx firebase emulators:exec --only firestore "npx jest -c jest.rules.config.js tests/rules/game-catalog.test.ts"`
Expected: PASS, 13 testes.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/rules/game-catalog.test.ts
git commit -m "feat(rules): protect daily-game catalog and suggestion queue"
```

---

## Task 4: Regras do documento da rodada

**Files:**
- Modify: `firestore.rules`
- Modify: `tests/rules/factories.ts`
- Create: `tests/rules/game-round.test.ts`

**Interfaces:**
- Consumes: `isSignedIn()`, `isMember(data)` de `firestore.rules`; `dayNumber`,
  `questionIndexFor`, `gameDateId` da Task 1.
- Produces: em `firestore.rules`, as funções `gameCatalogSize()`, `todayNumber()`,
  `todayId()`, `pad2(n)`, `questionOfTheDay()`, `superPartnership(spid)`,
  `gameXp(voterCount, memberCount)`, e o bloco `match /superPartnerships/{spid}/games/{date}`.
  Em `tests/rules/factories.ts`, `validSuperPartnership(members: string[], overrides?)`,
  `seedSuperPartnership(env, spid, data)` e `seedRound(env, spid, date, data)`.

> **Nota de acoplamento:** a fábrica abaixo materializa a forma de
> `superPartnerships/{spid}` definida na §7 do doc de produto. A Spec 6 é quem vai criar
> a coleção de verdade. Se ela mudar o nome do campo `members`, estes testes quebram — e
> devem quebrar mesmo.

- [ ] **Step 1: Escrever as fábricas**

Acrescente a `tests/rules/factories.ts`:

```ts
export function validSuperPartnership(members: string[], overrides: Record<string, unknown> = {}) {
  const sorted = [...members].sort();
  return {
    id: sorted.join('_'),
    members: sorted,
    memberProfiles: Object.fromEntries(
      sorted.map((uid) => {
        const p = validProfile(uid, uid.replace(/-/g, ''));
        return [uid, { displayName: p.displayName, photoURL: p.photoURL, avatarEmoji: p.avatarEmoji }];
      }),
    ),
    partnershipIds: [],
    name: 'Os Fominhas',
    emoji: '🔥',
    bornAt: serverTimestamp(),
    level: 1,
    xparceria: 0,
    bonusMultiplier: 1.5,
    status: 'active',
    stats: { groupEncounters: 0, lastGroupEncounterAt: null },
    ...overrides,
  };
}

export async function seedSuperPartnership(
  env: RulesTestEnvironment,
  spid: string,
  members: string[],
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .doc(`superPartnerships/${spid}`)
      .set({ ...validSuperPartnership(members), bornAt: new Date() });
  });
}

export async function seedRound(
  env: RulesTestEnvironment,
  spid: string,
  date: string,
  data: Record<string, unknown>,
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`superPartnerships/${spid}/games/${date}`).set(data);
  });
}
```

- [ ] **Step 2: Escrever os testes que falham**

Crie `tests/rules/game-round.test.ts`:

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedRound, seedSuperPartnership, seedUsers } from './factories';
import { dayNumber, gameDateId, questionIndexFor } from '../../shared/dailyGame';

const SPID = 'sp-1';
const DAVE = 'dave-uid';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL, DAVE]);
  await seedSuperPartnership(env, SPID, [ALICE, BOB, CAROL]);
});

// Derivados da hora real do teste: a regra usa request.time, então o teste
// tem que perguntar o mesmo "hoje" que ela vai enxergar.
const hoje = () => gameDateId(Date.now());
const hojeNum = () => dayNumber(Date.now());
const perguntaDeHoje = () => `q${questionIndexFor(hojeNum())}`;

const rodadaNova = (voter: string, overrides: Record<string, unknown> = {}) => ({
  date: hoje(),
  dayNumber: hojeNum(),
  questionId: perguntaDeHoje(),
  voterUids: [voter],
  xpAwarded: 6,
  ...overrides,
});

const caminho = (date = hoje()) => `superPartnerships/${SPID}/games/${date}`;

describe('rodada — create', () => {
  it('PERMITE que um membro abra a rodada do dia', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(alice.doc(caminho()).set(rodadaNova(ALICE)));
  });

  it('NEGA que quem não é do grupo abra a rodada', async () => {
    const dave = env.authenticatedContext(DAVE).firestore();
    await assertFails(dave.doc(caminho()).set(rodadaNova(DAVE)));
  });

  it('NEGA abrir a rodada já contando o voto de outra pessoa', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(caminho()).set(rodadaNova(BOB)));
  });

  it('NEGA a pergunta de ontem', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const ontem = `q${questionIndexFor(hojeNum() - 1)}`;
    await assertFails(alice.doc(caminho()).set(rodadaNova(ALICE, { questionId: ontem })));
  });

  it('NEGA a pergunta de amanhã', async () => {
    // Junto com o teste acima, é isto que impede re-sortear até cair uma
    // pergunta que convém a quem abriu primeiro.
    const alice = env.authenticatedContext(ALICE).firestore();
    const amanha = `q${questionIndexFor(hojeNum() + 1)}`;
    await assertFails(alice.doc(caminho()).set(rodadaNova(ALICE, { questionId: amanha })));
  });

  it('NEGA dayNumber que não é o de hoje', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(caminho()).set(rodadaNova(ALICE, { dayNumber: hojeNum() - 1 })));
  });

  it('NEGA date diferente do id do documento', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(caminho()).set(rodadaNova(ALICE, { date: '2020-01-01' })));
  });

  it('NEGA xpAwarded inflado', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(caminho()).set(rodadaNova(ALICE, { xpAwarded: 500 })));
  });

  it('NEGA xpAwarded 15 numa rodada que está só começando', async () => {
    // Um literal errado de cada vez: o resto do documento continua válido.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(caminho()).set(rodadaNova(ALICE, { xpAwarded: 15 })));
  });

  it('NEGA criar a rodada de hoje num id de outro dia', async () => {
    // `date == date` só amarra o campo ao id. Sem `date == todayId()`, dava
    // para cunhar quantas rodadas de 15 XP se quisesse, em ids arbitrários.
    const alice = env.authenticatedContext(ALICE).firestore();
    const ontem = gameDateId(Date.now() - 86_400_000);
    await assertFails(
      alice.doc(caminho(ontem)).set(rodadaNova(ALICE, { date: ontem })),
    );
  });

  it('NEGA criar a rodada com campo além dos cinco permitidos', async () => {
    // O hasOnly do update congela o documento depois, então campo injetado
    // no create ficaria permanente naquela rodada.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(caminho()).set(rodadaNova(ALICE, { winner: BOB })));
  });
});

describe('rodada — update', () => {
  beforeEach(async () => {
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE));
  });

  it('PERMITE que o segundo membro entre na rodada', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(
      bob.doc(caminho()).update({ voterUids: [ALICE, BOB], xpAwarded: 6 }),
    );
  });

  it('PERMITE fechar a rodada com 15 quando o último vota', async () => {
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { voterUids: [ALICE, BOB] }));
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertSucceeds(
      carol.doc(caminho()).update({ voterUids: [ALICE, BOB, CAROL], xpAwarded: 15 }),
    );
  });

  it('NEGA votar duas vezes', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      alice.doc(caminho()).update({ voterUids: [ALICE, ALICE], xpAwarded: 6 }),
    );
  });

  it('NEGA entrar na rodada em nome de outra pessoa', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(caminho()).update({ voterUids: [ALICE, CAROL], xpAwarded: 6 }),
    );
  });

  it('NEGA remover alguém de voterUids', async () => {
    // Sem esta guarda daria para apagar o voto de quem já votou e reabrir a rodada.
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { voterUids: [ALICE, BOB] }));
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(
      carol.doc(caminho()).update({ voterUids: [ALICE, CAROL], xpAwarded: 6 }),
    );
  });

  it('NEGA cobrar 15 com a rodada ainda parcial', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(caminho()).update({ voterUids: [ALICE, BOB], xpAwarded: 15 }),
    );
  });

  it('NEGA trocar a pergunta no meio da rodada', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(caminho()).update({ voterUids: [ALICE, BOB], xpAwarded: 6, questionId: 'q001' }),
    );
  });

  it('NEGA entrar hoje numa rodada cujo dia já virou', async () => {
    // isRoundClosed já considera essa rodada fechada. Sem esta guarda, quem
    // faltou ontem entra hoje e empurra o xpAwarded de 6 pra 15.
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { dayNumber: hojeNum() - 1 }));
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(caminho()).update({ voterUids: [ALICE, BOB], xpAwarded: 6 }),
    );
  });

  it('NEGA apagar a rodada', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(caminho()).delete());
  });
});

describe('rodada — read', () => {
  beforeEach(async () => {
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE));
  });

  it('PERMITE que um membro leia a rodada', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.doc(caminho()).get());
  });

  it('NEGA que quem não é do grupo leia a rodada', async () => {
    const dave = env.authenticatedContext(DAVE).firestore();
    await assertFails(dave.doc(caminho()).get());
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx firebase emulators:exec --only firestore "npx jest -c jest.rules.config.js tests/rules/game-round.test.ts"`
Expected: FAIL — todos os `assertSucceeds` falham, a coleção ainda cai no default deny.

- [ ] **Step 4: Escrever as regras**

Em `firestore.rules`, junto às outras funções do topo (perto de `partnership(pid)`):

```
    function superPartnership(spid) {
      return get(/databases/$(database)/documents/superPartnerships/$(spid)).data;
    }

    // Precisa bater com GAME_CATALOG_SIZE em shared/dailyGame.ts.
    function gameCatalogSize() {
      return 120;
    }

    // Os 10800000 ms são as 3h de America/Sao_Paulo: movem a virada do dia
    // do UTC para a meia-noite local. Verificado contra o emulador em 28/08 —
    // a regra calcula o índice e nega o índice errado.
    function todayNumber() {
      return int((request.time.toMillis() - 10800000) / 86400000);
    }

    function pad2(n) {
      return n < 10 ? '0' + string(n) : string(n);
    }

    // A data de hoje em America/Sao_Paulo, no formato do id do documento.
    // É a TERCEIRA derivação da data — shared/dailyGame.ts já tem dayNumber e
    // gameDateId. Duplicação deliberada: se as três divergirem, a suíte fica
    // vermelha, que é o comportamento desejado.
    function todayId() {
      let t = request.time - duration.value(3, 'h');
      return string(t.year()) + '-' + pad2(t.month()) + '-' + pad2(t.day());
    }

    function questionOfTheDay() {
      return 'q' + string(todayNumber() % gameCatalogSize());
    }

    // XP da rodada, nunca do votante: 8 votos valem o mesmo que 3.
    function gameXp(voterCount, memberCount) {
      return voterCount >= memberCount ? 15 : 6;
    }
```

E dentro do bloco `// ---- jogo diário ----` criado na Task 3, acrescente:

```
    // A Spec 6 é quem define leitura e escrita do documento da Super Parceria
    // em si. Aqui só existe o que o jogo diário precisa.
    match /superPartnerships/{spid}/games/{date} {
      allow read: if isMember(superPartnership(spid));

      allow create: if isMember(superPartnership(spid))
                    && request.resource.data.date == date
                    && request.resource.data.date == todayId()
                    && request.resource.data.dayNumber == todayNumber()
                    && request.resource.data.questionId == questionOfTheDay()
                    && request.resource.data.voterUids == [request.auth.uid]
                    && request.resource.data.xpAwarded ==
                         gameXp(1, superPartnership(spid).members.size())
                    && request.resource.data.keys().hasOnly(
                         ['date', 'dayNumber', 'questionId', 'voterUids', 'xpAwarded']);

      allow update: if isMember(superPartnership(spid))
                    && resource.data.dayNumber == todayNumber()
                    && !(request.auth.uid in resource.data.voterUids)
                    && request.resource.data.voterUids ==
                         resource.data.voterUids.concat([request.auth.uid])
                    && request.resource.data.xpAwarded ==
                         gameXp(request.resource.data.voterUids.size(),
                                superPartnership(spid).members.size())
                    && request.resource.data.diff(resource.data)
                         .affectedKeys().hasOnly(['voterUids', 'xpAwarded']);

      allow delete: if false;
    }
```

- [ ] **Step 5: Rodar e ver passar**

> O `questionId` é `'q' + o índice sem preenchimento` — `q0`, `q7`, `q119` — porque
> `rules` não tem `padStart` e o formato precisa ser idêntico nos dois lados. Os ids em
> `gameQuestions` seguem isso.

Run: `npx firebase emulators:exec --only firestore "npx jest -c jest.rules.config.js tests/rules/game-round.test.ts"`
Expected: PASS, 22 testes.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/rules/factories.ts tests/rules/game-round.test.ts
git commit -m "feat(rules): daily-game round doc, with question-of-the-day pinned in the rule"
```

---

## Task 5: Regras de escrita do voto

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/game-votes.test.ts`

**Interfaces:**
- Consumes: tudo que a Task 4 produziu.
- Produces: `match /superPartnerships/{spid}/games/{date}/votes/{voter}` com `create`.

- [ ] **Step 1: Escrever os testes que falham**

Crie `tests/rules/game-votes.test.ts`. O cabeçalho é repetido de
`game-round.test.ts` de propósito — cada arquivo de teste de regras neste projeto é
autocontido:

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { serverTimestamp } from 'firebase/firestore';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedRound, seedSuperPartnership, seedUsers } from './factories';
import { dayNumber, gameDateId, questionIndexFor } from '../../shared/dailyGame';

const SPID = 'sp-1';
const DAVE = 'dave-uid';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL, DAVE]);
  await seedSuperPartnership(env, SPID, [ALICE, BOB, CAROL]);
});

const hoje = () => gameDateId(Date.now());
const hojeNum = () => dayNumber(Date.now());
const perguntaDeHoje = () => `q${questionIndexFor(hojeNum())}`;

const rodadaNova = (voter: string, overrides: Record<string, unknown> = {}) => ({
  date: hoje(),
  dayNumber: hojeNum(),
  questionId: perguntaDeHoje(),
  voterUids: [voter],
  xpAwarded: 6,
  ...overrides,
});

const caminho = (date = hoje()) => `superPartnerships/${SPID}/games/${date}`;

// Escrita que passa pelas regras usa serverTimestamp(), porque a regra exige
// votedAt == request.time e um Date do cliente nunca bate. Fixture semeada com
// withSecurityRulesDisabled usa new Date() — mesmo padrão de seedInvite().
const votoPath = (voter: string, date = hoje()) =>
  `superPartnerships/${SPID}/games/${date}/votes/${voter}`;

describe('voto — create', () => {
  beforeEach(async () => {
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE));
  });

  it('PERMITE votar entrando na rodada no mesmo lote', async () => {
    const db = env.authenticatedContext(BOB).firestore();
    const b = db.batch();
    b.update(db.doc(caminho()), { voterUids: [ALICE, BOB], xpAwarded: 6 });
    b.set(db.doc(votoPath(BOB)), { votedFor: CAROL, votedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('PERMITE votar em si mesmo', async () => {
    // Assumir a piada é a válvula de escape do jogo. Se isto quebrar, o
    // produto mudou — não conserte o teste sem reler a §3 do design.
    const db = env.authenticatedContext(BOB).firestore();
    const b = db.batch();
    b.update(db.doc(caminho()), { voterUids: [ALICE, BOB], xpAwarded: 6 });
    b.set(db.doc(votoPath(BOB)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('NEGA escrever o voto sem entrar em voterUids no mesmo lote', async () => {
    // Sem o getAfter, dava para votar sem aparecer como votante — a rodada
    // nunca fecharia e o voto entraria escondido na apuração.
    const db = env.authenticatedContext(BOB).firestore();
    await assertFails(
      db.doc(votoPath(BOB)).set({ votedFor: CAROL, votedAt: serverTimestamp() }),
    );
  });

  it('NEGA votar no lugar de outra pessoa', async () => {
    const db = env.authenticatedContext(BOB).firestore();
    const b = db.batch();
    b.update(db.doc(caminho()), { voterUids: [ALICE, BOB], xpAwarded: 6 });
    b.set(db.doc(votoPath(CAROL)), { votedFor: ALICE, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA votar em quem não é do grupo', async () => {
    const db = env.authenticatedContext(BOB).firestore();
    const b = db.batch();
    b.update(db.doc(caminho()), { voterUids: [ALICE, BOB], xpAwarded: 6 });
    b.set(db.doc(votoPath(BOB)), { votedFor: DAVE, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA votedAt escolhido pelo cliente', async () => {
    const db = env.authenticatedContext(BOB).firestore();
    const b = db.batch();
    b.update(db.doc(caminho()), { voterUids: [ALICE, BOB], xpAwarded: 6 });
    b.set(db.doc(votoPath(BOB)), {
      votedFor: CAROL,
      votedAt: new Date(Date.now() + 86_400_000),
    });
    await assertFails(b.commit());
  });

  it('NEGA trocar o voto depois de dado', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(votoPath(BOB)).set({ votedFor: CAROL, votedAt: new Date() });
    });
    const db = env.authenticatedContext(BOB).firestore();
    await assertFails(db.doc(votoPath(BOB)).update({ votedFor: ALICE }));
  });

  it('NEGA apagar o próprio voto', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(votoPath(BOB)).set({ votedFor: CAROL, votedAt: new Date() });
    });
    const db = env.authenticatedContext(BOB).firestore();
    await assertFails(db.doc(votoPath(BOB)).delete());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx firebase emulators:exec --only firestore "npx jest -c jest.rules.config.js tests/rules/game-votes.test.ts"`
Expected: FAIL nos `assertSucceeds`.

- [ ] **Step 3: Escrever a regra**

Dentro do bloco `match /superPartnerships/{spid}/games/{date}`, acrescente:

```
      match /votes/{voter} {
        // O getAfter enxerga o estado pós-transação (provado na Spec 2), então
        // a regra consegue exigir que o voto e a entrada em voterUids sejam
        // escritos juntos. Sem isso daria para votar sem aparecer como votante.
        allow create: if isOwner(voter)
                      && request.resource.data.votedFor in superPartnership(spid).members
                      && request.resource.data.votedAt == request.time
                      && getAfter(
                           /databases/$(database)/documents/superPartnerships/$(spid)/games/$(date)
                         ).data.voterUids.hasAll([voter]);

        allow update, delete: if false;
      }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx firebase emulators:exec --only firestore "npx jest -c jest.rules.config.js tests/rules/game-votes.test.ts"`
Expected: PASS nos 8 testes de escrita. **Os de leitura ainda não existem** — são a Task 6.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/rules/game-votes.test.ts
git commit -m "feat(rules): vote write, pinned to the same transaction as voterUids"
```

---

## Task 6: Regras de leitura do voto — o segredo até a revelação

**Files:**
- Modify: `firestore.rules`
- Modify: `tests/rules/game-votes.test.ts`

**Interfaces:**
- Consumes: tudo que a Task 5 produziu.
- Produces: `roundClosed(spid, date)` em `firestore.rules` e as permissões de `get`/`list`
  em `votes/{voter}`.

Esta é a task mais importante do plano. Se ela estiver errada, o jogo inteiro perde a
graça sem dar nenhum sinal de erro: dá para abrir o app, ler os votos dos outros e só
depois votar.

- [ ] **Step 1: Escrever os testes que falham**

Acrescente a `tests/rules/game-votes.test.ts`:

```ts
describe('voto — read', () => {
  const semearVotos = async (voterUids: string[], overrides = {}) => {
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { voterUids, ...overrides }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const uid of voterUids) {
        await ctx.firestore().doc(votoPath(uid)).set({ votedFor: CAROL, votedAt: new Date() });
      }
    });
  };

  it('PERMITE reler o PRÓPRIO voto com a rodada aberta', async () => {
    // Sem isto, quem votou não consegue nem ver o que votou.
    await semearVotos([ALICE, BOB]);
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.doc(votoPath(BOB)).get());
  });

  it('NEGA ler o voto de OUTRO faltando exatamente uma pessoa', async () => {
    // O caso que importa: com 2 de 3, a rodada ainda está aberta.
    await semearVotos([ALICE, BOB]);
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(votoPath(ALICE)).get());
  });

  it('PERMITE ler o voto de outro depois que todos votaram', async () => {
    await semearVotos([ALICE, BOB, CAROL], { xpAwarded: 15 });
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.doc(votoPath(ALICE)).get());
  });

  it('PERMITE ler o voto de outro depois da virada do dia, mesmo incompleta', async () => {
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { dayNumber: hojeNum() - 1 }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(votoPath(ALICE)).set({ votedFor: CAROL, votedAt: new Date() });
    });
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.doc(votoPath(ALICE)).get());
  });

  it('NEGA ler o voto de outro na rodada de HOJE que só tem um votante', async () => {
    // Par do teste acima: mesma forma, só o dayNumber muda. Isola a guarda
    // do dia da guarda do quórum.
    await semearVotos([ALICE]);
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(votoPath(ALICE)).get());
  });

  it('NEGA listar os votos com a rodada aberta', async () => {
    // A apuração é feita no cliente lendo a coleção. Se o list vazar, todo o
    // resto não adianta nada.
    await semearVotos([ALICE, BOB]);
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.collection(`superPartnerships/${SPID}/games/${hoje()}/votes`).get());
  });

  it('PERMITE listar os votos depois de fechada', async () => {
    await semearVotos([ALICE, BOB, CAROL], { xpAwarded: 15 });
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.collection(`superPartnerships/${SPID}/games/${hoje()}/votes`).get());
  });

  it('NEGA que quem não é do grupo leia voto de rodada fechada', async () => {
    await semearVotos([ALICE, BOB, CAROL], { xpAwarded: 15 });
    const dave = env.authenticatedContext(DAVE).firestore();
    await assertFails(dave.doc(votoPath(ALICE)).get());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx firebase emulators:exec --only firestore "npx jest -c jest.rules.config.js tests/rules/game-votes.test.ts"`
Expected: FAIL — hoje não há nenhuma permissão de leitura em `votes/*`, então todos os
`assertSucceeds` deste describe falham.

- [ ] **Step 3: Escrever a regra**

Junto às outras funções do topo de `firestore.rules`:

```
    // Fechada = todo mundo votou, OU o dia da rodada já passou. Não existe job
    // que feche: o fechamento é derivado na leitura, como o decaimento da
    // Temperatura.
    function roundClosed(spid, date) {
      let g = get(/databases/$(database)/documents/superPartnerships/$(spid)/games/$(date)).data;
      return g.voterUids.size() >= superPartnership(spid).members.size()
          || todayNumber() > g.dayNumber;
    }
```

E dentro de `match /votes/{voter}`, acrescente **antes** do `allow create`:

```
        // O próprio voto é sempre legível — senão a pessoa não consegue reler
        // o que votou. O dos outros, só depois que a rodada fecha.
        allow get:  if isOwner(voter)
                    || (isMember(superPartnership(spid)) && roundClosed(spid, date));

        // list não tem exceção para o próprio voto: listar devolveria os
        // outros junto.
        allow list: if isMember(superPartnership(spid)) && roundClosed(spid, date);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx firebase emulators:exec --only firestore "npx jest -c jest.rules.config.js tests/rules/game-votes.test.ts"`
Expected: PASS, 16 testes.

- [ ] **Step 5: Mutar cada guarda, uma de cada vez**

*Uma mutação não valida uma suíte.* Para **cada** linha abaixo, faça a mutação, rode a
suíte inteira, confirme qual teste fica vermelho, e **desfaça imediatamente com
`git checkout firestore.rules`** antes da próxima. Editar regra para mutar é edição
destrutiva temporária — na Spec 2 um agente morreu no meio disso e deixou a regra de
convite aberta na árvore de trabalho.

| Mutação | Teste que TEM que ficar vermelho |
|---|---|
| Em `allow get`, trocar `roundClosed(...)` por `true` | *NEGA ler o voto de OUTRO faltando exatamente uma pessoa* |
| Em `allow get`, apagar `isOwner(voter) \|\|` | *PERMITE reler o PRÓPRIO voto com a rodada aberta* |
| Em `allow list`, trocar `roundClosed(...)` por `true` | *NEGA listar os votos com a rodada aberta* |
| Em `roundClosed`, trocar `>=` por `>` | *PERMITE ler o voto de outro depois que todos votaram* |
| Em `roundClosed`, apagar a cláusula `\|\| todayNumber() > g.dayNumber` | *PERMITE ler o voto de outro depois da virada do dia* |
| Em `roundClosed`, trocar `todayNumber() > g.dayNumber` por `true` | *NEGA ler o voto de outro na rodada de HOJE que só tem um votante* |

Se alguma mutação **não** deixar nada vermelho, existe um buraco de cobertura ali:
escreva o teste que falta antes de seguir.

- [ ] **Step 6: Validar tudo e commitar**

```bash
git checkout firestore.rules   # garante que nenhuma mutação sobrou
npm run validate
git add firestore.rules tests/rules/game-votes.test.ts
git commit -m "feat(rules): keep votes secret until the round closes"
```

Expected: `npm run validate` verde — `tsc` limpo, os testes de app passando e os de regras
passando.

---

## Fase B — o que fica bloqueado, e por quê

Estas partes **não estão planejadas em tarefas**, de propósito. Planejar em detalhe uma
tela que consome uma coleção cuja forma ainda não foi escrita produziria exatamente os
espaços em branco que um plano não pode ter.

| Bloqueado | Depende de |
|---|---|
| Tipos `DailyGameRound` e `Vote` em `shared/types.ts` | Da Spec 6 fixar a forma final de `superPartnerships` |
| Serviço de rodada (abrir, votar, apurar) e a ponte `onSnapshot` → React Query | Da Spec 4, Task 5 — a ponte de tempo real ainda não existe |
| Card, modal de voto, tela de revelação, campo de sugestão | Das duas acima, e de existir uma Super Parceria para renderizar |
| Somar `xpAwarded` no `xparceria` do grupo | Da Spec 6 criar o documento e o motor de nível do grupo |

**O gatilho para planejar a Fase B:** a Spec 6 ter criado `superPartnerships` com
detecção de triângulos funcionando e pelo menos uma Super Parceria nascendo em teste.
Antes disso, qualquer plano de tela é chute.

O que a Fase A entrega sozinha é real: quando a Fase B chegar, o motor e as regras já
estão escritos e provados, e a tela vira consumo de coisa pronta. É a mesma aposta que
o doc de produto faz sobre a Spec 4 — motor como função pura, testado antes de existir
infraestrutura.

### Um risco que a Fase A não resolve

O catálogo precisa de **120 perguntas escritas** antes de o jogo poder existir, e elas
são trabalho humano seu, sob as quatro regras de curadoria da §5 do design. Não é código
e ninguém pode fazer por você. `GAME_CATALOG_SIZE` pode ser ajustado para o número real
quando as perguntas existirem — em dois lugares, `shared/dailyGame.ts` e
`firestore.rules`, e os testes quebram se você esquecer de um.

---

*Plano da Fase A — Jogo Diário, Parcerio. A Fase B só é planejável depois da Spec 6.*
