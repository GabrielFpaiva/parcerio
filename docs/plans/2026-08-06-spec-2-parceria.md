# Spec 2 — Parceria · Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** duas pessoas viram parceiras por um código de convite, e as duas veem a cerimônia de nascimento no mesmo instante.

**Architecture:** sem Cloud Functions — **as security rules são o servidor**. Toda escrita acontece no cliente, dentro de transações do Firestore, e cada valor em que o cliente não pode ser confiado é um literal fixado na regra. As decisões de negócio (id determinístico, documento de nascimento, validade do convite) são funções puras em `shared/`, e o que a regra fixa tem de bater exatamente com o que a função pura produz.

**Tech Stack:** Expo SDK 57 · Firebase JS SDK 12 · Firestore security rules · Jest 29 · `@firebase/rules-unit-testing` · React Query 5 · Expo Router.

**Spec:** `docs/2026-08-06-spec-2-parceria-design.md`
**Produto:** `docs/2026-08-03-parceria-design.md` (§4, §5, §6, §7, §19)
**Branch:** `feat/spec-2-parceria`

---

## Global Constraints

Valem para **todas** as tasks. Cada uma custou tempo na Spec 1 ou foi verificada contra documentação oficial.

- **Leia a doc versionada antes de escrever código de Expo:** `https://docs.expo.dev/versions/v57.0.0/`. É o que o `AGENTS.md` do repo manda.
- **Nunca usar `.npmrc` com `legacy-peer-deps`.** Silencia todo conflito de peer dependency, inclusive os que importam.
- **`npx expo install <pkg>`** para dependências novas — resolve pelo canal do SDK.
- **`render` e `fireEvent` do RNTL v14 são assíncronos.** `const screen = await render(...)`, `await fireEvent.press(...)`. Teste síncrono não falha; ele nem roda direito.
- **`Pressable` precisa da prop `disabled` nativa.** Guarda só em JS não impede o gesture responder de capturar o toque.
- **Nunca espalhar `...theme.type.X`** em `style`: `fontWeight` vem tipado como `string` e quebra o `tsc`. Campos explícitos.
- **`await import()` dinâmico não funciona** nos testes (Jest em CJS). Import estático sempre.
- **`tx.get()` antes da escrita mascara o teste de regra:** o SDK lança erro genérico do cliente *antes* de a regra rodar, e `assertFails` exige `PERMISSION_DENIED`. Em teste de negação, escreva direto, sem pré-leitura.
- **Uma mutação não valida uma suíte.** Para cada regra, mute *aquela* condição e veja o teste correspondente falhar. Foi assim que a Spec 1 quase entregou um furo grave.
- **Serviços não importam `@/core/firebase/client`.** Recebem a instância `Firestore` por parâmetro. É o que permite testá-los contra o emulador em Node, onde `initializeAuth` com AsyncStorage quebraria.
- **Toda mensagem de UI em português**, sem vazar código de erro cru.
- **Commits atômicos, mensagem em inglês, sem trailer `Co-Authored-By`** (regra do CLAUDE.md — um hook rejeita).

### Correção de rota descoberta na leitura do código

A spec original desenhou o onboarding em `app/(auth)/onboarding/`. **Não funciona:** `app/(auth)/_layout.tsx` redireciona para `/` assim que o perfil existe, e o convite acontece depois do perfil. As rotas ficam em **`app/(app)/onboarding/`**.

---

## Pré-requisito manual (Gabriel, antes da Task 14)

- [ ] **Habilitar o Firebase Hosting** no projeto `parceria-db699` (console → Hosting → Começar). Está no plano gratuito; não depende de Blaze. Só a Task 14 precisa dele.

Nada mais. O projeto continua inteiro no plano Spark.

---

## Mapa de arquivos

### Domínio compartilhado

| Arquivo | Responsabilidade |
|---|---|
| `shared/types.ts` *(modificado)* | `PartnershipStatus` sem `pending`, `EventType`, `PartnershipDoc`, `InviteDoc`, `MemberProfile` |
| `shared/partnership.ts` | `partnershipId`, `buildBirthPartnership`, `buildReactivationUpdate` |
| `shared/invite.ts` | alfabeto, geração e normalização de código, `checkInvite` |

### Segurança

| Arquivo | Responsabilidade |
|---|---|
| `firestore.rules` *(modificado)* | `invites`, `partnerships` create/update, `events` |
| `tests/rules/invites.test.ts` *(reescrito)* | — |
| `tests/rules/partnership-create.test.ts` | cada literal do nascimento, forjado e negado |
| `tests/rules/partnership-update.test.ts` | ciclo de vida, reativação, perfil |
| `tests/rules/events.test.ts` | — |
| `tests/rules/factories.ts` | fábricas de convite e parceria válidos, para mutar campo a campo |

### Serviços e integração

| Arquivo | Responsabilidade |
|---|---|
| `src/features/invite/services/invites.ts` | criar, ler, aceitar (transação) |
| `src/features/partnership/services/partnerships.ts` | pausar, retomar, encerrar, propagar perfil |
| `tests/integration/invite-flow.test.ts` | fluxo real com dois usuários no emulador |
| `tests/integration/lifecycle.test.ts` | — |

### Cliente

| Arquivo | Responsabilidade |
|---|---|
| `src/core/firebase/useFirestoreDoc.ts` · `useFirestoreCollection.ts` | ponte `onSnapshot` → React Query |
| `src/core/firebase/firestoreError.ts` | código do Firestore → mensagem em pt-BR |
| `src/features/invite/hooks/*` | `useCreateInvite`, `useInvitePreview`, `useAcceptInvite` |
| `src/features/invite/*Screen.tsx` | `FirstInvite`, `Waiting`, `EnterCode`, `AcceptInvite` |
| `src/features/partnership/hooks/*` | `usePartnerships`, `usePartnership` |
| `src/features/partnership/*.tsx` | `PartnershipListScreen`, `PartnershipCard`, `PartnershipOverviewScreen` |
| `src/features/ceremony/*` | `PartnershipBornCeremony`, `useBornCeremony` |
| `app/(app)/index.tsx` *(modificado)* | vira a lista de parcerias |
| `app/(app)/onboarding/*`, `app/(app)/invite/*`, `app/(app)/partnership/[id]/index.tsx`, `app/(modals)/partnership-born.tsx` | rotas finas |
| `hosting/index.html` | landing estática |
| `firebase.json` *(modificado)* | bloco `hosting` |
| `jest.rules.config.js` *(modificado)* | `testMatch` passa a cobrir `tests/**` |

---

## Task 1: Domínio compartilhado da parceria

Funções puras, sem Firebase. É a base de tudo: o que a regra fixa tem de bater exatamente com o que estas funções produzem.

**Files:**
- Modify: `shared/types.ts`
- Create: `shared/partnership.ts`, `shared/invite.ts`
- Test: `shared/__tests__/partnership.test.ts`, `shared/__tests__/invite.test.ts`

**Interfaces:**
- Consumes: `shared/constants.ts` (`XP`, `TEMPERATURE`), `shared/level.ts` (`xpForNextLevel`), `shared/temperature.ts` (`bandForTemperature`)
- Produces:
  - `partnershipId(a: string, b: string): string`
  - `buildBirthPartnership(input: BirthInput): BirthPartnership`
  - `buildReactivationUpdate(profiles: Record<string, MemberProfile>, inviteCode: string): ReactivationUpdate`
  - `generateInviteCode(random?: () => number): string`
  - `normalizeInviteCode(raw: string): string`
  - `checkInvite(invite: InviteCheckInput, accepterUid: string, nowMs: number): InviteRejection | null`
  - `INVITE_ALPHABET`, `INVITE_CODE_LENGTH`, `INVITE_TTL_DAYS`
  - tipos `MemberProfile`, `PartnershipDoc`, `InviteDoc`, `EventType`, `ACHIEVEMENT_FIRST_PARTNERSHIP`

- [ ] **Step 1: Escrever `shared/__tests__/partnership.test.ts`**

```ts
import { TEMPERATURE, XP } from '../constants';
import { buildBirthPartnership, buildReactivationUpdate, partnershipId } from '../partnership';
import type { MemberProfile } from '../types';

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

const aliceProfile: MemberProfile = { displayName: 'Alice', photoURL: null, avatarEmoji: '🦊' };
const bobProfile: MemberProfile = { displayName: 'Bob', photoURL: 'https://x/p.jpg', avatarEmoji: '🐢' };

describe('partnershipId', () => {
  it('é o mesmo independente da ordem dos argumentos', () => {
    expect(partnershipId(ALICE, BOB)).toBe(partnershipId(BOB, ALICE));
  });

  it('junta os uids ordenados com underline', () => {
    expect(partnershipId(BOB, ALICE)).toBe('alice-uid_bob-uid');
  });

  it('recusa parceria de alguém consigo mesmo', () => {
    expect(() => partnershipId(ALICE, ALICE)).toThrow('mesma pessoa');
  });
});

describe('buildBirthPartnership', () => {
  const birth = buildBirthPartnership({
    inviter: { uid: BOB, profile: bobProfile },
    accepter: { uid: ALICE, profile: aliceProfile },
    inviteCode: 'AB3D4F7H',
  });

  it('ordena os membros, independente de quem convidou', () => {
    expect(birth.members).toEqual([ALICE, BOB]);
    expect(birth.id).toBe('alice-uid_bob-uid');
  });

  it('registra quem convidou, não quem aceitou', () => {
    expect(birth.createdBy).toBe(BOB);
  });

  it('guarda o convite que a autorizou — é como a regra prova o consentimento', () => {
    expect(birth.bornFromInvite).toBe('AB3D4F7H');
  });

  it('nasce ativa — "pending" não existe como parceria', () => {
    expect(birth.status).toBe('active');
  });

  it('concede o XParceria de nascimento e deixa a barra a um passo do nível 2', () => {
    expect(birth.xparceria).toBe(XP.PARTNERSHIP_BORN);
    expect(birth.level).toBe(1);
    expect(birth.xpIntoLevel).toBe(100);
    expect(birth.xpForNextLevel).toBe(122);
  });

  it('nasce morna, com a banda derivada da temperatura e não digitada à mão', () => {
    expect(birth.temperature).toBe(TEMPERATURE.INITIAL);
    expect(birth.temperatureBand).toBe('mild');
  });

  it('desnormaliza os dois perfis', () => {
    expect(birth.memberProfiles).toEqual({ [ALICE]: aliceProfile, [BOB]: bobProfile });
  });

  it('zera streak e stats e concede a conquista do começo', () => {
    expect(birth.streak).toEqual({ current: 0, longest: 0, lastDay: null, freezesLeft: 2 });
    expect(birth.stats.encounterCount).toBe(0);
    expect(birth.stats.lastEncounterAt).toBeNull();
    expect(birth.achievements).toEqual(['o-comeco']);
    expect(birth.superPartnershipId).toBeNull();
  });

  it('não carrega timestamp — quem escreve é que decide o relógio', () => {
    expect(birth).not.toHaveProperty('createdAt');
    expect(birth).not.toHaveProperty('activatedAt');
    expect(birth).not.toHaveProperty('updatedAt');
  });
});

describe('buildReactivationUpdate', () => {
  const update = buildReactivationUpdate({ [ALICE]: aliceProfile, [BOB]: bobProfile }, 'NEWCODE1');

  it('volta a ficar ativa e morna', () => {
    expect(update.status).toBe('active');
    expect(update.temperature).toBe(TEMPERATURE.INITIAL);
    expect(update.temperatureBand).toBe('mild');
  });

  it('registra o convite novo que autorizou a volta', () => {
    expect(update.bornFromInvite).toBe('NEWCODE1');
  });

  it('não toca em XParceria, nível nem conquistas — nada é perdido', () => {
    expect(update).not.toHaveProperty('xparceria');
    expect(update).not.toHaveProperty('level');
    expect(update).not.toHaveProperty('achievements');
    expect(update).not.toHaveProperty('stats');
  });

  it('não mexe no aniversário da parceria', () => {
    expect(update).not.toHaveProperty('activatedAt');
  });
});
```

- [ ] **Step 2: Escrever `shared/__tests__/invite.test.ts`**

```ts
import {
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_TTL_MS,
  checkInvite,
  generateInviteCode,
  normalizeInviteCode,
} from '../invite';

describe('INVITE_ALPHABET', () => {
  it('tem 32 caracteres e nenhum ambíguo — o código é digitado à mão', () => {
    expect(INVITE_ALPHABET).toHaveLength(32);
    for (const c of 'ILOU') expect(INVITE_ALPHABET).not.toContain(c);
  });

  it('não repete caractere', () => {
    expect(new Set(INVITE_ALPHABET).size).toBe(32);
  });
});

describe('generateInviteCode', () => {
  it('tem o comprimento definido e só usa o alfabeto', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    for (const c of code) expect(INVITE_ALPHABET).toContain(c);
  });

  it('mapeia o gerador aleatório para o alfabeto inteiro', () => {
    expect(generateInviteCode(() => 0)).toBe('0'.repeat(INVITE_CODE_LENGTH));
    expect(generateInviteCode(() => 0.9999)).toBe('Z'.repeat(INVITE_CODE_LENGTH));
  });

  it('não repete em 500 gerações', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateInviteCode()));
    expect(codes.size).toBe(500);
  });
});

describe('normalizeInviteCode', () => {
  it('sobe para maiúsculas e remove espaço e hífen', () => {
    expect(normalizeInviteCode(' ab3d-4f7h ')).toBe('AB3D4F7H');
  });

  it('corrige os caracteres que o alfabeto exclui, em vez de recusar', () => {
    // Quem lê o código em voz alta erra I/1 e O/0. Recusar seria hostil.
    expect(normalizeInviteCode('IL0O')).toBe('1100');
    expect(normalizeInviteCode('u')).toBe('V');
  });
});

describe('checkInvite', () => {
  const NOW = 1_754_000_000_000;
  // Não existe campo `expiresAt`: o vencimento é derivado de createdAt + 7d.
  // O cliente não consegue prever `request.time`, então um expiresAt gravado
  // seria impossível de fixar por regra — e um convite eterno é o abuso óbvio.
  const base = {
    fromUid: 'bob-uid',
    usedBy: null,
    status: 'pending' as const,
    createdAtMs: NOW - 1000,
  };

  it('aceita convite válido de outra pessoa', () => {
    expect(checkInvite(base, 'alice-uid', NOW)).toBeNull();
  });

  it('aceita no último instante antes dos 7 dias', () => {
    expect(checkInvite({ ...base, createdAtMs: NOW - INVITE_TTL_MS + 1 }, 'alice-uid', NOW)).toBeNull();
  });

  it('recusa exatamente aos 7 dias', () => {
    expect(checkInvite({ ...base, createdAtMs: NOW - INVITE_TTL_MS }, 'alice-uid', NOW)).toBe('expired');
  });

  it('recusa convite já usado', () => {
    expect(checkInvite({ ...base, usedBy: 'carol-uid', status: 'accepted' }, 'alice-uid', NOW)).toBe('used');
  });

  it('recusa quem tenta aceitar o próprio convite', () => {
    expect(checkInvite(base, 'bob-uid', NOW)).toBe('self');
  });

  it('checa o auto-convite antes da expiração — a mensagem certa importa mais', () => {
    expect(checkInvite({ ...base, createdAtMs: NOW - INVITE_TTL_MS }, 'bob-uid', NOW)).toBe('self');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- shared/__tests__/partnership.test.ts shared/__tests__/invite.test.ts`
Expected: FAIL — `Cannot find module '../partnership'` e `'../invite'`.

- [ ] **Step 4: Estender `shared/types.ts`**

Acrescente, preservando o que já existe:

```ts
export type PartnershipStatus = 'active' | 'hibernating' | 'paused' | 'ended';

export type EventType =
  | 'partnership_born'
  | 'partnership_paused'
  | 'partnership_resumed'
  | 'partnership_ended'
  | 'encounter'
  | 'level_up'
  | 'mission_completed'
  | 'achievement'
  | 'streak_milestone'
  | 'anniversary'
  | 'super_born';

export const LIFECYCLE_EVENT_TYPES = [
  'partnership_born',
  'partnership_paused',
  'partnership_resumed',
  'partnership_ended',
] as const;

export interface MemberProfile {
  displayName: string;
  photoURL: string | null;
  avatarEmoji: string;
}

export interface PartnershipStreak {
  current: number;
  longest: number;
  lastDay: string | null; // null no nascimento: não existe dia anterior
  freezesLeft: number;
}

export interface PartnershipStats {
  encounterCount: number;
  totalMinutesTogether: number;
  lastEncounterAt: unknown | null;
  daysSinceLastEncounter: number;
  firstEncounterAt: unknown | null;
  longestEncounterMinutes: number;
  maxDistanceKm: number;
  placesVisited: number;
}

export interface PartnershipDoc {
  id: string;
  members: [string, string];
  memberProfiles: Record<string, MemberProfile>;
  status: PartnershipStatus;
  createdBy: string;
  bornFromInvite: string;
  createdAt: unknown;
  activatedAt: unknown;
  xparceria: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  temperature: number;
  temperatureBand: TemperatureBandId;
  streak: PartnershipStreak;
  stats: PartnershipStats;
  achievements: string[];
  superPartnershipId: string | null;
  updatedAt: unknown;
}

export interface PartnershipEvent {
  type: EventType;
  occurredAt: unknown;
  xpAwarded: number;
}

export interface InviteFromProfile extends MemberProfile {
  handle: string;
}

/**
 * Sem `expiresAt`: o cliente não consegue prever `request.time`, então um
 * campo de vencimento gravado seria impossível de fixar por regra — e um
 * convite que nunca expira é o abuso óbvio. O vencimento é derivado de
 * `createdAt + INVITE_TTL_MS`, no cliente e na regra.
 */
export interface InviteDoc {
  code: string;
  fromUid: string;
  fromProfile: InviteFromProfile;
  createdAt: unknown;
  usedBy: string | null;
  status: 'pending' | 'accepted';
  maxUses: 1;
}

export const ACHIEVEMENT_FIRST_PARTNERSHIP = 'o-comeco';

/** Fixado na regra de `events`. Tipo fora desta tabela é negado por omissão. */
export const LIFECYCLE_EVENT_XP: Record<(typeof LIFECYCLE_EVENT_TYPES)[number], number> = {
  partnership_born: 100,
  partnership_paused: 0,
  partnership_resumed: 0,
  partnership_ended: 0,
};
```

`'pending'` **sai** de `PartnershipStatus`: o `pid` depende dos dois uids, e o segundo só existe no aceite.

- [ ] **Step 5: Implementar `shared/partnership.ts`**

```ts
import { TEMPERATURE, XP } from './constants';
import { xpForNextLevel } from './level';
import { bandForTemperature } from './temperature';
import {
  ACHIEVEMENT_FIRST_PARTNERSHIP,
  type MemberProfile,
  type PartnershipDoc,
  type TemperatureBandId,
} from './types';

/** O que o construtor devolve: tudo menos os campos de relógio. */
export type BirthPartnership = Omit<PartnershipDoc, 'createdAt' | 'activatedAt' | 'updatedAt'>;

export interface BirthInput {
  inviter: { uid: string; profile: MemberProfile };
  accepter: { uid: string; profile: MemberProfile };
  inviteCode: string;
}

export interface ReactivationUpdate {
  status: 'active';
  temperature: number;
  temperatureBand: TemperatureBandId;
  memberProfiles: Record<string, MemberProfile>;
  bornFromInvite: string;
}

/**
 * Id determinístico: duas pessoas se convidando ao mesmo tempo geram o mesmo
 * documento, e a segunda escrita falha sozinha. Sem transação de deduplicação.
 */
export function partnershipId(a: string, b: string): string {
  if (a === b) throw new Error('Parceria exige duas pessoas, não a mesma pessoa duas vezes.');
  return [a, b].sort().join('_');
}

export function buildBirthPartnership({
  inviter,
  accepter,
  inviteCode,
}: BirthInput): BirthPartnership {
  const id = partnershipId(inviter.uid, accepter.uid);
  const members = [inviter.uid, accepter.uid].sort() as [string, string];
  const temperature = TEMPERATURE.INITIAL;

  return {
    id,
    members,
    memberProfiles: {
      [inviter.uid]: inviter.profile,
      [accepter.uid]: accepter.profile,
    },
    status: 'active',
    createdBy: inviter.uid,
    bornFromInvite: inviteCode,
    xparceria: XP.PARTNERSHIP_BORN,
    level: 1,
    xpIntoLevel: XP.PARTNERSHIP_BORN,
    xpForNextLevel: xpForNextLevel(1),
    temperature,
    temperatureBand: bandForTemperature(temperature).id,
    streak: { current: 0, longest: 0, lastDay: null, freezesLeft: 2 },
    stats: {
      encounterCount: 0,
      totalMinutesTogether: 0,
      lastEncounterAt: null,
      daysSinceLastEncounter: 0,
      firstEncounterAt: null,
      longestEncounterMinutes: 0,
      maxDistanceKm: 0,
      placesVisited: 0,
    },
    achievements: [ACHIEVEMENT_FIRST_PARTNERSHIP],
    superPartnershipId: null,
  };
}

/**
 * Reaceite de parceria encerrada. XParceria, nível, conquistas e timeline
 * ficam intactos — "XParceria nunca é perdido" é princípio fundador.
 * `activatedAt` não entra: o aniversário é o do nascimento original.
 */
export function buildReactivationUpdate(
  memberProfiles: Record<string, MemberProfile>,
  inviteCode: string,
): ReactivationUpdate {
  const temperature = TEMPERATURE.INITIAL;
  return {
    status: 'active',
    temperature,
    temperatureBand: bandForTemperature(temperature).id,
    memberProfiles,
    bornFromInvite: inviteCode,
  };
}
```

- [ ] **Step 6: Implementar `shared/invite.ts`**

```ts
/** Base32 de Crockford: sem I, L, O e U. O código é digitado à mão. */
export const INVITE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 8;
export const INVITE_TTL_DAYS = 7;
export const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

export type InviteRejection = 'expired' | 'used' | 'self';

export interface InviteCheckInput {
  fromUid: string;
  usedBy: string | null;
  status: 'pending' | 'accepted';
  createdAtMs: number;
}

export function generateInviteCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_ALPHABET[Math.floor(random() * INVITE_ALPHABET.length)];
  }
  return code;
}

/**
 * Corrige o que a pessoa erra ao digitar em vez de recusar: I e L viram 1,
 * O vira 0, U vira V — exatamente os caracteres que o alfabeto exclui.
 */
export function normalizeInviteCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V');
}

export function checkInvite(
  invite: InviteCheckInput,
  accepterUid: string,
  nowMs: number,
): InviteRejection | null {
  // O auto-convite vem primeiro: para quem convidou, "esse convite é seu" é
  // melhor que "expirou", mesmo quando as duas coisas são verdade.
  if (invite.fromUid === accepterUid) return 'self';
  if (invite.usedBy !== null || invite.status === 'accepted') return 'used';
  if (invite.createdAtMs + INVITE_TTL_MS <= nowMs) return 'expired';
  return null;
}
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npm test -- shared/__tests__/partnership.test.ts shared/__tests__/invite.test.ts`
Expected: PASS, ~32 testes.

- [ ] **Step 8: Provar que os testes conseguem falhar**

Três mutações, uma de cada vez, desfazendo antes da próxima. Cada uma **tem** de quebrar algum teste:

1. `buildBirthPartnership`: trocar `temperatureBand: bandForTemperature(temperature).id` por `'warm'`.
2. `checkInvite`: mover a checagem de `self` para depois da de `expired`.
3. `partnershipId`: remover o `.sort()`.

- [ ] **Step 9: `tsc` e commit**

```bash
npm run typecheck
git add shared/ && git commit -m "feat: add partnership and invite domain to shared"
```

---

## Task 2: Regras de `invites`

A coleção deixa de ser livre. Hoje qualquer autenticado lê qualquer convite, varre a coleção e cria convites exibindo o nome de outra pessoa — o vetor de engenharia social mais óbvio de um produto de convite.

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/factories.ts`
- Rewrite: `tests/rules/invites.test.ts`

**Interfaces:**
- Consumes: `tests/rules/helpers.ts` (`createTestEnv`, `ALICE`, `BOB`, `CAROL`, `validProfile`)
- Produces: `tests/rules/factories.ts` → `validInvite(fromUid, overrides?)`, `validPartnership(a, b, code, overrides?)`, `seedUsers(env, uids)`, `seedInvite(env, code, data)`

- [ ] **Step 1: Criar as fábricas**

`tests/rules/factories.ts` — cada teste de negação parte de um documento **válido** e muda **um** campo. Sem isso, um teste passa por motivo errado (o documento era inválido em dois lugares, e a regra recusou pelo outro).

```ts
import { serverTimestamp } from 'firebase/firestore';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { validProfile } from './helpers';

export function validInvite(fromUid: string, overrides: Record<string, unknown> = {}) {
  const p = validProfile(fromUid, fromUid.replace(/-/g, ''));
  return {
    code: 'AB3D4F7H',
    fromUid,
    fromProfile: {
      displayName: p.displayName,
      photoURL: p.photoURL,
      avatarEmoji: p.avatarEmoji,
      handle: p.handle,
    },
    createdAt: serverTimestamp(),
    usedBy: null,
    status: 'pending',
    maxUses: 1,
    ...overrides,
  };
}

export function validPartnership(
  inviterUid: string,
  accepterUid: string,
  code: string,
  overrides: Record<string, unknown> = {},
) {
  const members = [inviterUid, accepterUid].sort();
  const profileOf = (uid: string) => {
    const p = validProfile(uid, uid.replace(/-/g, ''));
    return { displayName: p.displayName, photoURL: p.photoURL, avatarEmoji: p.avatarEmoji };
  };
  return {
    id: members.join('_'),
    members,
    memberProfiles: { [members[0]!]: profileOf(members[0]!), [members[1]!]: profileOf(members[1]!) },
    status: 'active',
    createdBy: inviterUid,
    bornFromInvite: code,
    createdAt: serverTimestamp(),
    activatedAt: serverTimestamp(),
    xparceria: 100,
    level: 1,
    xpIntoLevel: 100,
    xpForNextLevel: 122,
    temperature: 50,
    temperatureBand: 'mild',
    streak: { current: 0, longest: 0, lastDay: null, freezesLeft: 2 },
    stats: {
      encounterCount: 0,
      totalMinutesTogether: 0,
      lastEncounterAt: null,
      daysSinceLastEncounter: 0,
      firstEncounterAt: null,
      longestEncounterMinutes: 0,
      maxDistanceKm: 0,
      placesVisited: 0,
    },
    achievements: ['o-comeco'],
    superPartnershipId: null,
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

/** Semeia por fora das regras — `matchesOwnProfile` faz get em users. */
export async function seedUsers(env: RulesTestEnvironment, uids: string[]) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const uid of uids) {
      await ctx.firestore().doc(`users/${uid}`).set(validProfile(uid, uid.replace(/-/g, '')));
    }
  });
}

export async function seedInvite(
  env: RulesTestEnvironment,
  code: string,
  data: Record<string, unknown>,
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`invites/${code}`).set({ ...data, createdAt: new Date() });
  });
}
```

- [ ] **Step 2: Reescrever `tests/rules/invites.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase/firestore';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedInvite, seedUsers, validInvite } from './factories';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
});

describe('invites — create', () => {
  it('PERMITE que a pessoa crie o próprio convite', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(alice.doc('invites/AB3D4F7H').set(validInvite(ALICE)));
  });

  it('NEGA criar convite em nome de outra pessoa', async () => {
    // Uma variável só: o fromProfile continua sendo o da Alice, então a
    // negação prova `isOwner(fromUid)` e não `matchesOwnProfile`. Trocar os
    // dois de uma vez faria o teste passar por qualquer um dos dois motivos.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('invites/AB3D4F7H').set(validInvite(ALICE, { fromUid: BOB })));
  });

  it('NEGA forjar o displayName no fromProfile', async () => {
    // O vetor de engenharia social: convite que diz vir de outra pessoa.
    const alice = env.authenticatedContext(ALICE).firestore();
    const forged = validInvite(ALICE);
    forged.fromProfile.displayName = 'Bob';
    await assertFails(alice.doc('invites/AB3D4F7H').set(forged));
  });

  it('NEGA forjar o handle no fromProfile', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const forged = validInvite(ALICE);
    forged.fromProfile.handle = 'bob';
    await assertFails(alice.doc('invites/AB3D4F7H').set(forged));
  });

  it('NEGA createdAt escolhido pelo cliente', async () => {
    // Sem isso, dava para criar um convite com data futura e nunca expirar.
    const alice = env.authenticatedContext(ALICE).firestore();
    const future = Timestamp.fromMillis(Date.now() + 30 * 86_400_000);
    await assertFails(alice.doc('invites/AB3D4F7H').set(validInvite(ALICE, { createdAt: future })));
  });

  it('NEGA nascer já usado', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('invites/AB3D4F7H').set(validInvite(ALICE, { usedBy: BOB })));
  });

  it('NEGA nascer com status accepted', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('invites/AB3D4F7H').set(validInvite(ALICE, { status: 'accepted' })));
  });

  it('NEGA maxUses diferente de 1', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('invites/AB3D4F7H').set(validInvite(ALICE, { maxUses: 99 })));
  });

  it('NEGA criação a quem não está autenticado', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(anon.doc('invites/AB3D4F7H').set(validInvite(ALICE)));
  });
});

describe('invites — read', () => {
  beforeEach(() => seedInvite(env, 'AB3D4F7H', validInvite(ALICE)));

  it('PERMITE ler um convite específico — é assim que o convidado vê quem o chamou', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.doc('invites/AB3D4F7H').get());
  });

  it('NEGA listar a coleção — com o código se lê um; sem ele não se varre', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.collection('invites').get());
  });

  it('NEGA leitura a quem não está autenticado', async () => {
    await assertFails(env.unauthenticatedContext().firestore().doc('invites/AB3D4F7H').get());
  });
});

describe('invites — update', () => {
  beforeEach(() => seedInvite(env, 'AB3D4F7H', validInvite(ALICE)));

  it('PERMITE que o convidado marque como usado', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.doc('invites/AB3D4F7H').update({ usedBy: BOB, status: 'accepted' }));
  });

  it('NEGA marcar como usado em nome de outra pessoa', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc('invites/AB3D4F7H').update({ usedBy: CAROL, status: 'accepted' }));
  });

  it('NEGA que o dono aceite o próprio convite', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('invites/AB3D4F7H').update({ usedBy: ALICE, status: 'accepted' }));
  });

  it('NEGA reusar convite já aceito', async () => {
    await seedInvite(env, 'USED1234', validInvite(ALICE, { usedBy: CAROL, status: 'accepted' }));
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc('invites/USED1234').update({ usedBy: BOB, status: 'accepted' }));
  });

  it('NEGA mexer em qualquer campo além de usedBy e status', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc('invites/AB3D4F7H').update({ usedBy: BOB, status: 'accepted', fromUid: BOB }),
    );
  });

  it('NEGA delete', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('invites/AB3D4F7H').delete());
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run test:rules`
Expected: FAIL na maioria dos casos de negação — a regra atual permite quase tudo.

- [ ] **Step 4: Escrever as regras**

Em `firestore.rules`, acrescente o helper junto dos que já existem:

```js
    function userDoc(uid) {
      return get(/databases/$(database)/documents/users/$(uid)).data;
    }

    // Sem isto, qualquer um geraria um convite exibindo o nome e a foto de
    // outra pessoa — o vetor de engenharia social mais óbvio deste produto.
    function matchesOwnProfile(p) {
      let u = userDoc(request.auth.uid);
      return p.displayName == u.displayName
          && p.photoURL == u.photoURL
          && p.avatarEmoji == u.avatarEmoji
          && p.handle == u.handle;
    }
```

E substitua o bloco `invites` inteiro:

```js
    // ---- invites -------------------------------------------------------
    // Não há campo `expiresAt`: o cliente não consegue prever request.time,
    // então um vencimento gravado seria impossível de conferir — e convite
    // eterno é o abuso óbvio. Vencimento = createdAt + 7d, derivado.
    match /invites/{code} {
      // `get` sim, `list` não: com o código se lê um convite; sem ele não se
      // varre a coleção. São 32^8 ≈ 1,1 trilhão de códigos.
      allow get:  if isSignedIn();
      allow list: if false;

      allow create: if isOwner(request.resource.data.fromUid)
                    && request.resource.data.code == code
                    && request.resource.data.usedBy == null
                    && request.resource.data.status == 'pending'
                    && request.resource.data.maxUses == 1
                    && request.resource.data.createdAt == request.time
                    && matchesOwnProfile(request.resource.data.fromProfile);

      // Só a transição pendente → usado, e só por quem não é o dono.
      allow update: if isSignedIn()
                    && resource.data.usedBy == null
                    && resource.data.status == 'pending'
                    && request.auth.uid != resource.data.fromUid
                    && request.resource.data.usedBy == request.auth.uid
                    && request.resource.data.status == 'accepted'
                    && request.resource.data.diff(resource.data)
                         .affectedKeys().hasOnly(['usedBy', 'status']);

      allow delete: if false;
    }
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm run test:rules`
Expected: PASS — os 18 casos novos de `invites` mais os da Spec 1.

- [ ] **Step 6: Mutar cada regra e ver o teste certo quebrar**

Uma por vez, desfazendo antes da próxima. Cada mutação **tem** de quebrar o teste indicado:

| Mutação | Teste que deve quebrar |
|---|---|
| `allow list: if isSignedIn()` | "NEGA listar a coleção" |
| remover `&& matchesOwnProfile(...)` | "NEGA forjar o displayName no fromProfile" |
| `createdAt is timestamp` no lugar de `== request.time` | "NEGA createdAt escolhido pelo cliente" |
| remover `&& request.auth.uid != resource.data.fromUid` do update | "NEGA que o dono aceite o próprio convite" |
| `hasOnly(['usedBy','status','fromUid'])` | "NEGA mexer em qualquer campo além de usedBy e status" |
| remover `&& resource.data.usedBy == null` do update | "NEGA reusar convite já aceito" |

- [ ] **Step 7: Commit**

```bash
git add firestore.rules tests/rules/
git commit -m "feat: lock invites collection to owner-created, single-use documents"
```

---

## Task 3: Regra de nascimento da parceria

A regra mais importante do produto. Ela responde a uma pergunta: *o que impede a Carol de criar uma parceria com a Alice sem que a Alice queira?*

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/partnership-create.test.ts`

**Interfaces:**
- Consumes: `tests/rules/factories.ts` (Task 2)
- Produces: nada consumido por outras tasks de código; a Task 7 depende do formato aceito

- [ ] **Step 1: Escrever `tests/rules/partnership-create.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase/firestore';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedInvite, seedUsers, validInvite, validPartnership } from './factories';

let env: RulesTestEnvironment;

const CODE = 'AB3D4F7H';
const PID = [ALICE, BOB].sort().join('_');

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
  // Convite da Alice, pendente e recente. Bob é quem aceita.
  await seedInvite(env, CODE, validInvite(ALICE));
});

/** Bob aceitando o convite da Alice, com um campo trocado. */
function bobAccepts(overrides: Record<string, unknown> = {}) {
  const bob = env.authenticatedContext(BOB).firestore();
  return bob.doc(`partnerships/${PID}`).set(validPartnership(ALICE, BOB, CODE, overrides));
}

describe('nascimento — o caminho que deve funcionar', () => {
  it('PERMITE que o convidado crie a parceria com o convite válido', async () => {
    await assertSucceeds(bobAccepts());
  });
});

describe('nascimento — consentimento', () => {
  it('NEGA criar parceria sem apontar para convite nenhum', async () => {
    await assertFails(bobAccepts({ bornFromInvite: 'NAOEXISTE' }));
  });

  it('NEGA usar convite de terceiro para virar parceiro de quem não convidou', async () => {
    // Convite da Carol, mas Bob tenta virar parceiro da Alice com ele.
    await seedInvite(env, 'CAROLCOD', validInvite(CAROL));
    await assertFails(bobAccepts({ bornFromInvite: 'CAROLCOD' }));
  });

  it('NEGA convite já usado', async () => {
    await seedInvite(env, 'USED1234', validInvite(ALICE, { usedBy: CAROL, status: 'accepted' }));
    await assertFails(bobAccepts({ bornFromInvite: 'USED1234' }));
  });

  it('NEGA convite com mais de 7 dias', async () => {
    const old = Timestamp.fromMillis(Date.now() - 8 * 86_400_000);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('invites/OLDCODE1').set({ ...validInvite(ALICE), createdAt: old });
    });
    await assertFails(bobAccepts({ bornFromInvite: 'OLDCODE1' }));
  });

  it('NEGA que o dono do convite crie a parceria sozinho', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      alice.doc(`partnerships/${PID}`).set(validPartnership(ALICE, BOB, CODE, { createdBy: BOB })),
    );
  });

  it('NEGA criar parceria entre duas outras pessoas', async () => {
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(carol.doc(`partnerships/${PID}`).set(validPartnership(ALICE, BOB, CODE)));
  });

  it('NEGA parceria consigo mesmo', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${BOB}_${BOB}`).set({
        ...validPartnership(ALICE, BOB, CODE),
        id: `${BOB}_${BOB}`,
        members: [BOB, BOB],
        createdBy: BOB,
      }),
    );
  });
});

describe('nascimento — integridade do id', () => {
  it('NEGA id que não corresponde aos membros ordenados', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc('partnerships/id-inventado').set(validPartnership(ALICE, BOB, CODE, { id: 'id-inventado' })),
    );
  });

  it('NEGA members fora de ordem — senão o mesmo par teria dois documentos', async () => {
    const reversed = [ALICE, BOB].sort().reverse();
    await assertFails(bobAccepts({ members: reversed }));
  });

  it('NEGA members com três pessoas', async () => {
    await assertFails(bobAccepts({ members: [ALICE, BOB, CAROL].sort() }));
  });
});

describe('nascimento — cada número é literal na regra', () => {
  const forjas: Array<[string, Record<string, unknown>]> = [
    ['xparceria', { xparceria: 999_999 }],
    ['level', { level: 42 }],
    ['xpIntoLevel', { xpIntoLevel: 121 }],
    ['xpForNextLevel', { xpForNextLevel: 1 }],
    ['temperature', { temperature: 100 }],
    ['temperatureBand', { temperatureBand: 'burning' }],
    ['status', { status: 'hibernating' }],
    ['achievements', { achievements: ['o-comeco', 'lenda'] }],
    ['superPartnershipId', { superPartnershipId: 'super-1' }],
    ['streak', { streak: { current: 99, longest: 99, lastDay: '2026-08-06', freezesLeft: 9 } }],
    ['stats.encounterCount', {
      stats: {
        encounterCount: 50, totalMinutesTogether: 9999, lastEncounterAt: null,
        daysSinceLastEncounter: 0, firstEncounterAt: null,
        longestEncounterMinutes: 0, maxDistanceKm: 0, placesVisited: 0,
      },
    }],
  ];

  it.each(forjas)('NEGA forjar %s no nascimento', async (_campo, override) => {
    await assertFails(bobAccepts(override));
  });

  it('NEGA createdAt escolhido pelo cliente', async () => {
    await assertFails(bobAccepts({ createdAt: Timestamp.fromMillis(0) }));
  });

  it('NEGA activatedAt escolhido pelo cliente', async () => {
    await assertFails(bobAccepts({ activatedAt: Timestamp.fromMillis(0) }));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:rules`
Expected: FAIL — a regra atual é `allow create: if false`, então até o caminho feliz falha.

- [ ] **Step 3: Escrever as regras**

Helpers novos em `firestore.rules`:

```js
    function inviteAuthorizes(code, inviterUid, accepterUid) {
      let inv = get(/databases/$(database)/documents/invites/$(code)).data;
      return inv.fromUid == inviterUid
          && inv.fromUid != accepterUid
          && inv.usedBy == null
          && inv.status == 'pending'
          && inv.createdAt + duration.value(7, 'd') > request.time;
    }

    // members[0] < members[1] garante ordem E proíbe parceria consigo mesmo.
    function pidMatches(pid, members) {
      return members.size() == 2
          && members[0] < members[1]
          && pid == members[0] + '_' + members[1];
    }

    function zeroStreak() {
      return { 'current': 0, 'longest': 0, 'lastDay': null, 'freezesLeft': 2 };
    }

    function zeroPartnershipStats() {
      return {
        'encounterCount': 0,
        'totalMinutesTogether': 0,
        'lastEncounterAt': null,
        'daysSinceLastEncounter': 0,
        'firstEncounterAt': null,
        'longestEncounterMinutes': 0,
        'maxDistanceKm': 0,
        'placesVisited': 0
      };
    }
```

E a regra de create, substituindo o `allow create, update, delete: if false;` atual:

```js
      // Todo valor é literal. Sem servidor, esta regra É o servidor: é o que
      // impede um número inventado de entrar no produto cuja moeda é o número.
      allow create: if isSignedIn()
                    && pidMatches(pid, request.resource.data.members)
                    && request.resource.data.id == pid
                    && request.auth.uid in request.resource.data.members
                    && request.resource.data.createdBy in request.resource.data.members
                    && request.resource.data.createdBy != request.auth.uid
                    && inviteAuthorizes(request.resource.data.bornFromInvite,
                                        request.resource.data.createdBy,
                                        request.auth.uid)
                    && request.resource.data.status == 'active'
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

      allow update, delete: if false;   // Task 4 abre o update
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:rules`
Expected: PASS — 24 casos novos.

- [ ] **Step 5: Mutar cada condição**

| Mutação | Teste que deve quebrar |
|---|---|
| remover `inviteAuthorizes(...)` | "NEGA criar parceria sem apontar para convite nenhum" |
| trocar `inv.fromUid == inviterUid` por `true` | "NEGA usar convite de terceiro..." |
| remover `inv.usedBy == null` | "NEGA convite já usado" |
| remover a checagem de 7 dias | "NEGA convite com mais de 7 dias" |
| remover `createdBy != request.auth.uid` | "NEGA que o dono do convite crie a parceria sozinho" |
| remover `request.auth.uid in members` | "NEGA criar parceria entre duas outras pessoas" |
| trocar `members[0] < members[1]` por `<=` | "NEGA parceria consigo mesmo" |
| remover `id == pid` | "NEGA id que não corresponde aos membros ordenados" |
| trocar `xparceria == 100` por `>= 0` | "NEGA forjar xparceria no nascimento" |
| remover `streak == zeroStreak()` | "NEGA forjar streak no nascimento" |

- [ ] **Step 6: Commit**

```bash
git add firestore.rules tests/rules/
git commit -m "feat: pin every partnership birth value in security rules"
```

---

## Task 4: Regras de ciclo de vida, reativação e eventos

Três ramos de `update`, disjuntos por `affectedKeys().hasOnly(...)`, mais a timeline. Misturar os ramos num só é como se abre um buraco sem perceber.

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/partnership-update.test.ts`, `tests/rules/events.test.ts`

**Interfaces:**
- Consumes: `tests/rules/factories.ts` (Task 2)
- Produces: contrato de escrita que as Tasks 7 e 8 vão exercer

- [ ] **Step 1: Escrever `tests/rules/partnership-update.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { serverTimestamp } from 'firebase/firestore';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedInvite, seedUsers, validInvite, validPartnership } from './factories';

let env: RulesTestEnvironment;

const CODE = 'AB3D4F7H';
const PID = [ALICE, BOB].sort().join('_');

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

async function seedPartnership(status: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(`partnerships/${PID}`)
      .set({ ...validPartnership(ALICE, BOB, CODE), status, createdAt: new Date(), activatedAt: new Date(), updatedAt: new Date() });
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
});

describe('ciclo de vida', () => {
  const transicoes: Array<[string, string, boolean]> = [
    ['active', 'paused', true],
    ['paused', 'active', true],
    ['active', 'ended', true],
    ['paused', 'ended', true],
    ['ended', 'active', false],   // volta é por convite novo, não por update
    ['ended', 'paused', false],
    ['active', 'hibernating', false], // hibernação é do motor, na Spec 4
    ['active', 'active', false],
  ];

  it.each(transicoes)('%s → %s permitido: %s', async (from, to, permitido) => {
    await seedPartnership(from);
    const bob = env.authenticatedContext(BOB).firestore();
    const write = bob.doc(`partnerships/${PID}`).update({ status: to, updatedAt: serverTimestamp() });
    await (permitido ? assertSucceeds(write) : assertFails(write));
  });

  it('NEGA que não-membro mude o status', async () => {
    await seedPartnership('active');
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(
      carol.doc(`partnerships/${PID}`).update({ status: 'ended', updatedAt: serverTimestamp() }),
    );
  });

  it('NEGA carona: mudar status e xparceria na mesma escrita', async () => {
    // O buraco clássico. hasOnly(['status','updatedAt']) é o que fecha.
    await seedPartnership('active');
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${PID}`)
        .update({ status: 'paused', xparceria: 999_999, updatedAt: serverTimestamp() }),
    );
  });

  it('NEGA updatedAt escolhido pelo cliente', async () => {
    await seedPartnership('active');
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).update({ status: 'paused', updatedAt: new Date(0) }));
  });

  it('NEGA delete — encerrar é mudar status, nunca apagar', async () => {
    await seedPartnership('active');
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).delete());
  });
});

describe('reativação de parceria encerrada', () => {
  const reativa = () => ({
    status: 'active',
    temperature: 50,
    temperatureBand: 'mild',
    bornFromInvite: 'NEWCODE1',
    updatedAt: serverTimestamp(),
  });

  beforeEach(async () => {
    await seedPartnership('ended');
    await seedInvite(env, 'NEWCODE1', validInvite(ALICE));
  });

  it('PERMITE reativar com convite novo e válido do outro membro', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.doc(`partnerships/${PID}`).update(reativa()));
  });

  it('NEGA reativar sem convite válido', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).update({ ...reativa(), bornFromInvite: 'NAOEXISTE' }));
  });

  it('NEGA reativar com o próprio convite', async () => {
    await seedInvite(env, 'BOBCODE1', validInvite(BOB));
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).update({ ...reativa(), bornFromInvite: 'BOBCODE1' }));
  });

  it('NEGA reconceder XParceria na volta — nada é perdido, nada é ganho de graça', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).update({ ...reativa(), xparceria: 200 }));
  });

  it('NEGA temperatura diferente de 50 na volta', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).update({ ...reativa(), temperature: 100 }));
  });

  it('NEGA mexer no aniversário da parceria', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${PID}`).update({ ...reativa(), activatedAt: serverTimestamp() }),
    );
  });

  it('NEGA reativar parceria que está apenas pausada', async () => {
    await seedPartnership('paused');
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).update(reativa()));
  });
});

describe('propagação do próprio perfil', () => {
  beforeEach(() => seedPartnership('active'));

  it('PERMITE atualizar a própria entrada em memberProfiles', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(
      bob.doc(`partnerships/${PID}`).update({
        [`memberProfiles.${BOB}`]: { displayName: 'Bob Novo', photoURL: null, avatarEmoji: '🐢' },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('NEGA reescrever o perfil do outro membro', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${PID}`).update({
        [`memberProfiles.${ALICE}`]: { displayName: 'Alice Falsa', photoURL: null, avatarEmoji: '💀' },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('NEGA carona: perfil junto com status', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${PID}`).update({
        [`memberProfiles.${BOB}`]: { displayName: 'Bob', photoURL: null, avatarEmoji: '🐢' },
        status: 'ended',
        updatedAt: serverTimestamp(),
      }),
    );
  });
});
```

- [ ] **Step 2: Escrever `tests/rules/events.test.ts`**

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { serverTimestamp } from 'firebase/firestore';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedUsers, validPartnership } from './factories';

let env: RulesTestEnvironment;
const PID = [ALICE, BOB].sort().join('_');

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await fs.doc(`partnerships/${PID}`).set({
      ...validPartnership(ALICE, BOB, 'AB3D4F7H'),
      createdAt: new Date(), activatedAt: new Date(), updatedAt: new Date(),
    });
    await fs.doc(`partnerships/${PID}/events/born`).set({
      type: 'partnership_born', occurredAt: new Date(), xpAwarded: 100,
    });
  });
});

describe('events — leitura', () => {
  it('PERMITE a membro', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(alice.doc(`partnerships/${PID}/events/born`).get());
  });

  it('NEGA a não-membro', async () => {
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(carol.doc(`partnerships/${PID}/events/born`).get());
  });
});

describe('events — escrita', () => {
  const evento = (over: Record<string, unknown> = {}) => ({
    type: 'partnership_paused', occurredAt: serverTimestamp(), xpAwarded: 0, ...over,
  });

  it('PERMITE que membro grave evento de ciclo de vida', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.collection(`partnerships/${PID}/events`).add(evento()));
  });

  it('NEGA a não-membro', async () => {
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(carol.collection(`partnerships/${PID}/events`).add(evento()));
  });

  it('NEGA evento de encontro — XParceria de verdade é da Spec 4', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.collection(`partnerships/${PID}/events`).add(evento({ type: 'encounter' })));
  });

  it('NEGA encontro mesmo com xpAwarded zerado', async () => {
    // Fecha o furo do sentinel: sem `isLifecycleEvent`, um tipo desconhecido
    // com xpAwarded igual ao sentinel passaria.
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.collection(`partnerships/${PID}/events`).add(evento({ type: 'encounter', xpAwarded: 0 })),
    );
  });

  it('NEGA xpAwarded fora da tabela', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.collection(`partnerships/${PID}/events`).add(evento({ xpAwarded: 5000 })));
  });

  it('NEGA nascimento com xpAwarded diferente de 100', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.collection(`partnerships/${PID}/events`)
        .add(evento({ type: 'partnership_born', xpAwarded: 999 })),
    );
  });

  it('NEGA occurredAt escolhido pelo cliente', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.collection(`partnerships/${PID}/events`).add(evento({ occurredAt: new Date(0) })));
  });

  it('NEGA update — a timeline é append-only', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}/events/born`).update({ xpAwarded: 1 }));
  });

  it('NEGA delete', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}/events/born`).delete());
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run test:rules`
Expected: FAIL — `update` e escrita de evento estão em `if false`.

- [ ] **Step 4: Escrever as regras**

Helpers novos:

```js
    function otherMember(members) {
      return members[0] == request.auth.uid ? members[1] : members[0];
    }

    function allowedTransition(from, to) {
      return (from == 'active' && (to == 'paused' || to == 'ended'))
          || (from == 'paused' && (to == 'active' || to == 'ended'));
    }

    function isLifecycleEvent(t) {
      return t == 'partnership_born' || t == 'partnership_paused'
          || t == 'partnership_resumed' || t == 'partnership_ended';
    }

    // Só chamada depois de isLifecycleEvent — sem sentinel, sem furo.
    function lifecycleEventXp(t) {
      return t == 'partnership_born' ? 100 : 0;
    }

    // getAfter enxerga o estado PÓS-transação: é o que permite gravar o
    // evento de nascimento junto com a parceria que ainda está nascendo.
    function isMemberAfter(pid) {
      return isSignedIn() && request.auth.uid in
        getAfter(/databases/$(database)/documents/partnerships/$(pid)).data.members;
    }
```

Os três ramos de update, e o bloco de eventos:

```js
      allow update: if lifecycleUpdate() || reactivationUpdate() || profileUpdate();
      allow delete: if false;
```

com as funções, declaradas junto das outras:

```js
    function lifecycleUpdate() {
      return isMember(resource.data)
          && request.resource.data.diff(resource.data)
               .affectedKeys().hasOnly(['status', 'updatedAt'])
          && allowedTransition(resource.data.status, request.resource.data.status)
          && request.resource.data.updatedAt == request.time;
    }

    function reactivationUpdate() {
      return isMember(resource.data)
          && resource.data.status == 'ended'
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(
               ['status', 'temperature', 'temperatureBand', 'memberProfiles',
                'bornFromInvite', 'updatedAt'])
          && request.resource.data.status == 'active'
          && request.resource.data.temperature == 50
          && request.resource.data.temperatureBand == 'mild'
          && request.resource.data.updatedAt == request.time
          && inviteAuthorizes(request.resource.data.bornFromInvite,
                              otherMember(resource.data.members),
                              request.auth.uid);
    }

    function profileUpdate() {
      return isMember(resource.data)
          && request.resource.data.diff(resource.data)
               .affectedKeys().hasOnly(['memberProfiles', 'updatedAt'])
          && request.resource.data.memberProfiles.diff(resource.data.memberProfiles)
               .affectedKeys().hasOnly([request.auth.uid])
          && request.resource.data.updatedAt == request.time;
    }
```

E, **dentro** de `match /partnerships/{pid}`, antes do `match /{document=**}`:

```js
      // Quando duas regras casam com o mesmo caminho, o acesso é concedido se
      // QUALQUER uma permitir. Este bloco convive com o /{document=**} abaixo,
      // que continua negando escrita em days, missions e insights.
      match /events/{eventId} {
        allow read:   if isMember(partnership(pid));
        allow create: if isMemberAfter(pid)
                      && isLifecycleEvent(request.resource.data.type)
                      && request.resource.data.xpAwarded
                           == lifecycleEventXp(request.resource.data.type)
                      && request.resource.data.occurredAt == request.time;
        allow update, delete: if false;
      }
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm run test:rules`
Expected: PASS — ~30 casos novos, somando ~90 na suíte inteira.

- [ ] **Step 6: Mutar cada condição**

| Mutação | Teste que deve quebrar |
|---|---|
| `hasOnly(['status','updatedAt','xparceria'])` no `lifecycleUpdate` | "NEGA carona: mudar status e xparceria" |
| remover `allowedTransition(...)` | "ended → active permitido: false" |
| `hasOnly([request.auth.uid])` → `hasAny([request.auth.uid])` no `profileUpdate` | "NEGA reescrever o perfil do outro membro" |
| remover `resource.data.status == 'ended'` do `reactivationUpdate` | "NEGA reativar parceria que está apenas pausada" |
| remover `inviteAuthorizes` do `reactivationUpdate` | "NEGA reativar sem convite válido" |
| remover `isLifecycleEvent(...)` | "NEGA encontro mesmo com xpAwarded zerado" |
| trocar `isMemberAfter` por `isMember(partnership(pid))` | nenhum aqui — mas a Task 7 falha; anote e siga |
| `occurredAt is timestamp` no lugar de `== request.time` | "NEGA occurredAt escolhido pelo cliente" |

- [ ] **Step 7: Commit**

```bash
git add firestore.rules tests/rules/
git commit -m "feat: add partnership lifecycle, reactivation and timeline rules"
```

---

## Task 5: Ponte `onSnapshot` → React Query

O §6 do doc de produto pede um ponto único de integração entre o listener do Firestore e o cache do React Query. É a primeira vez que ele é necessário, e **nenhum componente vai chamar `onSnapshot` diretamente**.

**Files:**
- Create: `src/core/firebase/useFirestoreDoc.ts`, `src/core/firebase/useFirestoreCollection.ts`, `src/core/firebase/firestoreError.ts`
- Test: `src/core/firebase/__tests__/useFirestoreDoc.test.tsx`, `src/core/firebase/__tests__/firestoreError.test.ts`
- Modify: `jest.rules.config.js`

**Interfaces:**
- Produces:
  - `useFirestoreDoc<T>(ref: DocumentReference | null, key: QueryKey): UseQueryResult<T | null>`
  - `useFirestoreCollection<T>(q: Query | null, key: QueryKey): UseQueryResult<T[]>`
  - `firestoreErrorMessage(error: unknown): string`

- [ ] **Step 1: Preparar o Jest para os testes de integração das próximas tasks**

`jest.rules.config.js` — amplie o `testMatch` para cobrir `tests/integration/` também. O nome do script continua `test:rules`: é tudo teste que precisa do emulador.

```js
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
```

- [ ] **Step 2: Escrever `src/core/firebase/__tests__/firestoreError.test.ts`**

```ts
import { firestoreErrorMessage } from '../firestoreError';

describe('firestoreErrorMessage', () => {
  it('traduz permissão negada sem vazar o código', () => {
    const msg = firestoreErrorMessage({ code: 'permission-denied' });
    expect(msg).toBe('Você não tem acesso a isso.');
    expect(msg).not.toContain('permission');
  });

  it('traduz indisponibilidade como problema de conexão', () => {
    expect(firestoreErrorMessage({ code: 'unavailable' })).toBe('Sem conexão. Tenta de novo.');
  });

  it('cai numa mensagem genérica para código desconhecido', () => {
    expect(firestoreErrorMessage({ code: 'aborted' })).toBe('Algo deu errado. Tenta de novo.');
  });

  it('aguenta erro que não é do Firestore', () => {
    expect(firestoreErrorMessage(new Error('boom'))).toBe('Algo deu errado. Tenta de novo.');
  });
});
```

- [ ] **Step 3: Escrever `src/core/firebase/__tests__/useFirestoreDoc.test.tsx`**

O teste mocka `firebase/firestore` para provar o contrato da ponte sem emulador: o snapshot chega, o cache é atualizado, e o unsubscribe roda ao desmontar.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { ReactNode } from 'react';
import { useFirestoreDoc } from '../useFirestoreDoc';

const unsubscribe = jest.fn();
let emit: ((snap: unknown) => void) | null = null;

jest.mock('firebase/firestore', () => ({
  onSnapshot: (_ref: unknown, next: (snap: unknown) => void) => {
    emit = next;
    return unsubscribe;
  },
  getDoc: jest.fn(async () => ({ exists: () => false, data: () => undefined })),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function Probe() {
  const q = useFirestoreDoc<{ name: string }>({ id: 'x' } as never, ['probe']);
  return <Text testID="value">{q.data?.name ?? 'vazio'}</Text>;
}

beforeEach(() => {
  unsubscribe.mockClear();
  emit = null;
});

it('publica o snapshot no cache do React Query', async () => {
  await render(<Probe />, { wrapper });
  emit?.({ exists: () => true, data: () => ({ name: 'Alice' }) });
  await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('Alice'));
});

it('trata documento inexistente como null, não como carregando', async () => {
  await render(<Probe />, { wrapper });
  emit?.({ exists: () => false, data: () => undefined });
  await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('vazio'));
});

it('cancela a inscrição ao desmontar', async () => {
  const view = await render(<Probe />, { wrapper });
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -- src/core/firebase`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 5: Implementar**

`src/core/firebase/firestoreError.ts`:

```ts
const MESSAGES: Record<string, string> = {
  'permission-denied': 'Você não tem acesso a isso.',
  unavailable: 'Sem conexão. Tenta de novo.',
  'not-found': 'Não encontrei isso.',
  'already-exists': 'Isso já existe.',
  'deadline-exceeded': 'A conexão demorou demais. Tenta de novo.',
};

/** Nunca vaza o código cru do Firestore para a tela. */
export function firestoreErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  return (code !== undefined ? MESSAGES[code] : undefined) ?? 'Algo deu errado. Tenta de novo.';
}
```

`src/core/firebase/useFirestoreDoc.ts`:

```ts
import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { getDoc, onSnapshot, type DocumentReference } from 'firebase/firestore';

/**
 * Único ponto de integração entre o listener do Firestore e o cache do React
 * Query. O listener empurra para o cache; o componente lê pelo useQuery e não
 * sabe que existe tempo real. Nenhum componente chama onSnapshot direto.
 */
export function useFirestoreDoc<T>(
  ref: DocumentReference | null,
  key: QueryKey,
): UseQueryResult<T | null> {
  const qc = useQueryClient();

  useEffect(() => {
    if (ref === null) return;
    return onSnapshot(ref, (snap) => {
      qc.setQueryData<T | null>(key, snap.exists() ? (snap.data() as T) : null);
    });
    // `key` é serializável; a identidade do array muda a cada render.
  }, [ref?.path, qc, JSON.stringify(key)]);

  return useQuery<T | null>({
    queryKey: key,
    enabled: ref !== null,
    queryFn: async () => {
      const snap = await getDoc(ref!);
      return snap.exists() ? (snap.data() as T) : null;
    },
  });
}
```

`src/core/firebase/useFirestoreCollection.ts` — mesma forma, com `onSnapshot(q, ...)` e `getDocs`, devolvendo `snap.docs.map((d) => d.data() as T)` e `[]` quando vazio.

- [ ] **Step 6: Rodar, `tsc` e commit**

```bash
npm test -- src/core/firebase && npm run typecheck
git add src/core/firebase jest.rules.config.js
git commit -m "feat: bridge firestore snapshots into react query cache"
```

---

## Task 6: Serviço de convite — criar e ler

**Files:**
- Create: `src/features/invite/services/invites.ts`
- Test: `tests/integration/invite-create.test.ts`

**Interfaces:**
- Consumes: `shared/invite.ts`, `shared/types.ts` (Task 1)
- Produces:
  - `createInvite(db: Firestore, uid: string, profile: UserDoc): Promise<string>` → código
  - `readInvite(db: Firestore, code: string): Promise<InviteDoc | null>`
  - `inviteUrl(code: string, displayName: string): string`
  - `INVITE_LANDING_BASE`

> **Serviços recebem o `Firestore` por parâmetro** e nunca importam `@/core/firebase/client`. É o que permite testá-los contra o emulador em Node, onde `initializeAuth` com AsyncStorage quebraria.

- [ ] **Step 1: Escrever `tests/integration/invite-create.test.ts`**

```ts
import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { Firestore } from 'firebase/firestore';
import { INVITE_CODE_LENGTH } from '../../shared/invite';
import type { UserDoc } from '../../shared/types';
import { createInvite, inviteUrl, readInvite } from '../../src/features/invite/services/invites';
import { ALICE, BOB, createTestEnv, validProfile } from '../rules/helpers';
import { seedUsers } from '../rules/factories';

let env: RulesTestEnvironment;
const dbOf = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB]);
});

const aliceProfile = () => validProfile(ALICE, 'alice') as unknown as UserDoc;

describe('createInvite', () => {
  it('grava um convite pendente e devolve o código', async () => {
    const code = await createInvite(dbOf(ALICE), ALICE, aliceProfile());
    expect(code).toHaveLength(INVITE_CODE_LENGTH);

    const invite = await readInvite(dbOf(BOB), code);
    expect(invite).toMatchObject({ code, fromUid: ALICE, usedBy: null, status: 'pending', maxUses: 1 });
  });

  it('copia o perfil real de quem convida — a regra não aceita outro', async () => {
    const code = await createInvite(dbOf(ALICE), ALICE, aliceProfile());
    const invite = await readInvite(dbOf(BOB), code);
    expect(invite?.fromProfile.displayName).toBe(aliceProfile().displayName);
    expect(invite?.fromProfile.handle).toBe('alice');
  });

  it('gera códigos diferentes a cada chamada', async () => {
    const a = await createInvite(dbOf(ALICE), ALICE, aliceProfile());
    const b = await createInvite(dbOf(ALICE), ALICE, aliceProfile());
    expect(a).not.toBe(b);
  });

  it('devolve null para código inexistente, em vez de estourar', async () => {
    expect(await readInvite(dbOf(BOB), 'NAOEXIST')).toBeNull();
  });

  it('a regra impede convite com perfil de outra pessoa', async () => {
    const mentiroso = { ...aliceProfile(), displayName: 'Bob' };
    await assertFails(createInvite(dbOf(ALICE), ALICE, mentiroso));
  });
});

describe('inviteUrl', () => {
  it('leva o código e o nome, para a landing personalizar sem ler o banco', () => {
    const url = inviteUrl('AB3D4F7H', 'Alice Não-Sei-Quê');
    expect(url).toContain('c=AB3D4F7H');
    expect(url).toContain(encodeURIComponent('Alice Não-Sei-Quê'));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:rules`
Expected: FAIL — módulo de serviço inexistente.

- [ ] **Step 3: Implementar `src/features/invite/services/invites.ts`**

```ts
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { generateInviteCode } from '@shared/invite';
import type { InviteDoc, UserDoc } from '@shared/types';

export const INVITE_LANDING_BASE = 'https://parceria-db699.web.app';

export function inviteUrl(code: string, displayName: string): string {
  return `${INVITE_LANDING_BASE}/?c=${code}&de=${encodeURIComponent(displayName)}`;
}

/**
 * Unicidade vem da semântica de create do Firestore: a regra proíbe update,
 * então uma colisão simplesmente falha e a gente tenta outro código. Com
 * 32^8 combinações, a colisão é teórica — o retry existe para que, se
 * acontecer, não vire erro na cara de ninguém.
 */
export async function createInvite(db: Firestore, uid: string, profile: UserDoc): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const invite = {
      code,
      fromUid: uid,
      fromProfile: {
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        avatarEmoji: profile.avatarEmoji,
        handle: profile.handle,
      },
      createdAt: serverTimestamp(),
      usedBy: null,
      status: 'pending' as const,
      maxUses: 1 as const,
    };
    try {
      await setDoc(doc(db, 'invites', code), invite);
      return code;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function readInvite(db: Firestore, code: string): Promise<InviteDoc | null> {
  const snap = await getDoc(doc(db, 'invites', code));
  return snap.exists() ? (snap.data() as InviteDoc) : null;
}
```

> **Atenção ao teste "a regra impede convite com perfil de outra pessoa":** o `createInvite` engole a exceção no laço e relança a última. `assertFails` precisa receber uma `PERMISSION_DENIED` — confirme que é isso que chega, e não um erro genérico depois de 5 tentativas.

- [ ] **Step 4: Rodar, `tsc` e commit**

```bash
npm run test:rules && npm run typecheck
git add src/features/invite tests/integration
git commit -m "feat: add invite creation and read service"
```

---

## Task 7: Serviço de aceite — o nascimento numa transação

A task mais crítica do plano. Uma transação: cria a parceria, grava `events/born`, marca o convite como usado.

**Files:**
- Modify: `src/features/invite/services/invites.ts`
- Test: `tests/integration/invite-accept.test.ts`

**Interfaces:**
- Consumes: `shared/partnership.ts`, `shared/invite.ts`, Task 6
- Produces:
  - `acceptInvite(db, code, accepter: { uid, profile: UserDoc }): Promise<AcceptResult>`
  - `type AcceptResult = { pid: string; reactivated: boolean }`
  - `type AcceptRejection = InviteRejection | 'not-found' | 'already-partners'`
  - `class InviteRejectedError extends Error { readonly reason: AcceptRejection }`

- [ ] **Step 1: Escrever `tests/integration/invite-accept.test.ts`**

```ts
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, type Firestore } from 'firebase/firestore';
import { partnershipId } from '../../shared/partnership';
import type { UserDoc } from '../../shared/types';
import {
  InviteRejectedError,
  acceptInvite,
  createInvite,
} from '../../src/features/invite/services/invites';
import { ALICE, BOB, CAROL, createTestEnv, validProfile } from '../rules/helpers';
import { seedUsers } from '../rules/factories';

let env: RulesTestEnvironment;
const dbOf = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const profileOf = (uid: string) => validProfile(uid, uid.replace(/-/g, '')) as unknown as UserDoc;
const PID = partnershipId(ALICE, BOB);

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
});

async function aliceInvites() {
  return createInvite(dbOf(ALICE), ALICE, profileOf(ALICE));
}

describe('nascimento', () => {
  it('cria a parceria com os valores do domínio', async () => {
    const code = await aliceInvites();
    const result = await acceptInvite(dbOf(BOB), code, { uid: BOB, profile: profileOf(BOB) });

    expect(result).toEqual({ pid: PID, reactivated: false });

    const snap = await getDoc(doc(dbOf(BOB), 'partnerships', PID));
    expect(snap.data()).toMatchObject({
      members: [ALICE, BOB].sort(),
      status: 'active',
      createdBy: ALICE,
      bornFromInvite: code,
      xparceria: 100,
      level: 1,
      xpForNextLevel: 122,
      temperature: 50,
      temperatureBand: 'mild',
      achievements: ['o-comeco'],
    });
  });

  it('grava o evento de nascimento na mesma transação', async () => {
    // É o que getAfter() torna possível: a regra do evento enxerga a parceria
    // que ainda está nascendo. Sem ela, este teste é impossível de passar.
    const code = await aliceInvites();
    await acceptInvite(dbOf(BOB), code, { uid: BOB, profile: profileOf(BOB) });

    const ev = await getDoc(doc(dbOf(BOB), `partnerships/${PID}/events`, 'born'));
    expect(ev.exists()).toBe(true);
    expect(ev.data()).toMatchObject({ type: 'partnership_born', xpAwarded: 100 });
  });

  it('desnormaliza os dois perfis', async () => {
    const code = await aliceInvites();
    await acceptInvite(dbOf(BOB), code, { uid: BOB, profile: profileOf(BOB) });
    const snap = await getDoc(doc(dbOf(BOB), 'partnerships', PID));
    const profiles = snap.get('memberProfiles');
    expect(Object.keys(profiles).sort()).toEqual([ALICE, BOB].sort());
  });

  it('marca o convite como usado', async () => {
    const code = await aliceInvites();
    await acceptInvite(dbOf(BOB), code, { uid: BOB, profile: profileOf(BOB) });
    const invite = await getDoc(doc(dbOf(BOB), 'invites', code));
    expect(invite.data()).toMatchObject({ usedBy: BOB, status: 'accepted' });
  });

  it('não escreve nada no documento do usuário — stats é derivado', async () => {
    const code = await aliceInvites();
    await acceptInvite(dbOf(BOB), code, { uid: BOB, profile: profileOf(BOB) });
    const alice = await getDoc(doc(dbOf(BOB), 'users', ALICE));
    expect(alice.get('stats.partnershipCount')).toBe(0);
  });
});

describe('fraude e casos de borda', () => {
  it('recusa aceitar o próprio convite', async () => {
    const code = await aliceInvites();
    await expect(acceptInvite(dbOf(ALICE), code, { uid: ALICE, profile: profileOf(ALICE) }))
      .rejects.toMatchObject({ reason: 'self' });
  });

  it('recusa código inexistente', async () => {
    await expect(acceptInvite(dbOf(BOB), 'NAOEXIST', { uid: BOB, profile: profileOf(BOB) }))
      .rejects.toBeInstanceOf(InviteRejectedError);
  });

  it('recusa o segundo aceite do mesmo convite', async () => {
    const code = await aliceInvites();
    await acceptInvite(dbOf(BOB), code, { uid: BOB, profile: profileOf(BOB) });
    await expect(acceptInvite(dbOf(CAROL), code, { uid: CAROL, profile: profileOf(CAROL) }))
      .rejects.toMatchObject({ reason: 'used' });
  });

  it('recusa quando as duas pessoas já são parceiras ativas', async () => {
    const first = await aliceInvites();
    await acceptInvite(dbOf(BOB), first, { uid: BOB, profile: profileOf(BOB) });
    const second = await aliceInvites();
    await expect(acceptInvite(dbOf(BOB), second, { uid: BOB, profile: profileOf(BOB) }))
      .rejects.toMatchObject({ reason: 'already-partners' });
  });
});

describe('reativação', () => {
  it('reativa a parceria encerrada preservando XParceria e nível', async () => {
    const first = await aliceInvites();
    await acceptInvite(dbOf(BOB), first, { uid: BOB, profile: profileOf(BOB) });

    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`partnerships/${PID}`)
        .update({ status: 'ended', xparceria: 4321, level: 9 });
    });

    const second = await aliceInvites();
    const result = await acceptInvite(dbOf(BOB), second, { uid: BOB, profile: profileOf(BOB) });
    expect(result).toEqual({ pid: PID, reactivated: true });

    const snap = await getDoc(doc(dbOf(BOB), 'partnerships', PID));
    expect(snap.data()).toMatchObject({
      status: 'active',
      temperature: 50,
      xparceria: 4321,   // nada é perdido
      level: 9,
      bornFromInvite: second,
    });
  });

  it('grava partnership_resumed em vez de reconceder o nascimento', async () => {
    const first = await aliceInvites();
    await acceptInvite(dbOf(BOB), first, { uid: BOB, profile: profileOf(BOB) });
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`partnerships/${PID}`).update({ status: 'ended' });
    });

    const second = await aliceInvites();
    await acceptInvite(dbOf(BOB), second, { uid: BOB, profile: profileOf(BOB) });

    const evs = await getDocs(
      query(collection(dbOf(BOB), `partnerships/${PID}/events`), where('type', '==', 'partnership_resumed')),
    );
    expect(evs.size).toBe(1);
    expect(evs.docs[0]!.get('xpAwarded')).toBe(0);
  });
});
```

Acrescente `collection`, `getDocs`, `query` e `where` ao import estático de `firebase/firestore` no topo do arquivo. **Nada de `await import()`** — é constraint global, e Jest roda em CJS.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:rules`
Expected: FAIL — `acceptInvite` não existe.

- [ ] **Step 3: Implementar `acceptInvite`**

Acrescente a `src/features/invite/services/invites.ts`:

```ts
import {
  Timestamp, collection, doc, runTransaction, serverTimestamp, type Firestore,
} from 'firebase/firestore';
import { INVITE_TTL_MS, checkInvite, type InviteRejection } from '@shared/invite';
import { buildBirthPartnership, buildReactivationUpdate, partnershipId } from '@shared/partnership';
import type { InviteDoc, PartnershipDoc, UserDoc } from '@shared/types';

export type AcceptRejection = InviteRejection | 'not-found' | 'already-partners';

export class InviteRejectedError extends Error {
  constructor(readonly reason: AcceptRejection) {
    super(reason);
    this.name = 'InviteRejectedError';
  }
}

export interface AcceptResult {
  pid: string;
  reactivated: boolean;
}

const memberProfileOf = (p: UserDoc) => ({
  displayName: p.displayName,
  photoURL: p.photoURL,
  avatarEmoji: p.avatarEmoji,
});

/**
 * Nascimento inteiro numa transação: parceria, evento e baixa do convite.
 * Só é possível porque a regra do evento usa getAfter(), que enxerga a
 * parceria criada nesta mesma transação. Ou nasce inteira, ou não nasce.
 *
 * As validações aqui existem para a mensagem ser específica; a autoridade
 * continua sendo a regra, que roda de novo no commit.
 */
export async function acceptInvite(
  db: Firestore,
  code: string,
  accepter: { uid: string; profile: UserDoc },
): Promise<AcceptResult> {
  return runTransaction(db, async (tx) => {
    const inviteRef = doc(db, 'invites', code);
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists()) throw new InviteRejectedError('not-found');

    const invite = inviteSnap.data() as InviteDoc;
    const createdAtMs = (invite.createdAt as Timestamp).toMillis();
    const rejection = checkInvite(
      { fromUid: invite.fromUid, usedBy: invite.usedBy, status: invite.status, createdAtMs },
      accepter.uid,
      Date.now(),
    );
    if (rejection !== null) throw new InviteRejectedError(rejection);

    const pid = partnershipId(invite.fromUid, accepter.uid);
    const partnershipRef = doc(db, 'partnerships', pid);
    const existing = await tx.get(partnershipRef);

    const memberProfiles = {
      [invite.fromUid]: {
        displayName: invite.fromProfile.displayName,
        photoURL: invite.fromProfile.photoURL,
        avatarEmoji: invite.fromProfile.avatarEmoji,
      },
      [accepter.uid]: memberProfileOf(accepter.profile),
    };

    tx.update(inviteRef, { usedBy: accepter.uid, status: 'accepted' });

    if (existing.exists()) {
      const current = existing.data() as PartnershipDoc;
      if (current.status !== 'ended') throw new InviteRejectedError('already-partners');

      tx.update(partnershipRef, {
        ...buildReactivationUpdate(memberProfiles, code),
        updatedAt: serverTimestamp(),
      });
      tx.set(doc(collection(db, `partnerships/${pid}/events`)), {
        type: 'partnership_resumed',
        occurredAt: serverTimestamp(),
        xpAwarded: 0,
      });
      return { pid, reactivated: true };
    }

    const birth = buildBirthPartnership({
      inviter: { uid: invite.fromUid, profile: memberProfiles[invite.fromUid]! },
      accepter: { uid: accepter.uid, profile: memberProfiles[accepter.uid]! },
      inviteCode: code,
    });

    tx.set(partnershipRef, {
      ...birth,
      createdAt: serverTimestamp(),
      activatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Id fixo: idempotente se um dia for preciso repetir a escrita.
    tx.set(doc(db, `partnerships/${pid}/events`, 'born'), {
      type: 'partnership_born',
      occurredAt: serverTimestamp(),
      xpAwarded: 100,
    });

    return { pid, reactivated: false };
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:rules`
Expected: PASS.

Se "grava o evento de nascimento na mesma transação" falhar com `PERMISSION_DENIED`, a causa é a regra de `events` usando `get()` em vez de `getAfter()`. Volte à Task 4, Step 4.

- [ ] **Step 5: Provar que a proteção é real**

Escreva um teste temporário em que o Bob tenta criar a parceria **sem convite nenhum** (`setDoc` direto com valores válidos e `bornFromInvite: 'INVENTADO'`) e confirme que falha. Depois apague — a Task 3 já cobre isso; o ponto é ver o caminho real sendo barrado.

- [ ] **Step 6: `tsc` e commit**

```bash
npm run typecheck
git add src/features/invite tests/integration
git commit -m "feat: accept invite and birth the partnership in one transaction"
```

---

## Task 8: Ciclo de vida e propagação de perfil

**Files:**
- Create: `src/features/partnership/services/partnerships.ts`
- Test: `tests/integration/lifecycle.test.ts`

**Interfaces:**
- Produces:
  - `pausePartnership(db: Firestore, pid: string): Promise<void>`
  - `resumePartnership(db: Firestore, pid: string): Promise<void>`
  - `endPartnership(db: Firestore, pid: string): Promise<void>`
  - `propagateProfile(db: Firestore, uid: string, profile: MemberProfile, pids: string[]): Promise<void>`

> **`propagateProfile` nasce sem chamador, de propósito.** A tela de edição de perfil é da Spec 4 — a Spec 1 só criou o perfil. O serviço e a regra entram agora porque a regra tem de existir de qualquer forma (senão `memberProfiles` fica escrevível por quem não deveria), e porque escrever o serviço junto do teste da regra é mais barato que voltar aqui depois. Não é esquecimento: é a ordem certa.

- [ ] **Step 1: Escrever `tests/integration/lifecycle.test.ts`**

```ts
import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { partnershipId } from '../../shared/partnership';
import type { UserDoc } from '../../shared/types';
import { acceptInvite, createInvite } from '../../src/features/invite/services/invites';
import {
  endPartnership, pausePartnership, propagateProfile, resumePartnership,
} from '../../src/features/partnership/services/partnerships';
import { ALICE, BOB, CAROL, createTestEnv, validProfile } from '../rules/helpers';
import { seedUsers } from '../rules/factories';

let env: RulesTestEnvironment;
const dbOf = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const profileOf = (uid: string) => validProfile(uid, uid.replace(/-/g, '')) as unknown as UserDoc;
const PID = partnershipId(ALICE, BOB);

async function nascer() {
  const code = await createInvite(dbOf(ALICE), ALICE, profileOf(ALICE));
  await acceptInvite(dbOf(BOB), code, { uid: BOB, profile: profileOf(BOB) });
}

async function eventosDoTipo(tipo: string) {
  return getDocs(query(collection(dbOf(BOB), `partnerships/${PID}/events`), where('type', '==', tipo)));
}

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
  await nascer();
});

describe('ciclo de vida', () => {
  it('pausar desliga a parceria e registra o evento', async () => {
    await pausePartnership(dbOf(BOB), PID);
    expect((await getDoc(doc(dbOf(BOB), 'partnerships', PID))).get('status')).toBe('paused');
    const evs = await eventosDoTipo('partnership_paused');
    expect(evs.size).toBe(1);
    expect(evs.docs[0]!.get('xpAwarded')).toBe(0);
  });

  it('retomar volta para ativa', async () => {
    await pausePartnership(dbOf(BOB), PID);
    await resumePartnership(dbOf(ALICE), PID);
    expect((await getDoc(doc(dbOf(BOB), 'partnerships', PID))).get('status')).toBe('active');
  });

  it('encerrar preserva XParceria, nível e a timeline', async () => {
    await endPartnership(dbOf(BOB), PID);
    const snap = await getDoc(doc(dbOf(BOB), 'partnerships', PID));
    expect(snap.get('status')).toBe('ended');
    expect(snap.get('xparceria')).toBe(100);
    expect(snap.get('level')).toBe(1);
    expect((await getDoc(doc(dbOf(BOB), `partnerships/${PID}/events`, 'born'))).exists()).toBe(true);
  });

  it('NEGA que não-membro pause', async () => {
    await assertFails(pausePartnership(dbOf(CAROL), PID));
  });

  it('NEGA pausar uma parceria já encerrada', async () => {
    await endPartnership(dbOf(BOB), PID);
    await assertFails(pausePartnership(dbOf(BOB), PID));
  });
});

describe('propagação de perfil', () => {
  const novo = { displayName: 'Bob Novo', photoURL: null, avatarEmoji: '🐙' };

  it('atualiza a própria entrada em memberProfiles', async () => {
    await propagateProfile(dbOf(BOB), BOB, novo, [PID]);
    const profiles = (await getDoc(doc(dbOf(BOB), 'partnerships', PID))).get('memberProfiles');
    expect(profiles[BOB]).toMatchObject(novo);
  });

  it('não toca no perfil do outro membro', async () => {
    const antes = (await getDoc(doc(dbOf(BOB), 'partnerships', PID))).get('memberProfiles')[ALICE];
    await propagateProfile(dbOf(BOB), BOB, novo, [PID]);
    const depois = (await getDoc(doc(dbOf(BOB), 'partnerships', PID))).get('memberProfiles')[ALICE];
    expect(depois).toEqual(antes);
  });

  it('NEGA reescrever o perfil do outro passando o uid dele', async () => {
    await assertFails(propagateProfile(dbOf(BOB), ALICE, novo, [PID]));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:rules`

- [ ] **Step 3: Implementar `src/features/partnership/services/partnerships.ts`**

```ts
import {
  collection, doc, serverTimestamp, writeBatch, type Firestore,
} from 'firebase/firestore';
import type { EventType, MemberProfile, PartnershipStatus } from '@shared/types';

/**
 * Status e evento no mesmo lote. Aqui a parceria já existe, então a regra do
 * evento consegue verificar a associação com get() normal — só o nascimento
 * precisava de getAfter().
 */
async function transition(
  db: Firestore,
  pid: string,
  status: PartnershipStatus,
  type: EventType,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'partnerships', pid), { status, updatedAt: serverTimestamp() });
  batch.set(doc(collection(db, `partnerships/${pid}/events`)), {
    type,
    occurredAt: serverTimestamp(),
    xpAwarded: 0,
  });
  await batch.commit();
}

export const pausePartnership = (db: Firestore, pid: string) =>
  transition(db, pid, 'paused', 'partnership_paused');

export const resumePartnership = (db: Firestore, pid: string) =>
  transition(db, pid, 'active', 'partnership_resumed');

export const endPartnership = (db: Firestore, pid: string) =>
  transition(db, pid, 'ended', 'partnership_ended');

/**
 * Sem trigger no servidor, quem edita o perfil propaga. A regra só deixa
 * mexer na própria chave. Se o app morrer no meio, alguma parceria fica com
 * o nome velho até a próxima edição — cosmético, num evento raro.
 */
export async function propagateProfile(
  db: Firestore,
  uid: string,
  profile: MemberProfile,
  pids: string[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const pid of pids) {
    batch.update(doc(db, 'partnerships', pid), {
      [`memberProfiles.${uid}`]: profile,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}
```

- [ ] **Step 4: Rodar, `tsc` e commit**

```bash
npm run test:rules && npm run typecheck
git add src/features/partnership tests/integration
git commit -m "feat: add partnership lifecycle and profile propagation services"
```

---

## Task 9: Lista de parcerias e a nova raiz

`app/(app)/index.tsx` deixa de ser o placeholder do mapa e passa a ser a lista. O mapa entra na Spec 3, e aí a lista vira `(tabs)/partnerships.tsx`.

**Files:**
- Create: `src/features/partnership/hooks/usePartnerships.ts`, `src/features/partnership/hooks/usePartnership.ts`, `src/features/partnership/PartnershipCard.tsx`, `src/features/partnership/PartnershipListScreen.tsx`
- Modify: `app/(app)/index.tsx`, `firestore.indexes.json`
- Test: `src/features/partnership/__tests__/PartnershipListScreen.test.tsx`, `src/features/partnership/__tests__/PartnershipCard.test.tsx`

**Interfaces:**
- Consumes: `useFirestoreCollection` / `useFirestoreDoc` (Task 5), `bandForTemperature` (Spec 1)
- Produces:
  - `usePartnerships(uid: string | null): UseQueryResult<PartnershipDoc[]>`
  - `usePartnership(pid: string | null): UseQueryResult<PartnershipDoc | null>`
  - `<PartnershipCard partnership={PartnershipDoc} viewerUid={string} onPress={() => void} />` — `viewerUid` existe porque o card mostra **o parceiro**, nunca quem está olhando

- [ ] **Step 1: Acrescentar o índice composto**

`firestore.indexes.json` — a lista ordena por temperatura, e `array-contains` combinado com `orderBy` exige índice:

```json
{
  "collectionGroup": "partnerships",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "members", "arrayConfig": "CONTAINS" },
    { "fieldPath": "temperature", "order": "DESCENDING" }
  ]
}
```

- [ ] **Step 2: Escrever `src/features/partnership/__tests__/PartnershipCard.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react-native';
import { PartnershipCard } from '../PartnershipCard';
import type { PartnershipDoc } from '@shared/types';

const base = {
  id: 'a_b',
  members: ['a', 'b'],
  memberProfiles: {
    a: { displayName: 'Alice', photoURL: null, avatarEmoji: '🦊' },
    b: { displayName: 'Bob', photoURL: null, avatarEmoji: '🐢' },
  },
  status: 'active',
  level: 3,
  xparceria: 400,
  xpIntoLevel: 40,
  xpForNextLevel: 144,
  temperature: 72,
  temperatureBand: 'warm',
} as unknown as PartnershipDoc;

it('mostra o parceiro, não o próprio usuário', async () => {
  await render(<PartnershipCard partnership={base} viewerUid="a" onPress={jest.fn()} />);
  expect(screen.getByText('Bob')).toBeTruthy();
  expect(screen.queryByText('Alice')).toBeNull();
});

it('mostra o nível e a banda de temperatura', async () => {
  await render(<PartnershipCard partnership={base} viewerUid="a" onPress={jest.fn()} />);
  expect(screen.getByText('Nível 3')).toBeTruthy();
  expect(screen.getByText('Aquecida')).toBeTruthy();
});

it('marca a parceria pausada, para o mapa desligado não parecer bug', async () => {
  const paused = { ...base, status: 'paused' } as PartnershipDoc;
  await render(<PartnershipCard partnership={paused} viewerUid="a" onPress={jest.fn()} />);
  expect(screen.getByText('Pausada')).toBeTruthy();
});

it('deriva a banda da temperatura em vez de confiar no campo gravado', async () => {
  const inconsistente = { ...base, temperature: 10, temperatureBand: 'burning' } as PartnershipDoc;
  await render(<PartnershipCard partnership={inconsistente} viewerUid="a" onPress={jest.fn()} />);
  expect(screen.getByText('Hibernando')).toBeTruthy();
});
```

- [ ] **Step 3: Escrever `PartnershipListScreen.test.tsx`**

Quatro casos, todos com `await render`:

1. **carregando** → o skeleton (`testID="partnership-skeleton"`) aparece e nenhum `ActivityIndicator` é usado (o §19 pede skeleton, nunca spinner).
2. **vazio** → texto convidando a chamar alguém e dois botões: "Convidar um parceiro" e "Tenho um convite".
3. **com parcerias** → um card por parceria, ordenados por temperatura decrescente.
4. **erro** → `ErrorState` com botão de tentar de novo, e `refetch` chamado ao pressionar.

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -- src/features/partnership`

- [ ] **Step 5: Implementar os hooks**

```ts
// src/features/partnership/hooks/usePartnerships.ts
import { collection, orderBy, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { db } from '@/core/firebase/client';
import { useFirestoreCollection } from '@/core/firebase/useFirestoreCollection';
import type { PartnershipDoc } from '@shared/types';

export function usePartnerships(uid: string | null) {
  const q = useMemo(
    () =>
      uid === null
        ? null
        : query(
            collection(db, 'partnerships'),
            where('members', 'array-contains', uid),
            orderBy('temperature', 'desc'),
          ),
    [uid],
  );
  return useFirestoreCollection<PartnershipDoc>(q, ['partnerships', uid]);
}
```

`usePartnership(pid)` é o equivalente com `useFirestoreDoc(doc(db,'partnerships',pid), ['partnership', pid])`.

Os hooks importam `db` de `@/core/firebase/client`; os **serviços** continuam recebendo por parâmetro. A fronteira é essa: hook conhece o app, serviço não.

- [ ] **Step 6: Implementar as telas e apontar a raiz**

`PartnershipCard` usa `GlassCard`, `Avatar`, `XParceriaBar` e `ProgressRing` da Spec 1 — **não crie componente novo sem antes conferir se já existe**. A banda vem sempre de `bandForTemperature(p.temperature)`, nunca do campo gravado: o campo é cache do servidor e pode divergir.

`app/(app)/index.tsx` passa a renderizar `<PartnershipListScreen />`.

- [ ] **Step 7: Rodar, `tsc` e commit**

```bash
npm test -- src/features/partnership && npm run typecheck
git add src/features/partnership app firestore.indexes.json
git commit -m "feat: list partnerships as the app root"
```

---

## Task 10: Visão geral da parceria, pausar e encerrar

**Files:**
- Create: `src/features/partnership/PartnershipOverviewScreen.tsx`, `app/(app)/partnership/[id]/index.tsx`
- Test: `src/features/partnership/__tests__/PartnershipOverviewScreen.test.tsx`

- [ ] **Step 1: Escrever o teste**

Casos, todos com asserção explícita:

1. Mostra os dois avatares, o nível, a barra de XParceria e a banda de temperatura.
2. Mostra "Parceria desde <data>" a partir de `activatedAt`.
3. **Encerrar pede confirmação** e o texto do diálogo diz que o XParceria é preservado — sem isso a pessoa acha que vai perder a história, e é o momento de maior ansiedade da tela.
4. Confirmar encerramento chama `endPartnership` com o `pid` certo.
5. Cancelar não chama nada.
6. Parceria pausada mostra "Retomar" no lugar de "Pausar".
7. Parceria encerrada esconde as três ações e explica que um convite novo traz a parceria de volta.
8. Erro na ação mostra a mensagem de `firestoreErrorMessage` e mantém o botão utilizável.

- [ ] **Step 2: Rodar e ver falhar, depois implementar**

Use `Alert.alert` para a confirmação (mockável no RNTL) e os `Button` da Spec 1. **`Pressable` precisa da prop `disabled` nativa** enquanto a mutação está em voo — a guarda em JS não impede o toque.

- [ ] **Step 3: `tsc` e commit**

```bash
npm test -- src/features/partnership && npm run typecheck
git add src/features/partnership app/\(app\)/partnership
git commit -m "feat: add partnership overview with pause and end actions"
```

---

## Task 11: Onboarding — primeiro convite e espera

O Ato I. O onboarding não termina sem um convite enviado ou um código aceito: é o que faz o funil existir.

**Files:**
- Create: `src/features/invite/hooks/useCreateInvite.ts`, `src/features/invite/FirstInviteScreen.tsx`, `src/features/invite/WaitingScreen.tsx`, `app/(app)/onboarding/first-invite.tsx`, `app/(app)/onboarding/waiting.tsx`
- Test: `src/features/invite/__tests__/FirstInviteScreen.test.tsx`, `src/features/invite/__tests__/WaitingScreen.test.tsx`

**Interfaces:**
- Consumes: `createInvite`, `inviteUrl` (Task 6), `usePartnerships` (Task 9)
- Produces: `useCreateInvite(uid, profile)` → `{ mutate, code, url, isPending, error }`

- [ ] **Step 1: Escrever os testes**

`FirstInviteScreen`:

1. Antes de gerar, mostra a pergunta "Quem é o seu parceiro?" e **não** pede permissão de contatos — asserção explícita de que nenhum texto menciona agenda ou contatos. É decisão de produto documentada no §4, e um teste é o que impede alguém de "melhorar" isso depois.
2. Tocar em "Gerar convite" chama `createInvite` uma vez.
3. Depois de gerado, mostra o código em blocos legíveis e um botão "Compartilhar no WhatsApp".
4. Compartilhar chama `Share.share` com a URL da landing.
5. Erro mostra a mensagem traduzida e deixa tentar de novo.
6. Enquanto está gerando, o botão fica com `disabled` nativo (não só visual).

`WaitingScreen`:

1. Mostra o código e o preview animado da parceria fictícia nível 12.
2. Mostra "Enquanto o <nome> não aceita" quando o nome está disponível, e um texto neutro quando não está.
3. Quando `usePartnerships` passa a devolver uma parceria, navega para a raiz — a cerimônia é disparada pela Task 13, não por aqui.
4. Tem saída: um "Depois eu faço isso" que leva à raiz sem convite. Onboarding sem saída é onde se perde usuário.

- [ ] **Step 2: Implementar**

O preview animado usa Reanimated. **Respeite `prefers-reduced-motion`** (`AccessibilityInfo.isReduceMotionEnabled()`): sem isso a animação é hostil para quem precisa dela desligada. Com o motion reduzido, mostre o mesmo card estático.

`Share.share` vem de `react-native`. A mensagem pronta: `"Bora construir uma parceria? <url>"` — o app empurra para o WhatsApp, não tenta ser o canal.

- [ ] **Step 3: Rodar, `tsc` e commit**

```bash
npm test -- src/features/invite && npm run typecheck
git add src/features/invite app/\(app\)/onboarding
git commit -m "feat: add first invite and waiting onboarding screens"
```

---

## Task 12: Entrar com código e aceitar

**Files:**
- Create: `src/features/invite/hooks/useInvitePreview.ts`, `src/features/invite/hooks/useAcceptInvite.ts`, `src/features/invite/EnterCodeScreen.tsx`, `src/features/invite/AcceptInviteScreen.tsx`, `app/(app)/invite/enter.tsx`, `app/(app)/invite/[code].tsx`
- Test: `src/features/invite/__tests__/EnterCodeScreen.test.tsx`, `src/features/invite/__tests__/AcceptInviteScreen.test.tsx`

- [ ] **Step 1: Escrever os testes**

`EnterCodeScreen`:

1. Normaliza enquanto digita: `ab3d-4f7h` vira `AB3D4F7H` no campo.
2. Aceita os caracteres que o alfabeto exclui e os corrige — digitar `IL0O` mostra `1100`. É `normalizeInviteCode` da Task 1 ligado à UI, e é o que evita a pessoa achar que o código está errado.
3. O botão só habilita com 8 caracteres.
4. Enviar navega para `/invite/AB3D4F7H`.
5. `autoCapitalize="characters"` e `autoCorrect={false}` — sem isso o teclado do iOS sabota o campo.

`AcceptInviteScreen`:

1. Mostra "<Nome> quer construir uma parceria com você" com o avatar de quem convidou.
2. Skeleton enquanto carrega, nunca spinner.
3. Código inexistente → "Não encontrei esse convite." com botão de voltar.
4. Cada motivo de recusa tem mensagem própria: `self` → "Esse convite é seu."; `used` → "Esse convite já foi usado."; `expired` → "Esse convite expirou."; `already-partners` → "Vocês já são parceiros."
5. Aceitar chama `acceptInvite` e, no sucesso, navega para a raiz.
6. Enquanto aceita, o botão tem `disabled` nativo.

- [ ] **Step 2: Implementar**

A rota `app/(app)/invite/[code].tsx` lê `useLocalSearchParams()` e serve tanto a navegação interna quanto o deep link `exp://` quando ele funcionar. Não construa nada em cima de o deep link funcionar.

`useAcceptInvite` traduz `InviteRejectedError.reason` para as mensagens acima e qualquer outro erro por `firestoreErrorMessage`.

- [ ] **Step 3: Rodar, `tsc` e commit**

```bash
npm test -- src/features/invite && npm run typecheck
git add src/features/invite app/\(app\)/invite
git commit -m "feat: add invite code entry and acceptance screens"
```

---

## Task 13: Cerimônia de nascimento

O momento mais importante do app, e a única parte que precisa acontecer **nos dois aparelhos ao mesmo tempo**.

**Files:**
- Create: `src/features/ceremony/useBornCeremony.ts`, `src/features/ceremony/PartnershipBornCeremony.tsx`, `app/(modals)/partnership-born.tsx`
- Modify: `app/(app)/_layout.tsx` (montar o modal sobre a stack)
- Test: `src/features/ceremony/__tests__/useBornCeremony.test.tsx`, `src/features/ceremony/__tests__/PartnershipBornCeremony.test.tsx`

**Interfaces:**
- Consumes: `usePartnerships` (Task 9)
- Produces: `useBornCeremony(partnerships)` → `{ pending: PartnershipDoc | null; dismiss: () => Promise<void> }`

- [ ] **Step 1: Escrever `useBornCeremony.test.tsx`**

Os quatro casos que definem o comportamento:

```tsx
it('celebra uma parceria recém-nascida ainda não vista', async () => { /* pending é a parceria */ });

it('não celebra duas vezes — a flag no AsyncStorage é o que impede a reprise', async () => {
  // Após dismiss(), remontar o hook com a mesma lista deixa pending em null.
});

it('não celebra parceria antiga em instalação nova', async () => {
  // createdAt de 3 dias atrás: marca como vista em silêncio, sem modal.
  // Sem esta guarda, quem reinstala o app leva uma cerimônia por parceria.
});

it('ignora parceria pausada ou encerrada', async () => { /* pending fica null */ });
```

- [ ] **Step 2: Escrever `PartnershipBornCeremony.test.tsx`**

1. Mostra os dois nomes e "Parceria Nível 1".
2. Mostra "+100 XParceria" e "Temperatura 50".
3. Mostra a conquista "O Começo".
4. Fechar chama `dismiss` exatamente uma vez.
5. Com movimento reduzido, o conteúdo aparece inteiro sem animação — e ainda assim fecha.

- [ ] **Step 3: Implementar o hook**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import type { PartnershipDoc } from '@shared/types';

const JANELA_MS = 5 * 60 * 1000;
const chave = (pid: string) => `ceremony:born:${pid}`;

/**
 * Dispara a cerimônia nos dois aparelhos sem push e sem polling: os dois já
 * escutam a mesma query, e a parceria aparecendo é o próprio sinal.
 *
 * A janela de 5 minutos existe para quem reinstala o app: sem ela, o
 * AsyncStorage vazio faria chover uma cerimônia por parceria antiga.
 */
export function useBornCeremony(partnerships: PartnershipDoc[] | undefined) {
  const [pending, setPending] = useState<PartnershipDoc | null>(null);
  const avaliadas = useRef(new Set<string>());

  useEffect(() => {
    if (partnerships === undefined) return;
    let cancelado = false;

    void (async () => {
      for (const p of partnerships) {
        if (p.status !== 'active' || avaliadas.current.has(p.id)) continue;
        avaliadas.current.add(p.id);

        if (await AsyncStorage.getItem(chave(p.id)) !== null) continue;

        const nascidaMs = (p.createdAt as Timestamp | null)?.toMillis?.() ?? 0;
        if (Date.now() - nascidaMs > JANELA_MS) {
          await AsyncStorage.setItem(chave(p.id), '1'); // vista em silêncio
          continue;
        }
        if (!cancelado) {
          setPending(p);
          return;
        }
      }
    })();

    return () => { cancelado = true; };
  }, [partnerships]);

  const dismiss = useCallback(async () => {
    if (pending === null) return;
    await AsyncStorage.setItem(chave(pending.id), '1');
    setPending(null);
  }, [pending]);

  return { pending, dismiss };
}
```

- [ ] **Step 4: Implementar a cerimônia**

Tela cheia, ~4 s, com os dois avatares se aproximando, o `🤝`, os nomes, "Parceria Nível 1", "+100 XParceria · Temperatura 50" e a conquista. Reanimated, **com gate de `AccessibilityInfo.isReduceMotionEnabled()`** — sem o gate, a animação decorativa vira problema de acessibilidade, defeito que já apareceu em outro projeto seu.

Monte em `app/(modals)/partnership-born.tsx` e apresente sobre a stack de `(app)` com `presentation: 'fullScreenModal'`, para a cerimônia devolver a pessoa exatamente onde ela estava (§5).

- [ ] **Step 5: Rodar, `tsc` e commit**

```bash
npm test -- src/features/ceremony && npm run typecheck
git add src/features/ceremony app
git commit -m "feat: add simultaneous partnership birth ceremony"
```

---

## Task 14: Landing

Estática, sem leitura do Firestore. Sendo assim, não tem o que vazar nem o que autenticar.

**Pré-requisito:** Firebase Hosting habilitado no console (ver topo do plano).

**Files:**
- Create: `hosting/index.html`, `hosting/style.css`
- Modify: `firebase.json`

- [ ] **Step 1: Configurar o Hosting**

```json
"hosting": {
  "public": "hosting",
  "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
}
```

- [ ] **Step 2: Escrever a página**

Lê `?c=CODIGO&de=Nome` do query string. Precisa de:

- `<title>` e `og:title` com o nome: *"<Nome> quer construir uma parceria com você"* — é o que aparece no preview do WhatsApp, e a conversão do convite é o gargalo do funil (§20, ideia 10).
- `og:image` estática, hospedada junto.
- O código **grande, monoespaçado e em blocos de 4**, com botão de copiar.
- Instrução curta de instalar o Expo Go, com os dois links de loja.
- Fallback honesto quando não há `?c=`: explica o que é o Parcerio sem fingir que há um convite.
- Responsiva e legível no escuro (`prefers-color-scheme`), porque quase todo mundo vai abrir pelo celular, dentro do WhatsApp.

Sem framework, sem build, sem dependência externa. É um arquivo.

- [ ] **Step 3: Verificar em runtime**

```bash
npx firebase hosting:channel:deploy preview --expires 7d
```

Abra a URL do canal no celular, confira o preview colando o link num chat do WhatsApp com você mesmo, e teste o botão de copiar. **Preview de link não se confere no desktop** — o WhatsApp resolve o `og:` no servidor dele e o resultado no celular é o que vale.

- [ ] **Step 4: Commit**

```bash
git add hosting firebase.json
git commit -m "feat: add static invite landing page"
```

---

## Task 15: Verificação no celular e aceite

O aceite pendente da Spec 1, cobrado aqui — decisão registrada na §10 da spec. Todas as surpresas de runtime chegam de uma vez.

**Files:** nenhum, a menos que algo quebre.

- [ ] **Step 1: Rodar a suíte inteira**

```bash
npm run validate
```

Todas verdes antes de tocar no celular. `npm test`, `npm run test:rules` (agora com integração junto) e `tsc`.

- [ ] **Step 2: Subir o app com os emuladores**

```bash
npx firebase emulators:start --only firestore,auth   # terminal 1
EXPO_PUBLIC_USE_EMULATOR=1 npx expo start            # terminal 2
```

O `client.ts` já resolve o IP da máquina pelo `Constants.expoConfig.hostUri` — é o que faz o emulador funcionar em aparelho físico, onde `localhost` seria o próprio celular.

- [ ] **Step 3: Percorrer o fluxo em dois aparelhos**

Dois celulares, ou um celular e um simulador. Na mesma rede.

- [ ] Aparelho A: login, perfil, gerar convite, compartilhar
- [ ] Aparelho B: login com outra conta, perfil, "Tenho um convite", digitar o código
- [ ] B vê "<Nome de A> quer construir uma parceria com você" e aceita
- [ ] **Os dois veem a cerimônia** — A na tela de espera, B ao voltar do aceite
- [ ] Fechar e reabrir os dois: a cerimônia **não** reprisa
- [ ] A parceria aparece na lista dos dois: nível 1, 100 XParceria, temperatura 50
- [ ] Abrir a parceria, pausar em A, ver `Pausada` aparecer em B sem recarregar
- [ ] Retomar, encerrar, e conferir que XParceria e nível continuam lá
- [ ] Gerar convite novo e reaceitar: a parceria volta com o mesmo XParceria
- [ ] Digitar um código inválido, um expirado e o próprio código: cada um com sua mensagem

- [ ] **Step 4: Anotar o que só o aparelho revela**

Reanimated, worklets e gesture-handler só existem de verdade dentro do binário do Expo Go. Se algo quebrar, registre no plano como as armadilhas do SDK 57 foram registradas na Spec 1 — a próxima spec começa sabendo.

- [ ] **Step 5: Fechar**

```bash
git add -A && git commit -m "docs: record device verification findings for spec 2"
```

Atualizar `01 - Projects/Parcerio.md` e `02 - Areas/Projects Dashboard.md` no vault: Spec 2 concluída, decisão de não usar Cloud Functions e o que ela empurra para a Spec 4 (§7 da spec).

---

## Resumo das tasks

| # | Task | Entrega |
|---|---|---|
| 1 | Domínio compartilhado | `partnershipId`, `buildBirthPartnership`, código de convite, `checkInvite` |
| 2 | Regras de `invites` | coleção fechada, perfil conferido, uso único |
| 3 | Regra de nascimento | consentimento por convite, todo valor literal |
| 4 | Ciclo de vida, reativação, eventos | três ramos disjuntos + timeline com `getAfter()` |
| 5 | Ponte React Query | `useFirestoreDoc`, `useFirestoreCollection` |
| 6 | Serviço de convite | criar e ler |
| 7 | Serviço de aceite | nascimento inteiro numa transação |
| 8 | Ciclo de vida e perfil | pausar, retomar, encerrar, propagar |
| 9 | Lista de parcerias | nova raiz do app |
| 10 | Visão geral | pausar e encerrar com confirmação |
| 11 | Onboarding | primeiro convite e espera |
| 12 | Aceite | entrada de código e tela de aceite |
| 13 | Cerimônia | simultânea, sem push, sem reprise |
| 14 | Landing | estática, com preview para o WhatsApp |
| 15 | Verificação no celular | o aceite da Spec 1 e da Spec 2 |

Tasks 1 a 8 são a fundação e podem ser revisadas sem nenhuma tela existir. As tasks 2, 3, 4 e 7 são onde a revisão deve gastar tempo: sem servidor, é ali que mora toda a garantia do produto.

