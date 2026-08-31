---
date: "2026-08-04"
type: project
tags:
  - project
  - parceria
  - plan
  - spec-1
status: active
---

# Parcerio — Spec 1 (Fundação) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a fundação do Parcerio — projeto Expo rodando no Expo Go, design
system tipado, Firebase conectado, autenticação com sessão persistente e perfil de
usuário com handle único — com as security rules do Firestore cobertas por uma suíte de
testes de **negação**.

**Architecture:** App Expo (Expo Go, sem código nativo) com Expo Router. Camadas:
`app/` só rotas finas → `src/features/*` (UI + hooks + serviços por domínio) →
`src/core/*` (design system, firebase, libs) → `shared/` (tipos e constantes que também
serão consumidos por `functions/` na Spec 2). Toda escrita de progressão é negada no
cliente por regra de segurança desde já — o cliente só escreve o próprio perfil.

**Tech Stack:** Expo SDK 57 · Expo Router 57 · TypeScript estrito · NativeWind 4 +
Tailwind CSS 3.4 · Firebase JS SDK 12 · Zustand 5 · TanStack Query 5 · Jest
(`jest-expo`) + React Native Testing Library · `@firebase/rules-unit-testing` 5 ·
Firebase Emulator Suite.

**Spec:** `../2026-08-03-parceria-design.md` (seções 6, 7, 8, 9, 10)

---

## Descobertas de ambiente (verificadas nesta máquina, 2026-08-04)

Quatro coisas foram checadas contra o registro npm e o sistema. Elas mudam o plano —
não são detalhes:

| # | Descoberta | Consequência |
|---|---|---|
| 1 | **Java não está instalado.** `/usr/bin/java` existe mas é o stub do macOS ("Unable to locate a Java Runtime") | O emulador do Firestore **não roda** sem JDK. Instalação é pré-requisito da Task 5, antes da suíte de rules |
| 2 | **`tailwindcss@latest` é 4.3.3, e NativeWind 4.2.6 não funciona com ela.** O peer dep declara `>3.3.0`, mas o Tailwind 4 abandonou o config em JS que o preset do NativeWind exige | **Fixar `tailwindcss@^3.4.19`.** Instalar o latest quebra o build com erro obscuro de preset |
| 3 | **`getReactNativePersistence` não existe no `.d.ts` padrão do Firebase.** Ele só é exportado pela condição `react-native` do `exports` (`dist/rn/index.rn.d.ts`); o `types` default (`auth-public.d.ts`) não o declara | Sem `"customConditions": ["react-native"]` no `tsconfig.json`, o TS acusa erro num import que funciona em runtime |
| 4 | Homebrew 6.0.12, Node 26.3.0, npm 11.16.0, Bun 1.3.14 disponíveis | **Usar npm**, não Bun: `npx expo install` resolve versões pelo canal do SDK e o Metro tem menos arestas com npm |

---

## Global Constraints

Requisitos de projeto inteiro. **Valem implicitamente para toda task.**

- **Expo SDK 57.0.9**, e o app precisa rodar **no Expo Go**. Nenhuma dependência com
  código nativo próprio, nenhum config plugin que exija dev build.
- **`tailwindcss` fixado em `^3.4.19`.** Nunca 4.x (ver descoberta 2).
- **Firebase JS SDK `firebase@^12.17.0`.** Nunca `@react-native-firebase/*` — não roda
  no Expo Go.
- **TypeScript estrito**: `strict: true`, `noUncheckedIndexedAccess: true`,
  `customConditions: ["react-native"]`.
- **`app/` não contém lógica.** Uma rota importa uma tela de `src/features/` e a
  renderiza. Arquivo em `app/` acima de 30 linhas é código no lugar errado.
- **`src/core/ui` não conhece o domínio.** Nenhum import de `src/features/` a partir de
  `src/core/`.
- **`src/features/X` não importa de `src/features/Y`.** O que é comum sobe para `core/`.
- **Limite de ~200 linhas por arquivo.**
- **Toda regra de segurança tem um teste de negação.** O teste que importa não é "o dono
  consegue escrever", é "o estranho é bloqueado".
- **No `@testing-library/react-native` v14, `render` e `fireEvent` são assíncronos.**
  `render()`, `fireEvent()`, `fireEvent.press()`, `fireEvent.changeText()`, `rerender()`
  e `unmount()` retornam Promise. **Todo `it()` que renderiza é `async` e todo chamada
  leva `await`.** Sem isso o teste falha com ``​`render` function has not been called``,
  porque `screen` só é populado depois de um await interno. Os matchers (`getByText`,
  `getByLabelText`, `queryByText`) continuam síncronos.
- **Texto de interface em português; código, pastas e identificadores em inglês.**
  **Comentários e JSDoc em português** — quem mantém este código pensa em português, e
  comentário existe para explicar o porquê a um humano. Só identificador é inglês.
- **A palavra "XP" nunca aparece em texto de interface.** Sempre **"XParceria"**. No
  código, `xparceria` / `xpIntoLevel` são aceitáveis como identificadores.
- **Nenhum segredo commitado.** `.env` no `.gitignore`; `.env.example` versionado.
- **Commit ao fim de cada task**, mensagem em inglês, formato convencional.

---

## Estrutura de arquivos

Arquivos criados por esta spec, e a responsabilidade de cada um:

```
parceria/
├── app/
│   ├── _layout.tsx                    root: providers + guarda de sessão
│   ├── (auth)/_layout.tsx
│   ├── (auth)/sign-in.tsx             rota fina → features/auth/SignInScreen
│   ├── (auth)/profile-setup.tsx       rota fina → features/profile/ProfileSetupScreen
│   └── (app)/_layout.tsx              exige sessão + perfil
│   └── (app)/index.tsx                placeholder do mapa (Spec 3)
│
├── shared/                            fronteira com functions/ (Spec 2)
│   ├── constants.ts                   XP, TEMPERATURE, LEVEL, bandas
│   ├── level.ts                       fórmulas puras de nível
│   ├── temperature.ts                 faixa a partir da temperatura
│   └── types.ts                       User, Partnership, TemperatureBand…
│
├── src/
│   ├── core/
│   │   ├── firebase/
│   │   │   ├── client.ts              app, auth (persistência), db, connect emuladores
│   │   │   └── errors.ts              código do Firebase → mensagem em pt-BR
│   │   ├── ui/
│   │   │   ├── theme.ts               tokens: cor, tipografia, espaço, raio, movimento
│   │   │   ├── GlassCard.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── ProgressRing.tsx
│   │   │   └── XParceriaBar.tsx
│   │   └── auth/
│   │       ├── AuthProvider.tsx       contexto de sessão
│   │       └── useAuth.ts
│   └── features/
│       ├── auth/SignInScreen.tsx
│       └── profile/
│           ├── ProfileSetupScreen.tsx
│           ├── services/profile.ts    criar perfil + reivindicar handle (transação)
│           └── hooks/useProfile.ts
│
├── firestore.rules
├── firestore.indexes.json
├── firebase.json                      portas dos emuladores
├── tests/rules/                       suíte de negação (jest, ambiente node)
├── jest.config.js                     projeto do app (jest-expo)
├── jest.rules.config.js               projeto das rules (node)
├── tailwind.config.js
├── babel.config.js
├── metro.config.js
├── tsconfig.json
├── app.json
├── .env.example
└── package.json
```

**Decisão de fronteira:** `shared/` contém apenas **fórmulas puras e constantes** (dado
entra, dado sai). As **transições de estado** (`applyXP`, `applyDecay`) são da Spec 4 e
viverão em `functions/src/engine/`. Isso mantém `shared/` seguro para importar dos dois
lados sem arrastar dependência.

---

## Task 1: Scaffold do projeto e toolchain

**Files:**
- Create: `parceria/package.json`, `app.json`, `tsconfig.json`, `babel.config.js`
- Create: `app/_layout.tsx`, `app/(app)/index.tsx`
- Test: `src/core/__tests__/smoke.test.tsx`

> `metro.config.js` pertence à Task 3 (é lá que o NativeWind entra), `.env.example` à
> Task 5, e `jest.config.js` não existe — a configuração do Jest vive na chave `jest`
> do `package.json`. Nenhum dos três é desta task.

**Interfaces:**
- Consumes: nada (primeira task)
- Produces: script `npm run validate` (roda `tsc --noEmit` + `jest`), aliases de path
  `@/*` → `src/*` e `@shared/*` → `shared/*`

- [ ] **Step 1: Gerar o scaffold dentro da pasta existente**

`01 - Projects/parcerio/` **já existe** com `docs/` dentro (spec e este plano), e o
`create-expo-app` recusa diretório não vazio. O repositório git e a branch
`feat/spec-1-fundacao` também já foram criados no setup. Por isso: gerar num diretório
temporário e trazer o conteúdo para cá.

```bash
cd "/Users/g7/Desktop/job/psb/01 - Projects"
npx create-expo-app@latest parceria-scaffold --template blank-typescript
rsync -a --exclude '.git' parceria-scaffold/ parceria/
rm -rf parceria-scaffold
cd parceria
git add -A
git commit -m "chore: scaffold expo project"
```

**Não rodar `git init`** — o repositório já existe. Confirmar com
`git branch --show-current`, que deve imprimir `feat/spec-1-fundacao`.

- [ ] **Step 2: Instalar as dependências pelo canal do SDK**

`npx expo install` escolhe a versão compatível com o SDK 57 — não trocar por
`npm install` nesses pacotes.

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar react-native-gesture-handler \
  react-native-reanimated expo-blur expo-haptics expo-image \
  @react-native-async-storage/async-storage

npm install firebase@^12.17.0 zustand@^5 @tanstack/react-query@^5 nativewind@^4.2.6
npm install -D tailwindcss@^3.4.19 jest-expo jest@^29.7.0 @types/jest@^29.5.14 \
  @testing-library/react-native test-renderer babel-preset-expo@~57.0.5 \
  @react-native/jest-preset@^0.86.2 \
  @firebase/rules-unit-testing@^5 firebase-tools@^15

npm install react-dom@19.2.3
```

### As quatro armadilhas de dependência do SDK 57

Todas foram encontradas em execução real, e todas travam o `npm install` ou a suíte de
testes. A raiz das três primeiras é a mesma: **o Expo SDK 57 fixa `react@19.2.3`**, e
qualquer pacote que peça `^19.2.8` explode a resolução.

| Pacote | Sintoma | Correção |
|---|---|---|
| `react-test-renderer` | ERESOLVE: exige `react@^19.2.8` | Não usar. O `@testing-library/react-native` v14 trocou de renderizador — o peer dele é **`test-renderer@^1.0.0`** |
| `react-dom` | ERESOLVE ao re-resolver a árvore: sobe sozinho para 19.2.8 | Fixar em **`19.2.3`** nas dependencies |
| `babel-preset-expo` | `jest` e `expo export` falham com `MODULE_NOT_FOUND` | Só existe aninhado em `expo/`; declarar **`~57.0.5`** na raiz para ser içado |
| `jest` | `TypeError: this._moduleMocker.clearMocksOnScope is not a function` | O `jest-expo@57.0.3` ainda é da geração **Jest 29** (`babel-jest`, `@jest/globals`, `jest-snapshot`, `jest-environment-jsdom` todos `^29.2.1`). Fixar `jest@^29.7.0` e `@types/jest@^29` |

> **Nunca resolver nada disso com `.npmrc` contendo `legacy-peer-deps=true`.** Isso
> silencia *todos* os conflitos de peer dep do projeto, inclusive os que a gente vai
> querer enxergar. Se aparecer um `.npmrc` desses, apague.

> **`tailwindcss@^3.4.19` é obrigatório.** O `@latest` instala 4.x e quebra o preset do
> NativeWind com erro de config difícil de diagnosticar.

> **`tailwindcss@^3.4.19` é obrigatório.** O `@latest` instala 4.x e quebra o preset do
> NativeWind com erro de config difícil de diagnosticar.

> **`test-renderer`, não `react-test-renderer`.** O `@testing-library/react-native` v14
> trocou de renderizador: seu peer é `test-renderer@^1.0.0` (que aceita `react@^19.0.0`).
> O `react-test-renderer@^19.2.8` exige `react@^19.2.8` e colide com o `react@19.2.3` que
> o Expo SDK 57 fixa — o `npm install` falha com ERESOLVE.
>
> **Não resolver isso com `.npmrc` contendo `legacy-peer-deps=true`.** Isso silencia
> *todos* os conflitos de peer dep do projeto, inclusive os que a gente vai querer
> enxergar. Se aparecer um `.npmrc` desses, apague.

- [ ] **Step 3: Configurar `tsconfig.json`**

`customConditions` é o que faz o TypeScript enxergar os tipos de React Native do
Firebase (descoberta 3).

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "moduleResolution": "bundler",
    "customConditions": ["react-native"],
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["./shared/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 4: Configurar Expo Router e Reanimated no `babel.config.js`**

O plugin do Reanimated tem que ser **o último** da lista.

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

- [ ] **Step 5: Apontar a entrada para o Expo Router no `package.json`**

```json
{
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "validate": "npm run typecheck && npm test"
  },
  "jest": { "preset": "jest-expo" }
}
```

E em `app.json`, dentro de `expo`:

```json
"scheme": "parceria",
"plugins": ["expo-router"],
"experiments": { "typedRoutes": true }
```

- [ ] **Step 6: Criar o layout raiz e a rota placeholder**

`app/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import 'react-native-gesture-handler';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`app/(app)/index.tsx`:

```tsx
import { Text, View } from 'react-native';

export default function MapPlaceholder() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Parcerio</Text>
    </View>
  );
}
```

- [ ] **Step 7: Escrever o teste de fumaça**

`src/core/__tests__/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import MapPlaceholder from '../../../app/(app)/index';

describe('scaffold', () => {
  it('renderiza a rota placeholder', () => {
    render(<MapPlaceholder />);
    expect(screen.getByText('Parcerio')).toBeTruthy();
  });
});
```

- [ ] **Step 8: Rodar a validação**

Run: `npm run validate`
Expected: `tsc` sem erros; 1 teste passando.

- [ ] **Step 9: Rodar no Expo Go e confirmar visualmente**

Run: `npx expo start`
Expected: ler o QR code no celular, o app abre no Expo Go e mostra "Parcerio".
**Este passo não pode ser pulado** — é o único que prova que a premissa do projeto
inteiro (rodar no Expo Go) se sustenta.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: configure router, typescript, tailwind and test toolchain"
```

---

## Task 2: Domínio compartilhado — constantes e fórmulas puras

Nenhuma dependência de React ou Firebase. É o único lugar onde os números da spec viram
código, e a Spec 2 (`functions/`) vai importar daqui.

**Files:**
- Create: `shared/constants.ts`, `shared/types.ts`, `shared/level.ts`,
  `shared/temperature.ts`
- Test: `shared/__tests__/level.test.ts`, `shared/__tests__/temperature.test.ts`

**Interfaces:**
- Consumes: Task 1 (toolchain, alias `@shared/*`)
- Produces:
  - `xpForNextLevel(level: number): number`
  - `totalXpForLevel(level: number): number`
  - `bandForTemperature(temp: number): TemperatureBand`
  - `TEMPERATURE_BANDS: readonly BandDefinition[]`
  - Tipos `UserDoc`, `TemperatureBandId`, `PartnershipStatus`
  - Constantes `XP`, `LEVEL`, `TEMPERATURE`

- [ ] **Step 1: Escrever os testes de nível (que vão falhar)**

Os valores esperados vêm da §11 da spec e **não podem mudar** — a mockup de interface
depende deles.

`shared/__tests__/level.test.ts`:

```ts
import { xpForNextLevel, totalXpForLevel } from '../level';
import { LEVEL } from '../constants';

describe('xpForNextLevel', () => {
  it.each([
    [1, 122],
    [5, 210],
    [10, 320],
    [18, 496],  // ← a mockup mostra "420 / 500" no nível 18
    [21, 562],
    [50, 1200],
  ])('nível %i exige %i XParceria para o próximo', (level, expected) => {
    expect(xpForNextLevel(level)).toBe(expected);
  });
});

describe('totalXpForLevel', () => {
  it.each([
    [1, 0],
    [2, 122],
    [10, 1890],
    [18, 5066],
    [21, 6620],
    [50, 31850],
  ])('atingir o nível %i custa %i XParceria acumulado', (level, expected) => {
    expect(totalXpForLevel(level)).toBe(expected);
  });

  it('a forma fechada bate com a soma iterativa', () => {
    for (let n = 1; n <= 60; n++) {
      let sum = 0;
      for (let k = 1; k < n; k++) sum += xpForNextLevel(k);
      expect(totalXpForLevel(n)).toBe(sum);
    }
  });

  it('é monotônica e nunca negativa', () => {
    for (let n = 1; n < 60; n++) {
      expect(totalXpForLevel(n + 1)).toBeGreaterThan(totalXpForLevel(n));
      expect(totalXpForLevel(n)).toBeGreaterThanOrEqual(0);
    }
  });
});
```

O teste da forma fechada é o mais importante: se alguém mexer em `LEVEL.BASE` ou
`LEVEL.SLOPE` e esquecer de ajustar a fórmula fechada, ele quebra.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest shared/__tests__/level.test.ts`
Expected: FAIL — `Cannot find module '../level'`

- [ ] **Step 3: Escrever as constantes**

`shared/constants.ts`:

```ts
export const LEVEL = {
  BASE: 100,
  SLOPE: 22,
} as const;

export const XP = {
  DAILY_DIGITAL_CAP: 15,
  OPEN_APP: 3,
  EMOJI_SENT: 6,
  EMOJI_RECIPROCAL: 6,
  ENCOUNTER_BASE: 60,
  ENCOUNTER_PER_MINUTE: 1,
  ENCOUNTER_MAX_MINUTES: 240,
  ENCOUNTER_CAP: 300,
  DAILY_ENCOUNTER_CAP: 500,
  ENCOUNTER_COOLDOWN_HOURS: 6,
  PARTNERSHIP_BORN: 100,
  CHALLENGE_RESCUE: 500,
  ANNIVERSARY: 365,
} as const;

export const TEMPERATURE = {
  MIN: 0,
  MAX: 100,
  INITIAL: 50,
  /** Interação digital sozinha nunca passa daqui — só encontro real. */
  DIGITAL_CEILING: 70,
  /** Toda aresta precisa disso para nascer uma Super Parceria. */
  SUPER_PARTNERSHIP_THRESHOLD: 75,
  DECAY_PER_DAY: 1.5,
  DECAY_HIBERNATING: 0.5,
} as const;

export const TEMPERATURE_BANDS = [
  { id: 'burning',     min: 85, emoji: '🔥',  label: 'Em chamas',   color: '#FF4D4D' },
  { id: 'warm',        min: 60, emoji: '☀️', label: 'Aquecida',    color: '#FF9A3C' },
  { id: 'mild',        min: 35, emoji: '🌤',  label: 'Morna',       color: '#FFD166' },
  { id: 'cooling',     min: 15, emoji: '🌧',  label: 'Esfriando',   color: '#7CC4FF' },
  { id: 'hibernating', min: 0,  emoji: '❄️', label: 'Hibernando',  color: '#B8C4D9' },
] as const;
```

- [ ] **Step 4: Escrever os tipos**

`shared/types.ts`:

```ts
import type { TEMPERATURE_BANDS } from './constants';

export type TemperatureBandId = (typeof TEMPERATURE_BANDS)[number]['id'];
export type TemperatureBand = (typeof TEMPERATURE_BANDS)[number];

export type PartnershipStatus =
  | 'pending' | 'active' | 'hibernating' | 'paused' | 'ended';

export interface UserStats {
  partnershipCount: number;
  totalXParceria: number;
  totalEncounters: number;
  daysUsing: number;
  strongestPartnershipId: string | null;
}

export interface UserSettings {
  shareLocation: boolean;
  ritualHour: number;
  notifications: { ritual: boolean; challenges: boolean; encounters: boolean };
}

export interface UserDoc {
  uid: string;
  displayName: string;
  handle: string;
  photoURL: string | null;
  avatarEmoji: string;
  timezone: string;
  createdAt: unknown;    // Timestamp — o tipo concreto difere entre SDK e admin
  lastActiveAt: unknown;
  stats: UserStats;
  settings: UserSettings;
}

export const INITIAL_USER_STATS: UserStats = {
  partnershipCount: 0,
  totalXParceria: 0,
  totalEncounters: 0,
  daysUsing: 0,
  strongestPartnershipId: null,
};

export const INITIAL_USER_SETTINGS: UserSettings = {
  shareLocation: true,
  ritualHour: 19,
  notifications: { ritual: true, challenges: true, encounters: true },
};
```

`INITIAL_USER_STATS` não é conveniência: a regra de segurança da Task 6 exige que o
cliente crie o perfil **exatamente** com esses zeros, e o teste de rules compara contra
este objeto. Uma única fonte da verdade.

- [ ] **Step 5: Implementar as fórmulas de nível**

`shared/level.ts`:

```ts
import { LEVEL } from './constants';

/** XParceria necessário para sair do nível informado. */
export function xpForNextLevel(level: number): number {
  return LEVEL.BASE + LEVEL.SLOPE * level;
}

/** XParceria acumulado necessário para ter atingido o nível informado. */
export function totalXpForLevel(level: number): number {
  const n = level - 1;
  return LEVEL.BASE * n + (LEVEL.SLOPE * n * (n + 1)) / 2;
}
```

- [ ] **Step 6: Rodar os testes de nível**

Run: `npx jest shared/__tests__/level.test.ts`
Expected: PASS — todos.

- [ ] **Step 7: Escrever os testes de temperatura (que vão falhar)**

Os limites das faixas são o que a interface colore. Testar as **bordas** é o ponto.

`shared/__tests__/temperature.test.ts`:

```ts
import { bandForTemperature, clampTemperature } from '../temperature';

describe('bandForTemperature', () => {
  it.each([
    [100, 'burning'], [85, 'burning'],
    [84, 'warm'],     [60, 'warm'],
    [59, 'mild'],     [35, 'mild'],
    [34, 'cooling'],  [15, 'cooling'],
    [14, 'hibernating'], [0, 'hibernating'],
  ])('temperatura %i cai na faixa %s', (temp, expected) => {
    expect(bandForTemperature(temp).id).toBe(expected);
  });

  it('trata valores fora do intervalo sem explodir', () => {
    expect(bandForTemperature(-10).id).toBe('hibernating');
    expect(bandForTemperature(999).id).toBe('burning');
  });

  it('toda faixa tem emoji, rótulo e cor', () => {
    for (const t of [100, 70, 40, 20, 5]) {
      const band = bandForTemperature(t);
      expect(band.emoji).toBeTruthy();
      expect(band.label).toBeTruthy();
      expect(band.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe('clampTemperature', () => {
  it.each([[-5, 0], [0, 0], [50, 50], [100, 100], [140, 100]])(
    'limita %i em %i', (input, expected) => {
      expect(clampTemperature(input)).toBe(expected);
    });
});
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `npx jest shared/__tests__/temperature.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 9: Implementar**

`shared/temperature.ts`:

```ts
import { TEMPERATURE, TEMPERATURE_BANDS } from './constants';
import type { TemperatureBand } from './types';

export function clampTemperature(value: number): number {
  return Math.min(TEMPERATURE.MAX, Math.max(TEMPERATURE.MIN, value));
}

/** TEMPERATURE_BANDS está ordenado do maior `min` para o menor. */
export function bandForTemperature(temp: number): TemperatureBand {
  const value = clampTemperature(temp);
  const band = TEMPERATURE_BANDS.find((b) => value >= b.min);
  // O último elemento tem min = 0, então sempre há correspondência.
  return band ?? TEMPERATURE_BANDS[TEMPERATURE_BANDS.length - 1]!;
}
```

- [ ] **Step 10: Rodar tudo**

Run: `npm run validate`
Expected: PASS — todos os testes; `tsc` limpo.

- [ ] **Step 11: Commit**

```bash
git add shared/
git commit -m "feat: add shared domain constants and pure level/temperature formulas"
```

---

## Task 3: Design system — tokens e superfícies

**Files:**
- Create: `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`
- Create: `src/core/ui/theme.ts`, `src/core/ui/GlassCard.tsx`, `src/core/ui/Button.tsx`
- Modify: `app/_layout.tsx` (importar `global.css`)
- Test: `src/core/ui/__tests__/theme.test.ts`,
  `src/core/ui/__tests__/Button.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`TEMPERATURE_BANDS` para a paleta semântica)
- Produces:
  - `theme` com `colors`, `type`, `space`, `radius`, `glass`, `motion`
  - `<GlassCard>` — props: `children`, `intensity?`, `style?`
  - `<Button variant="primary"|"glass"|"ghost"|"danger">` — props: `label`,
    `onPress`, `disabled?`, `loading?`

- [ ] **Step 1: Configurar o Tailwind e o NativeWind**

`tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink:   { 900: '#0A0A0B', 700: '#2E2E33', 500: '#6B6B75', 300: '#A8A8B3', 100: '#E8E8ED' },
        paper: { 0: '#FFFFFF', 50: '#FAFAFC', 100: '#F4F4F7' },
        brand: { 600: '#4A3AFF', 500: '#5B4BFF', 400: '#7C6FFF', 100: '#EDEBFF' },
        temp:  {
          burning: '#FF4D4D', warm: '#FF9A3C', mild: '#FFD166',
          cooling: '#7CC4FF', hibernating: '#B8C4D9',
        },
      },
      borderRadius: { sheet: '32px' },
    },
  },
  plugins: [],
};
```

`global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`nativewind-env.d.ts`:

```ts
/// <reference types="nativewind/types" />
```

`expo-env.d.ts` — **obrigatório, e é o que faz o import do CSS compilar**:

```ts
/// <reference types="expo/types" />

// NOTE: This file should not be edited and should be committed with your source code.
// It is generated by Expo.
```

> Sem esse arquivo, `import '../global.css'` quebra o `tsc` com
> `TS2882: Cannot find module or type declarations for side-effect import of '../global.css'`.
> Quem declara `declare module '*.css'` é `expo/types/global.d.ts`, e ele só entra no
> programa TypeScript por esta referência. O `nativewind/types` **não** declara CSS — ele
> só tipa a prop `className`. Normalmente o `expo start` gera esse arquivo sozinho; como
> o `tsconfig.json` da Task 1 já o lista em `include` mas o scaffold não o criou, ele
> precisa ser escrito à mão aqui.

Em `metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

module.exports = withNativeWind(getDefaultConfig(__dirname), { input: './global.css' });
```

E `import '../global.css';` no topo de `app/_layout.tsx`.

- [ ] **Step 2: Escrever o teste dos tokens (que vai falhar)**

O teste que importa aqui é o de **consistência**: a paleta de temperatura do tema tem
que ser exatamente a mesma de `shared/constants.ts`. Duas fontes divergindo é um bug
silencioso que só aparece no olho do usuário.

`src/core/ui/__tests__/theme.test.ts`:

```ts
import { theme } from '../theme';
import { TEMPERATURE_BANDS } from '@shared/constants';

describe('theme', () => {
  it('a paleta de temperatura é idêntica à do domínio', () => {
    for (const band of TEMPERATURE_BANDS) {
      expect(theme.colors.temp[band.id]).toBe(band.color);
    }
  });

  it('a escala de espaço é múltipla de 4', () => {
    for (const value of theme.space) {
      expect(value % 4).toBe(0);
    }
  });

  it('todo estilo de texto usa tabular-nums onde há número', () => {
    expect(theme.type.display.fontVariant).toContain('tabular-nums');
    expect(theme.type.title.fontVariant).toContain('tabular-nums');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest src/core/ui/__tests__/theme.test.ts`
Expected: FAIL — `Cannot find module '../theme'`

- [ ] **Step 4: Implementar os tokens**

`src/core/ui/theme.ts`:

```ts
import type { TextStyle } from 'react-native';
import { TEMPERATURE_BANDS } from '@shared/constants';
import type { TemperatureBandId } from '@shared/types';

const tempColors = Object.fromEntries(
  TEMPERATURE_BANDS.map((b) => [b.id, b.color]),
) as Record<TemperatureBandId, string>;

// Sem `as const`: um array readonly não é atribuível a TextStyle['fontVariant'],
// e o erro só apareceria lá na frente, ao espalhar o token dentro de StyleSheet.
const numeric: { fontVariant: TextStyle['fontVariant'] } = {
  fontVariant: ['tabular-nums'],
};

export const theme = {
  colors: {
    ink:   { 900: '#0A0A0B', 700: '#2E2E33', 500: '#6B6B75', 300: '#A8A8B3', 100: '#E8E8ED' },
    paper: { 0: '#FFFFFF', 50: '#FAFAFC', 100: '#F4F4F7' },
    brand: { 600: '#4A3AFF', 500: '#5B4BFF', 400: '#7C6FFF', 100: '#EDEBFF' },
    temp: tempColors,
    success: '#22C55E', warning: '#F59E0B', danger: '#EF4444',
  },
  type: {
    display:  { fontSize: 34, fontWeight: '700', letterSpacing: -0.5, ...numeric },
    title:    { fontSize: 24, fontWeight: '700', letterSpacing: -0.3, ...numeric },
    headline: { fontSize: 18, fontWeight: '600', ...numeric },
    body:     { fontSize: 16, fontWeight: '400', lineHeight: 24 },
    callout:  { fontSize: 15, fontWeight: '500' },
    caption:  { fontSize: 13, fontWeight: '500' },
    micro:    { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  },
  space: [0, 4, 8, 12, 16, 24, 32, 48, 64],
  radius: { sm: 8, md: 12, lg: 20, xl: 28, sheet: 32, full: 9999 },
  glass: { intensity: 60, tint: 'light' as const, border: 'rgba(255,255,255,0.35)' },
  motion: {
    duration: { instant: 120, fast: 200, base: 300, slow: 500, ceremony: 2400 },
    spring: {
      gentle: { damping: 20, stiffness: 180 },
      bouncy: { damping: 12, stiffness: 220 },
    },
  },
};
```

A paleta de temperatura é **derivada** de `TEMPERATURE_BANDS`, não redigitada. O teste
do Step 2 nunca poderia falhar por divergência — e é exatamente esse o objetivo do
desenho.

- [ ] **Step 5: Amarrar a paleta do Tailwind ao domínio**

`theme.ts` deriva a paleta de `TEMPERATURE_BANDS`, mas o `tailwind.config.js` é CJS e não
consegue importar TypeScript sem tooling extra — então ali os hex ficam redigitados. São
**duas superfícies** com a mesma cor, e sem guarda a segunda diverge em silêncio quando
`TEMPERATURE_BANDS` mudar.

`src/core/ui/__tests__/tailwind-palette.test.ts`:

```ts
import { TEMPERATURE_BANDS } from '@shared/constants';

const tailwindConfig = require('../../../../tailwind.config.js');
const temp = tailwindConfig.theme.extend.colors.temp as Record<string, string>;

describe('paleta do tailwind.config.js', () => {
  it('é idêntica à do domínio', () => {
    for (const band of TEMPERATURE_BANDS) {
      expect(temp[band.id]).toBe(band.color);
    }
  });

  it('não tem nenhuma cor de temperatura a mais', () => {
    expect(Object.keys(temp).sort()).toEqual(
      TEMPERATURE_BANDS.map((b) => b.id).sort(),
    );
  });
});
```

O segundo teste importa tanto quanto o primeiro: sem ele, uma faixa removida do domínio
continuaria existindo como classe do Tailwind sem ninguém notar.

- [ ] **Step 6: Rodar os testes dos tokens**

Run: `npx jest src/core/ui/__tests__/`
Expected: PASS

- [ ] **Step 6: Escrever o teste do Button (que vai falhar)**

`src/core/ui/__tests__/Button.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('mostra o rótulo e dispara onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continuar" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Continuar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('não dispara onPress quando desabilitado', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continuar" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByText('Continuar'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('não dispara onPress enquanto carrega', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continuar" onPress={onPress} loading />);
    await fireEvent.press(screen.getByLabelText('Continuar'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('expõe papel e estado de acessibilidade', async () => {
    await render(<Button label="Continuar" onPress={jest.fn()} disabled />);
    const button = screen.getByLabelText('Continuar');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx jest src/core/ui/__tests__/Button.test.tsx`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 8: Implementar `GlassCard` e `Button`**

`src/core/ui/GlassCard.tsx`:

```tsx
import { BlurView } from 'expo-blur';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { theme } from './theme';

type Props = ViewProps & { intensity?: number };

export function GlassCard({ intensity = theme.glass.intensity, style, children, ...rest }: Props) {
  return (
    <View style={[styles.wrapper, style]} {...rest}>
      <BlurView intensity={intensity} tint={theme.glass.tint} style={StyleSheet.absoluteFill} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.glass.border,
  },
  content: { padding: theme.space[4] },
});
```

`src/core/ui/Button.tsx`:

```tsx
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from './theme';

type Variant = 'primary' | 'glass' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
};

const BACKGROUND: Record<Variant, string> = {
  primary: theme.colors.brand[500],
  glass: 'rgba(255,255,255,0.6)',
  ghost: 'transparent',
  danger: theme.colors.danger,
};

const FOREGROUND: Record<Variant, string> = {
  primary: theme.colors.paper[0],
  glass: theme.colors.ink[900],
  ghost: theme.colors.ink[700],
  danger: theme.colors.paper[0],
};

export function Button({ label, onPress, variant = 'primary', disabled, loading }: Props) {
  const blocked = disabled === true || loading === true;

  function handlePress() {
    if (blocked) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy: loading === true }}
      // `disabled` nativo além da guarda em handlePress: sem ele o Pressable continua
      // capturando o toque como gesture responder mesmo desabilitado.
      disabled={blocked}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: BACKGROUND[variant], opacity: blocked ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading === true
        ? <ActivityIndicator color={FOREGROUND[variant]} />
        : <Text style={[styles.label, { color: FOREGROUND[variant] }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space[5],
  },
  label: { fontSize: theme.type.callout.fontSize, fontWeight: '600' },
});
```

`accessibilityLabel` sempre presente é o que permite o teste encontrar o botão mesmo
quando o texto some (estado `loading`).

- [ ] **Step 9: Rodar a validação**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add design tokens, GlassCard and Button"
```

---

## Task 4: Avatar, anel de progresso e barra de XParceria

**Files:**
- Create: `src/core/ui/Avatar.tsx`, `src/core/ui/ProgressRing.tsx`,
  `src/core/ui/XParceriaBar.tsx`
- Test: `src/core/ui/__tests__/Avatar.test.tsx`,
  `src/core/ui/__tests__/XParceriaBar.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`bandForTemperature`, `xpForNextLevel`), Task 3 (`theme`)
- Produces:
  - `<Avatar photoURL, fallbackEmoji, size?, temperature?>` — com `temperature`
    definida, desenha o anel colorido da faixa
  - `<ProgressRing progress: 0..1, color, size, strokeWidth, children?>`
  - `<XParceriaBar level: number, xpIntoLevel: number>` — rótulo
    `"{xpIntoLevel} / {xpForNextLevel(level)} XParceria"`

- [ ] **Step 1: Escrever os testes (que vão falhar)**

`src/core/ui/__tests__/XParceriaBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { XParceriaBar } from '../XParceriaBar';

describe('XParceriaBar', () => {
  it('mostra progresso contra o custo do nível atual', async () => {
    // nível 18 exige 496 para o próximo (ver shared/level.ts)
    await render(<XParceriaBar level={18} xpIntoLevel={420} />);
    expect(screen.getByText('420 / 496 XParceria')).toBeTruthy();
  });

  it('nunca escreve a palavra "XP" sozinha na interface', async () => {
    await render(<XParceriaBar level={3} xpIntoLevel={10} />);
    expect(screen.queryByText(/\bXP\b/)).toBeNull();
  });

  it('expõe o progresso para leitores de tela', async () => {
    await render(<XParceriaBar level={18} xpIntoLevel={420} />);
    const bar = screen.getByLabelText('Progresso de XParceria');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 496, now: 420 });
  });
});
```

`src/core/ui/__tests__/Avatar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { Avatar } from '../Avatar';

describe('Avatar', () => {
  it('mostra o emoji quando não há foto', async () => {
    await render(<Avatar photoURL={null} fallbackEmoji="🦊" />);
    expect(screen.getByText('🦊')).toBeTruthy();
  });

  it('esconde o emoji quando há foto', async () => {
    await render(<Avatar photoURL="https://exemplo.com/a.jpg" fallbackEmoji="🦊" />);
    expect(screen.queryByText('🦊')).toBeNull();
  });

  it('colore o anel pela faixa de temperatura', async () => {
    await render(<Avatar photoURL={null} fallbackEmoji="🦊" temperature={90} />);
    expect(screen.getByLabelText('Parceria em chamas')).toBeTruthy();
  });

  it('não desenha anel sem temperatura', async () => {
    await render(<Avatar photoURL={null} fallbackEmoji="🦊" />);
    expect(screen.queryByLabelText(/^Parceria /)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/core/ui/__tests__/`
Expected: FAIL nos dois arquivos novos — módulos não encontrados.

- [ ] **Step 2b: Mockar o `expo-image` (gap do `jest-expo@57.0.3`)**

Qualquer suíte que importe `expo-image` **quebra ao carregar**, antes de rodar qualquer
teste, com `TypeError: observe.getIntegrations is not a function`.

A causa é upstream e verificável: `expo-image@57.0.2` chama `observe.getIntegrations()`
no momento do import (`node_modules/expo-image/src/observe.ts:159`), mas o mock nativo de
`ExpoObserve` que o `jest-expo@57.0.3` fornece só implementa `configure`,
`dispatchEvents`, `setBundleDefaults` e `addListener` — `getIntegrations` não existe. Os
dois pacotes são do mesmo SDK 57; é um descompasso entre eles, não erro nosso.

`__mocks__/expo-image.js` na raiz do projeto:

```js
// Existe por um gap do jest-expo@57.0.3: o mock nativo de ExpoObserve não implementa
// getIntegrations(), que o expo-image@57.0.2 chama no import (src/observe.ts:159).
// Sem isso, toda suíte que importa expo-image quebra ao carregar.
// REMOVER quando o jest-expo corrigir o mock — e conferir se o Avatar ainda passa.
const React = require('react');
const { Image: RNImage } = require('react-native');

function Image(props) {
  return React.createElement(RNImage, props);
}

module.exports = { Image, ImageBackground: Image };
```

Jest aplica `__mocks__/<pacote>.js` da raiz automaticamente para módulos de
`node_modules`, sem precisar de `jest.mock()`.

> **Por que mockar em vez de remendar o mock do `ExpoObserve`:** remendar dependeria da
> estrutura interna do `jest-expo`, que muda entre versões. E o que o teste do `Avatar`
> verifica é a **nossa** lógica — emoji quando não há foto, imagem quando há — não a
> decodificação de imagem do `expo-image`. Mockar a fronteira é o certo aqui.
>
> **Não trocar por `Image` do `react-native`** no código de produção: o `expo-image` foi
> escolhido pelo cache e desempenho. A troca vale só dentro do mock de teste.

- [ ] **Step 3: Implementar `ProgressRing`**

`src/core/ui/ProgressRing.tsx`:

```tsx
import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  progress: number;       // 0..1
  color: string;
  size: number;
  strokeWidth?: number;
  children?: ReactNode;
};

/**
 * Anel simples por borda. A versão animada com SVG entra na Spec 3,
 * quando o mapa precisar dela — YAGNI até lá.
 */
export function ProgressRing({ progress, color, size, strokeWidth = 3, children }: Props) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View
      style={[
        styles.ring,
        {
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: color,
          opacity: 0.35 + clamped * 0.65,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: Implementar `Avatar`**

`src/core/ui/Avatar.tsx`:

```tsx
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { bandForTemperature } from '@shared/temperature';
import { ProgressRing } from './ProgressRing';
import { theme } from './theme';

type Props = {
  photoURL: string | null;
  fallbackEmoji: string;
  size?: number;
  temperature?: number;
};

export function Avatar({ photoURL, fallbackEmoji, size = 48, temperature }: Props) {
  const inner = (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {photoURL !== null
        ? <Image source={{ uri: photoURL }} style={StyleSheet.absoluteFill} contentFit="cover" />
        : <Text style={{ fontSize: size * 0.5 }}>{fallbackEmoji}</Text>}
    </View>
  );

  if (temperature === undefined) return inner;

  const band = bandForTemperature(temperature);
  return (
    <View accessibilityLabel={`Parceria ${band.label.toLowerCase()}`}>
      <ProgressRing progress={temperature / 100} color={band.color} size={size + 10}>
        {inner}
      </ProgressRing>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: theme.colors.paper[100],
  },
});
```

- [ ] **Step 5: Implementar `XParceriaBar`**

`src/core/ui/XParceriaBar.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { xpForNextLevel } from '@shared/level';
import { theme } from './theme';

type Props = { level: number; xpIntoLevel: number };

export function XParceriaBar({ level, xpIntoLevel }: Props) {
  const target = xpForNextLevel(level);
  const progress = Math.min(1, Math.max(0, xpIntoLevel / target));

  return (
    <View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Progresso de XParceria"
        accessibilityValue={{ min: 0, max: target, now: xpIntoLevel }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.label}>{`${xpIntoLevel} / ${target} XParceria`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.ink[100],
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: theme.colors.brand[500] },
  label: {
    marginTop: theme.space[2],
    fontSize: theme.type.caption.fontSize,
    color: theme.colors.ink[500],
    fontVariant: theme.type.title.fontVariant,
  },
});
```

- [ ] **Step 6: Rodar a validação**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Avatar, ProgressRing and XParceriaBar components"
```

---

## Task 5: Cliente Firebase e emuladores

**Files:**
- Create: `src/core/firebase/client.ts`, `src/core/firebase/errors.ts`
- Create: `firebase.json`, `.firebaserc`, `.env.example`
- Modify: `.gitignore` (adicionar `.env`)
- Test: `src/core/firebase/__tests__/errors.test.ts`

**Interfaces:**
- Consumes: Task 1 (toolchain)
- Produces: `app`, `auth`, `db` exportados de `@/core/firebase/client`;
  `authErrorMessage(code: string): string`

- [ ] **Step 1: Instalar o Java (pré-requisito do emulador)**

O emulador do Firestore roda na JVM. Nesta máquina o `/usr/bin/java` é apenas o stub do
macOS — **o emulador falha com uma mensagem confusa sem esse passo**.

```bash
brew install --cask temurin
java -version
```

Expected: imprime uma versão (ex.: `openjdk version "21..."`), não a mensagem
"Unable to locate a Java Runtime".

- [ ] **Step 2: Criar o projeto no console do Firebase**

Manual, no console: criar o projeto (ID real: **`parceria-db699`**), habilitar **Authentication →
Email/Password** e criar o **Firestore** em modo de produção (as regras vêm da Task 6).
Registrar um app **Web** (não iOS/Android — o JS SDK usa a config web) e copiar as
credenciais.

- [ ] **Step 3: Configurar as variáveis de ambiente**

Variáveis com prefixo `EXPO_PUBLIC_` são inlinadas no bundle pelo Expo. Elas não são
segredo — a config web do Firebase é pública por desenho, e quem protege os dados são as
security rules da Task 6.

`.env.example` (versionado):

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_USE_EMULATOR=0
```

```bash
cp .env.example .env    # preencher com os valores reais
echo ".env" >> .gitignore
```

- [ ] **Step 4: Configurar os emuladores**

`firebase.json`:

```json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "emulators": {
    "auth":      { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui":        { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

`.firebaserc`:

```json
{ "projects": { "default": "parceria-db699" } }
```

`firestore.indexes.json` (vazio por ora; os índices compostos chegam na Spec 3):

```json
{ "indexes": [], "fieldOverrides": [] }
```

- [ ] **Step 5: Escrever o teste de tradução de erro (que vai falhar)**

`src/core/firebase/__tests__/errors.test.ts`:

```ts
import { authErrorMessage } from '../errors';

describe('authErrorMessage', () => {
  it.each([
    ['auth/invalid-email', 'E-mail inválido.'],
    ['auth/email-already-in-use', 'Esse e-mail já está em uso.'],
    ['auth/weak-password', 'A senha precisa ter pelo menos 6 caracteres.'],
    ['auth/invalid-credential', 'E-mail ou senha incorretos.'],
    ['auth/network-request-failed', 'Sem conexão. Tenta de novo.'],
  ])('traduz %s', (code, expected) => {
    expect(authErrorMessage(code)).toBe(expected);
  });

  it('cai numa mensagem genérica para código desconhecido', () => {
    expect(authErrorMessage('auth/algo-novo')).toBe('Algo deu errado. Tenta de novo.');
  });

  it('nunca vaza o código cru do Firebase para o usuário', () => {
    for (const code of ['auth/invalid-email', 'auth/algo-novo', '']) {
      expect(authErrorMessage(code)).not.toContain('auth/');
    }
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npx jest src/core/firebase/__tests__/errors.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 7: Implementar a tradução de erros**

`src/core/firebase/errors.ts`:

```ts
const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/email-already-in-use': 'Esse e-mail já está em uso.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/too-many-requests': 'Muitas tentativas. Espera um pouco.',
  'auth/network-request-failed': 'Sem conexão. Tenta de novo.',
};

export function authErrorMessage(code: string): string {
  return MESSAGES[code] ?? 'Algo deu errado. Tenta de novo.';
}
```

- [ ] **Step 7b: Declarar `getReactNativePersistence` (augmentação de módulo)**

`customConditions: ["react-native"]` no `tsconfig.json` **não basta** — descoberto em
execução. O `exports` de `@firebase/auth@1.13.4` lista as chaves nesta ordem:

```
['types', 'node', 'react-native', 'cordova', 'webworker', 'browser', 'default']
```

A resolução condicional usa **a primeira chave que casa, na ordem do `package.json`** —
e o TypeScript sempre casa `types`. Então ele para em `dist/auth-public.d.ts`, que não
declara `getReactNativePersistence`, sem nunca chegar em `dist/rn/index.rn.d.ts`, que
declara. Em runtime funciona (o Metro resolve pela condição `react-native`); só os tipos
não enxergam. Já estamos na versão mais recente do `firebase` — não há upgrade que
resolva.

`types/firebase-auth.d.ts`:

```ts
// O exports de @firebase/auth lista "types" antes de "react-native", então o tsc para
// em auth-public.d.ts e nunca vê getReactNativePersistence — que existe em runtime
// (dist/rn/index.rn.d.ts) e é resolvido normalmente pelo Metro.
// Declaramos aqui o que de fato existe. REMOVER quando o upstream reordenar as chaves.
import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
```

`Persistence` e `ReactNativeAsyncStorage` **já são exportados** pelos tipos padrão
(`auth-public.d.ts:2399` e `:2748`) — só a função falta, então a augmentação é mínima e
não reescreve nenhum tipo.

> **Por que não `@ts-ignore` nem `as any`:** os dois desligam a checagem no ponto de uso e
> apagariam um erro real se a assinatura mudasse. A augmentação declara exatamente o que
> existe e continua verificando o argumento.
>
> **Por que não import de subpath profundo** (`firebase/auth/dist/rn/...`): amarra o
> código a um caminho interno do pacote, que quebra em qualquer refatoração do upstream.
>
> **Nota sobre a versão do AsyncStorage:** com a v2 (que é a instalada, 2.2.0) o import é
> default — `import AsyncStorage from '@react-native-async-storage/async-storage'`. A v3
> mudou para `createAsyncStorage('app')`; se o pacote for atualizado, este ponto muda.

- [ ] **Step 8: Implementar o cliente**

`src/core/firebase/client.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length > 0 ? getApp() : initializeApp(config);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// React Native não suporta os streams que o Firestore usa por padrão.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

if (process.env.EXPO_PUBLIC_USE_EMULATOR === '1') {
  // No Expo Go o app roda num aparelho físico: "localhost" seria o próprio celular.
  // `hostUri` traz o IP da máquina do Metro, que é onde os emuladores estão.
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
```

> **O truque do `hostUri` é o que evita uma hora de depuração.** Com o app rodando no
> celular pelo Expo Go, `localhost` aponta para o próprio aparelho e a conexão com o
> emulador falha por timeout, sem mensagem útil.

- [ ] **Step 9: Verificar que os emuladores sobem**

Run: `npx firebase emulators:start --only auth,firestore`
Expected: emuladores em pé; UI acessível em `http://localhost:4000`. Encerrar com Ctrl-C.

- [ ] **Step 10: Rodar a validação**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add firebase client with RN persistence and emulator wiring"
```

---

## Task 6: Security rules e a suíte de negação

A task mais importante da spec. **Toda escrita de progressão é negada no cliente desde
já** — antes mesmo de existir progressão. Quando a Spec 4 chegar, a porta já está
fechada.

**Files:**
- Create: `firestore.rules`, `jest.rules.config.js`
- Create: `tests/rules/helpers.ts`, `tests/rules/users.test.ts`,
  `tests/rules/handles.test.ts`, `tests/rules/locked.test.ts`
- Modify: `package.json` (script `test:rules`, incluir em `validate`)

**Interfaces:**
- Consumes: Task 2 (`INITIAL_USER_STATS`), Task 5 (emuladores, `firebase.json`)
- Produces: `firestore.rules` cobrindo `users`, `handles`, `partnerships`, `presence`,
  `invites`; helper `getTestEnv()` para as tasks seguintes

- [ ] **Step 1: Configurar o runner de rules**

Testes de rules rodam em Node contra o emulador — não podem usar o preset `jest-expo`.

`jest.rules.config.js`:

```js
module.exports = {
  displayName: 'rules',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/rules/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
};
```

Em `package.json`:

```json
"scripts": {
  "test:rules": "firebase emulators:exec --only firestore \"jest -c jest.rules.config.js\"",
  "validate": "npm run typecheck && npm test && npm run test:rules"
}
```

- [ ] **Step 2: Escrever o helper**

`tests/rules/helpers.ts`:

```ts
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

export const ALICE = 'alice-uid';
export const BOB = 'bob-uid';
export const CAROL = 'carol-uid';

export async function createTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'parceria-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
}

export const INITIAL_STATS = {
  partnershipCount: 0,
  totalXParceria: 0,
  totalEncounters: 0,
  daysUsing: 0,
  strongestPartnershipId: null,
};

export function validProfile(uid: string, handle: string) {
  return {
    uid,
    displayName: 'Alguém',
    handle,
    photoURL: null,
    avatarEmoji: '🦊',
    timezone: 'America/Sao_Paulo',
    stats: INITIAL_STATS,
    settings: {
      shareLocation: true,
      ritualHour: 19,
      notifications: { ritual: true, challenges: true, encounters: true },
    },
  };
}
```

- [ ] **Step 3: Escrever os testes de `users` (que vão falhar)**

`tests/rules/users.test.ts`:

```ts
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ALICE, BOB, createTestEnv, validProfile } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('users — permitido', () => {
  it('o dono cria o próprio perfil com stats zerados', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, 'users', ALICE), validProfile(ALICE, 'alice')));
  });

  it('o dono edita displayName', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await setDoc(doc(db, 'users', ALICE), validProfile(ALICE, 'alice'));
    await assertSucceeds(updateDoc(doc(db, 'users', ALICE), { displayName: 'Gabriel' }));
  });

  it('qualquer autenticado lê perfil alheio (necessário para o mapa)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE), validProfile(ALICE, 'alice'));
    });
    const db = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(doc(db, 'users', ALICE)));
  });
});

describe('users — NEGADO', () => {
  it('anônimo não lê perfil', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users', ALICE)));
  });

  it('não cria perfil no uid de outro', async () => {
    const db = env.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, 'users', ALICE), validProfile(ALICE, 'alice')));
  });

  it('não cria perfil com stats inflados', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    const cheat = { ...validProfile(ALICE, 'alice'), stats: { ...validProfile(ALICE, 'a').stats, totalXParceria: 999999 } };
    await assertFails(setDoc(doc(db, 'users', ALICE), cheat));
  });

  it('não altera stats depois de criado', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await setDoc(doc(db, 'users', ALICE), validProfile(ALICE, 'alice'));
    await assertFails(updateDoc(doc(db, 'users', ALICE), {
      stats: { ...validProfile(ALICE, 'a').stats, totalXParceria: 500 },
    }));
  });

  it('não troca o handle por escrita direta', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await setDoc(doc(db, 'users', ALICE), validProfile(ALICE, 'alice'));
    await assertFails(updateDoc(doc(db, 'users', ALICE), { handle: 'outro' }));
  });

  it('não edita perfil alheio', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE), validProfile(ALICE, 'alice'));
    });
    const db = env.authenticatedContext(BOB).firestore();
    await assertFails(updateDoc(doc(db, 'users', ALICE), { displayName: 'invadido' }));
  });

  it('ninguém apaga perfil pelo cliente', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await setDoc(doc(db, 'users', ALICE), validProfile(ALICE, 'alice'));
    await assertFails(deleteDoc(doc(db, 'users', ALICE)));
  });
});
```

- [ ] **Step 4: Escrever os testes das coleções trancadas**

Estas coleções ainda não têm funcionalidade — mas a porta fecha agora.

`tests/rules/locked.test.ts`:

```ts
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
// Imports estáticos: `await import()` dinâmico quebra neste projeto com
// `TypeError: A dynamic import callback was invoked without --experimental-vm-modules`
// (Babel/Jest rodam em CJS). Vale para todas as suítes de rules.
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('partnerships — só Cloud Function escreve', () => {
  it('membro lê a própria parceria', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'partnerships', `${ALICE}_${BOB}`), {
        members: [ALICE, BOB], status: 'active', xparceria: 100, level: 1,
      });
    });
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(getDoc(doc(db, 'partnerships', `${ALICE}_${BOB}`)));
  });

  it('NEGA leitura de quem não é membro', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'partnerships', `${ALICE}_${BOB}`), {
        members: [ALICE, BOB], status: 'active', xparceria: 100, level: 1,
      });
    });
    const db = env.authenticatedContext(CAROL).firestore();
    await assertFails(getDoc(doc(db, 'partnerships', `${ALICE}_${BOB}`)));
  });

  it('NEGA criação de parceria pelo cliente', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'partnerships', `${ALICE}_${BOB}`), {
      members: [ALICE, BOB], status: 'active', xparceria: 0, level: 1,
    }));
  });

  it('NEGA o membro inflar o próprio XParceria', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'partnerships', `${ALICE}_${BOB}`), {
        members: [ALICE, BOB], status: 'active', xparceria: 100, level: 1,
      });
    });
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, 'partnerships', `${ALICE}_${BOB}`), { xparceria: 999999 }));
  });

  it('NEGA leitura de subcoleção por quem não é membro', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const fs = ctx.firestore();
      await setDoc(doc(fs, 'partnerships', `${ALICE}_${BOB}`), { members: [ALICE, BOB], status: 'active' });
      await setDoc(doc(fs, 'partnerships', `${ALICE}_${BOB}`, 'days', '2026-08-04'), { date: '2026-08-04' });
    });
    const db = env.authenticatedContext(CAROL).firestore();
    await assertFails(getDoc(doc(db, 'partnerships', `${ALICE}_${BOB}`, 'days', '2026-08-04')));
  });
});

describe('presence — visibleTo é a única porta', () => {
  it('parceiro em visibleTo lê a localização', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'presence', ALICE), { uid: ALICE, visibleTo: [BOB] });
    });
    const db = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(getDoc(doc(db, 'presence', ALICE)));
  });

  it('NEGA quem não está em visibleTo — sem parceria, a localização não existe', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'presence', ALICE), { uid: ALICE, visibleTo: [BOB] });
    });
    const db = env.authenticatedContext(CAROL).firestore();
    await assertFails(getDoc(doc(db, 'presence', ALICE)));
  });

  it('NEGA escrever a localização de outro', async () => {
    const db = env.authenticatedContext(BOB).firestore();
    await assertFails(setDoc(doc(db, 'presence', ALICE), { uid: ALICE, visibleTo: [BOB] }));
  });

  it('NEGA um estranho se adicionar ao visibleTo alheio', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'presence', ALICE), { uid: ALICE, visibleTo: [] });
    });
    const db = env.authenticatedContext(CAROL).firestore();
    await assertFails(updateDoc(doc(db, 'presence', ALICE), { visibleTo: [CAROL] }));
  });

  // ⭐ O teste mais importante do produto: nem o DONO pode mexer no próprio visibleTo.
  // Sem ele, `allow update: if isOwner(uid)` sozinho passaria na suíte inteira — e
  // qualquer um se adicionaria à própria lista de visibilidade para ler quem quisesse.
  it('NEGA o próprio dono alterar o próprio visibleTo', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'presence', ALICE), { uid: ALICE, visibleTo: [] });
    });
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(updateDoc(doc(db, 'presence', ALICE), { visibleTo: [CAROL] }));
  });

  it('permite o dono atualizar a localização mantendo o visibleTo', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'presence', ALICE), { uid: ALICE, visibleTo: [BOB] });
    });
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(
      updateDoc(doc(db, 'presence', ALICE), { visibleTo: [BOB], isStale: false }),
    );
  });

  it('NEGA anônimo ler presença', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'presence', ALICE), { uid: ALICE, visibleTo: [BOB] });
    });
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'presence', ALICE)));
  });

  it('o dono escreve a própria localização', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(setDoc(doc(db, 'presence', ALICE), { uid: ALICE, visibleTo: [] }));
  });
});
```

- [ ] **Step 5: Escrever os testes de `handles`**

`tests/rules/handles.test.ts`:

```ts
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ALICE, BOB, createTestEnv } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

it('reivindica um handle livre apontando para si', async () => {
  const db = env.authenticatedContext(ALICE).firestore();
  await assertSucceeds(setDoc(doc(db, 'handles', 'gabriel'), { uid: ALICE }));
});

it('qualquer autenticado consulta disponibilidade', async () => {
  const db = env.authenticatedContext(BOB).firestore();
  await assertSucceeds(getDoc(doc(db, 'handles', 'gabriel')));
});

it('NEGA reivindicar handle apontando para outro uid', async () => {
  const db = env.authenticatedContext(BOB).firestore();
  await assertFails(setDoc(doc(db, 'handles', 'gabriel'), { uid: ALICE }));
});

it('NEGA roubar handle já reivindicado', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'handles', 'gabriel'), { uid: ALICE });
  });
  const db = env.authenticatedContext(BOB).firestore();
  await assertFails(setDoc(doc(db, 'handles', 'gabriel'), { uid: BOB }));
  await assertFails(updateDoc(doc(db, 'handles', 'gabriel'), { uid: BOB }));
  await assertFails(deleteDoc(doc(db, 'handles', 'gabriel')));
});

it('NEGA anônimo reivindicar', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, 'handles', 'gabriel'), { uid: ALICE }));
});
```

- [ ] **Step 5b: Escrever os testes de `invites`**

`tests/rules/invites.test.ts`:

```ts
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ALICE, BOB, createTestEnv } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

function invite(fromUid: string) {
  return {
    code: 'ABC12345',
    fromUid,
    fromProfile: { displayName: 'Alguém', photoURL: null },
    status: 'pending',
    maxUses: 1,
    usedBy: null,
  };
}

it('cria convite em nome próprio', async () => {
  const db = env.authenticatedContext(ALICE).firestore();
  await assertSucceeds(setDoc(doc(db, 'invites', 'ABC12345'), invite(ALICE)));
});

it('NEGA criar convite em nome de outro', async () => {
  const db = env.authenticatedContext(BOB).firestore();
  await assertFails(setDoc(doc(db, 'invites', 'ABC12345'), invite(ALICE)));
});

it('autenticado lê convite (precisa disso para aceitar)', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'invites', 'ABC12345'), invite(ALICE));
  });
  const db = env.authenticatedContext(BOB).firestore();
  await assertSucceeds(getDoc(doc(db, 'invites', 'ABC12345')));
});

it('NEGA anônimo ler convite', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'invites', 'ABC12345'), invite(ALICE));
  });
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'invites', 'ABC12345')));
});

it('NEGA marcar convite como usado pelo cliente', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'invites', 'ABC12345'), invite(ALICE));
  });
  const db = env.authenticatedContext(BOB).firestore();
  await assertFails(updateDoc(doc(db, 'invites', 'ABC12345'), { usedBy: BOB, status: 'accepted' }));
});

it('NEGA apagar convite', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'invites', 'ABC12345'), invite(ALICE));
  });
  const db = env.authenticatedContext(ALICE).firestore();
  await assertFails(deleteDoc(doc(db, 'invites', 'ABC12345')));
});
```

O `update` negado é o que importa: aceitar convite é operação de Cloud Function (Spec 2).
Se o cliente pudesse marcar `usedBy`, ele criaria parceria sem passar pelo servidor.

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm run test:rules`
Expected: FAIL — `firestore.rules` ainda não existe.

- [ ] **Step 7: Escrever as regras**

`firestore.rules`:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    function isMember(data) {
      return isSignedIn() && request.auth.uid in data.members;
    }

    function partnership(pid) {
      return get(/databases/$(database)/documents/partnerships/$(pid)).data;
    }

    function zeroStats() {
      return {
        'partnershipCount': 0,
        'totalXParceria': 0,
        'totalEncounters': 0,
        'daysUsing': 0,
        'strongestPartnershipId': null
      };
    }

    // ---- users ---------------------------------------------------------
    // Perfil é legível por qualquer autenticado (o mapa precisa de nome e foto).
    // stats e handle pertencem ao servidor / à transação de reivindicação.
    match /users/{uid} {
      allow read: if isSignedIn();

      allow create: if isOwner(uid)
                    && request.resource.data.uid == uid
                    && request.resource.data.handle is string
                    && request.resource.data.stats == zeroStats();

      allow update: if isOwner(uid)
                    && request.resource.data.uid == resource.data.uid
                    && request.resource.data.handle == resource.data.handle
                    && request.resource.data.stats == resource.data.stats;

      allow delete: if false;
    }

    // ---- handles -------------------------------------------------------
    // Unicidade por criação: o Firestore recusa create em doc existente.
    match /handles/{handle} {
      allow read:   if isSignedIn();
      allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;
      allow update, delete: if false;
    }

    // ---- partnerships --------------------------------------------------
    // Toda progressão é escrita por Cloud Function (Spec 2+).
    match /partnerships/{pid} {
      allow read: if isMember(resource.data);
      allow create, update, delete: if false;

      match /{document=**} {
        allow read:  if isMember(partnership(pid));
        allow write: if false;
      }
    }

    // ---- presence ------------------------------------------------------
    // Sem parceria aceita, a localização não existe para você.
    match /presence/{uid} {
      allow read:   if isSignedIn() && request.auth.uid in resource.data.visibleTo;
      allow create: if isOwner(uid) && request.resource.data.visibleTo.size() == 0;
      allow update: if isOwner(uid)
                    && request.resource.data.visibleTo == resource.data.visibleTo;
      allow delete: if isOwner(uid);
    }

    // ---- invites -------------------------------------------------------
    match /invites/{code} {
      allow read:   if isSignedIn();
      allow create: if isSignedIn() && request.resource.data.fromUid == request.auth.uid;
      allow update, delete: if false;
    }

    // ---- padrão --------------------------------------------------------
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Duas decisões que refinam a spec (§7) e devem ser anotadas:

1. **`create` e `update` de `users` são regras separadas.** A spec trazia uma escrita
   única com `diff().affectedKeys()`, mas isso impediria a criação inicial do perfil
   pelo cliente — `stats` precisa existir na criação. A solução: no `create`, `stats`
   tem que ser **exatamente** o objeto zerado; no `update`, tem que ser **idêntico** ao
   que já está lá.
2. **`visibleTo` só é escrito pelo servidor.** O cliente cria a própria presença com
   `visibleTo` vazio e nunca pode alterá-lo. Sem isso, qualquer um se adicionaria à
   própria lista de visibilidade — o furo mais grave possível neste produto.

- [ ] **Step 8: Rodar a suíte de rules**

Run: `npm run test:rules`
Expected: PASS — todos, incluindo os ~15 testes de negação.

- [ ] **Step 9: Rodar a validação completa**

Run: `npm run validate`
Expected: PASS — typecheck, testes do app e testes de rules.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add firestore security rules with denial-first test suite"
```

---

## Task 7: Autenticação e guarda de rota

> **Desvio consciente da spec (§19).** A spec previa login por Google / Apple /
> telefone, sem senha. Nenhum dos três funciona bem no Expo Go: o OAuth do Google exige
> uma URI de redirecionamento que o `exp://` não satisfaz, o Apple Sign In precisa de
> módulo nativo, e o telefone exige reCAPTCHA por um pacote sem manutenção. **O V0 usa
> e-mail e senha**, que funciona hoje com zero dependência nativa. Login social entra no
> V1 junto com o dev build. `AuthProvider` isola o método para que a troca seja barata.

**Files:**
- Create: `src/core/auth/AuthProvider.tsx`, `src/core/auth/useAuth.ts`
- Create: `src/features/auth/SignInScreen.tsx`
- Create: `app/(auth)/_layout.tsx`, `app/(auth)/sign-in.tsx`, `app/(app)/_layout.tsx`
- Modify: `app/_layout.tsx` (envolver com `AuthProvider` e `QueryClientProvider`)
- Test: `src/core/auth/__tests__/AuthProvider.test.tsx`,
  `src/features/auth/__tests__/SignInScreen.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`Button`), Task 5 (`auth`, `authErrorMessage`)
- Produces: `useAuth(): { user: User | null; status: 'loading'|'signedIn'|'signedOut';
  signIn(email,password): Promise<void>; signUp(email,password): Promise<void>;
  signOut(): Promise<void> }`

- [ ] **Step 1: Escrever o teste do provider (que vai falhar)**

`src/core/auth/__tests__/AuthProvider.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider } from '../AuthProvider';
import { useAuth } from '../useAuth';

const listeners: Array<(user: unknown) => void> = [];

jest.mock('@/core/firebase/client', () => ({ auth: {}, db: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    listeners.push(cb);
    return () => {};
  },
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

function Probe() {
  const { status, user } = useAuth();
  return <Text>{`${status}:${user?.uid ?? 'none'}`}</Text>;
}

beforeEach(() => { listeners.length = 0; });

describe('AuthProvider', () => {
  it('começa em loading', async () => {
    await render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('loading:none')).toBeTruthy();
  });

  it('vai para signedOut quando não há sessão', async () => {
    await render(<AuthProvider><Probe /></AuthProvider>);
    listeners[0]!(null);
    await waitFor(() => expect(screen.getByText('signedOut:none')).toBeTruthy());
  });

  it('vai para signedIn e expõe o uid', async () => {
    await render(<AuthProvider><Probe /></AuthProvider>);
    listeners[0]!({ uid: 'alice-uid' });
    await waitFor(() => expect(screen.getByText('signedIn:alice-uid')).toBeTruthy());
  });

  it('useAuth fora do provider dá erro claro', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // render é assíncrono: o erro chega como rejeição, não como throw síncrono
    await expect(render(<Probe />)).rejects.toThrow(
      'useAuth precisa estar dentro de AuthProvider',
    );
    spy.mockRestore();
  });
});
```

O estado `loading` existir é o que impede o flash da tela de login em quem já está
logado — a sessão vem do AsyncStorage de forma assíncrona.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/core/auth`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o provider**

`src/core/auth/AuthProvider.tsx`:

```tsx
import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/core/firebase/client';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

export type AuthValue = {
  user: User | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => onAuthStateChanged(auth, (next) => {
    setUser(next);
    setStatus(next !== null ? 'signedIn' : 'signedOut');
  }), []);

  const value = useMemo<AuthValue>(() => ({
    user,
    status,
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    signUp: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    },
    signOut: async () => { await fbSignOut(auth); },
  }), [user, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

`src/core/auth/useAuth.ts`:

```ts
import { useContext } from 'react';
import { AuthContext, type AuthValue } from './AuthProvider';

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return value;
}
```

- [ ] **Step 4: Escrever o teste da tela de login**

`src/features/auth/__tests__/SignInScreen.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SignInScreen } from '../SignInScreen';

const signIn = jest.fn();
jest.mock('@/core/auth/useAuth', () => ({
  useAuth: () => ({ signIn, signUp: jest.fn(), signOut: jest.fn(), user: null, status: 'signedOut' }),
}));

beforeEach(() => signIn.mockReset());

describe('SignInScreen', () => {
  it('envia e-mail e senha', async () => {
    signIn.mockResolvedValue(undefined);
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'gabriel@exemplo.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo123');
    await fireEvent.press(screen.getByLabelText('Entrar'));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('gabriel@exemplo.com', 'segredo123'));
  });

  it('mostra a mensagem traduzida quando o Firebase recusa', async () => {
    signIn.mockRejectedValue({ code: 'auth/invalid-credential' });
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'a@b.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'errada');
    await fireEvent.press(screen.getByLabelText('Entrar'));
    await waitFor(() => expect(screen.getByText('E-mail ou senha incorretos.')).toBeTruthy());
  });

  it('não chama signIn com campos vazios', async () => {
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByLabelText('Entrar'));
    expect(signIn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npx jest src/features/auth`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 6: Implementar a tela**

`src/features/auth/SignInScreen.tsx`:

```tsx
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { theme } from '@/core/ui/theme';
import { useAuth } from '@/core/auth/useAuth';
import { authErrorMessage } from '@/core/firebase/errors';

export function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (email.trim() === '' || password === '') return;
    setBusy(true);
    setError(null);
    try {
      await (mode === 'signIn' ? signIn(email, password) : signUp(email, password));
    } catch (e) {
      setError(authErrorMessage((e as { code?: string }).code ?? ''));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Toda amizade tem uma história.</Text>
      <TextInput
        accessibilityLabel="E-mail"
        placeholder="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        accessibilityLabel="Senha"
        placeholder="Senha"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <Button
        label={mode === 'signIn' ? 'Entrar' : 'Criar conta'}
        onPress={() => void submit()}
        loading={busy}
      />
      <Button
        label={mode === 'signIn' ? 'Ainda não tenho conta' : 'Já tenho conta'}
        variant="ghost"
        onPress={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setError(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.space[5], gap: theme.space[3] },
  // Campos explícitos em vez de `...theme.type.title`: espalhar o token inteiro quebra o
  // tsc, porque `fontWeight` vem como `string` e não como o literal que TextStyle exige.
  title: {
    fontSize: theme.type.title.fontSize,
    fontWeight: '700',
    color: theme.colors.ink[900],
    marginBottom: theme.space[4],
  },
  input: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.paper[100],
    paddingHorizontal: theme.space[4],
    fontSize: theme.type.body.fontSize,
  },
  error: { color: theme.colors.danger, fontSize: theme.type.caption.fontSize },
});
```

O botão respeita o `accessibilityLabel` que a Task 3 garantiu — é assim que o teste o
encontra durante o estado `loading`.

- [ ] **Step 7: Ligar as rotas e a guarda**

`app/_layout.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import 'react-native-gesture-handler';
import '../global.css';
import { AuthProvider } from '@/core/auth/AuthProvider';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

`app/(app)/_layout.tsx`:

```tsx
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/core/auth/useAuth';

export default function AppLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`app/(auth)/_layout.tsx`:

```tsx
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/core/auth/useAuth';

export default function AuthLayout() {
  const { status } = useAuth();
  if (status === 'signedIn') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`app/(auth)/sign-in.tsx`:

```tsx
import { SignInScreen } from '@/features/auth/SignInScreen';

export default SignInScreen;
```

- [ ] **Step 8: Verificar no Expo Go, contra os emuladores**

```bash
# terminal 1
npx firebase emulators:start --only auth,firestore
# terminal 2 — com EXPO_PUBLIC_USE_EMULATOR=1 no .env
npx expo start
```

Expected: criar conta, ver o app entrar na rota `(app)`, **fechar e reabrir o app e
continuar logado** (prova que a persistência em AsyncStorage funcionou), e o usuário
aparecer na UI do emulador em `http://localhost:4000`.

- [ ] **Step 9: Rodar a validação**

Run: `npm run validate`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add email auth with persisted session and route guards"
```

---

## Task 8: Perfil e handle único

**Files:**
- Create: `src/features/profile/services/profile.ts`,
  `src/features/profile/hooks/useProfile.ts`,
  `src/features/profile/ProfileSetupScreen.tsx`
- Create: `app/(auth)/profile-setup.tsx`
- Modify: `app/(app)/_layout.tsx` (redirecionar quem não tem perfil)
- Test: `src/features/profile/__tests__/handle.test.ts`,
  `tests/rules/profile-transaction.test.ts`

**Interfaces:**
- Consumes: Task 2 (`INITIAL_USER_STATS`, `INITIAL_USER_SETTINGS`, `UserDoc`),
  Task 5 (`db`), Task 6 (rules de `users` e `handles`), Task 7 (`useAuth`)
- Produces:
  - `normalizeHandle(raw: string): string`
  - `validateHandle(raw: string): { ok: true } | { ok: false; reason: string }`
  - `createProfile(input: { uid, displayName, handle, avatarEmoji, timezone }): Promise<void>`
    — lança `HandleTakenError`
  - `useProfile(uid: string | null)` — React Query, chave `['user', uid]`

- [ ] **Step 1: Escrever os testes de handle (que vão falhar)**

`src/features/profile/__tests__/handle.test.ts`:

```ts
import { normalizeHandle, validateHandle } from '../services/profile';

describe('normalizeHandle', () => {
  it.each([
    ['Gabriel', 'gabriel'],
    ['  G7  ', 'g7'],
    ['@gabriel', 'gabriel'],
    ['Gabriel.Paiva', 'gabriel.paiva'],
  ])('normaliza %s em %s', (input, expected) => {
    expect(normalizeHandle(input)).toBe(expected);
  });
});

describe('validateHandle', () => {
  // 'g7a' e nao 'g7': o minimo e 3 caracteres, e o proprio teste abaixo rejeita 'ab'.
  it.each(['gabriel', 'g7a', 'gabriel_paiva', 'ab1'])('aceita %s', (h) => {
    expect(validateHandle(h).ok).toBe(true);
  });

  it.each([
    ['ab', 'curto demais'],
    ['a'.repeat(21), 'longo demais'],
    ['gabriel paiva', 'espaço'],
    ['gabriel!', 'caractere inválido'],
    ['', 'vazio'],
  ])('recusa %s (%s)', (h) => {
    expect(validateHandle(h).ok).toBe(false);
  });

  it('devolve motivo em português quando recusa', () => {
    const result = validateHandle('ab');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/[a-záéíóúâêôãõç]/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest src/features/profile`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o serviço de perfil**

`src/features/profile/services/profile.ts`:

```ts
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/firebase/client';
import { INITIAL_USER_SETTINGS, INITIAL_USER_STATS } from '@shared/types';

const HANDLE_PATTERN = /^[a-z0-9._]{3,20}$/;

export class HandleTakenError extends Error {
  constructor() {
    super('Esse @ já está em uso.');
    this.name = 'HandleTakenError';
  }
}

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '');
}

export function validateHandle(raw: string): { ok: true } | { ok: false; reason: string } {
  const handle = normalizeHandle(raw);
  if (handle.length < 3) return { ok: false, reason: 'Use pelo menos 3 caracteres.' };
  if (handle.length > 20) return { ok: false, reason: 'Use no máximo 20 caracteres.' };
  if (!HANDLE_PATTERN.test(handle)) {
    return { ok: false, reason: 'Use apenas letras, números, ponto e underline.' };
  }
  return { ok: true };
}

export type CreateProfileInput = {
  uid: string;
  displayName: string;
  handle: string;
  avatarEmoji: string;
  timezone: string;
};

/**
 * Reivindica o handle e cria o perfil na MESMA transação.
 * A unicidade vem da semântica de `create` do Firestore: a regra proíbe update
 * em `handles/{handle}`, então a segunda transação a chegar falha.
 */
export async function createProfile(input: CreateProfileInput): Promise<void> {
  const handle = normalizeHandle(input.handle);
  const handleRef = doc(db, 'handles', handle);
  const userRef = doc(db, 'users', input.uid);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(handleRef);
    if (existing.exists()) throw new HandleTakenError();

    tx.set(handleRef, { uid: input.uid });
    tx.set(userRef, {
      uid: input.uid,
      displayName: input.displayName.trim(),
      handle,
      photoURL: null,
      avatarEmoji: input.avatarEmoji,
      timezone: input.timezone,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
      stats: INITIAL_USER_STATS,
      settings: INITIAL_USER_SETTINGS,
    });
  });
}
```

- [ ] **Step 4: Escrever o teste de corrida da transação**

Este é o teste que prova a unicidade — não a validação de formato, que é trivial.

`tests/rules/profile-transaction.test.ts`:

```ts
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, runTransaction, setDoc, type Firestore } from 'firebase/firestore';
import { ALICE, BOB, createTestEnv, validProfile } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

/** Espelha createProfile() sem depender do cliente do app (que importa expo-*). */
/**
 * Espelha createProfile() SEM a pre-checagem `tx.get`. Isso e proposital: a
 * pre-checagem lanca um Error generico do cliente antes de a regra de seguranca
 * rodar, e `assertFails` exige PERMISSION_DENIED de verdade — com ela, o teste
 * passaria sem nunca exercitar a regra.
 */
async function claim(db: Firestore, uid: string, handle: string) {
  return runTransaction(db, async (tx) => {
    tx.set(doc(db, 'handles', handle), { uid });
    tx.set(doc(db, 'users', uid), validProfile(uid, handle));
  });
}

it('a primeira reivindicação cria handle e perfil juntos', async () => {
  const db = env.authenticatedContext(ALICE).firestore();
  await assertSucceeds(claim(db, ALICE, 'gabriel'));

  await env.withSecurityRulesDisabled(async (ctx) => {
    const handleDoc = await getDoc(doc(ctx.firestore(), 'handles', 'gabriel'));
    const userDoc = await getDoc(doc(ctx.firestore(), 'users', ALICE));
    expect(handleDoc.data()).toEqual({ uid: ALICE });
    expect(userDoc.data()?.handle).toBe('gabriel');
  });
});

it('a segunda reivindicação do mesmo handle falha', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'handles', 'gabriel'), { uid: ALICE });
  });
  const db = env.authenticatedContext(BOB).firestore();
  await assertFails(claim(db, BOB, 'gabriel'));
});

it('perfil do BOB não é criado quando o handle falha', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'handles', 'gabriel'), { uid: ALICE });
  });
  const db = env.authenticatedContext(BOB).firestore();
  await claim(db, BOB, 'gabriel').catch(() => undefined);

  await env.withSecurityRulesDisabled(async (ctx) => {
    const userDoc = await getDoc(doc(ctx.firestore(), 'users', BOB));
    expect(userDoc.exists()).toBe(false);
  });
});
```

O terceiro teste é o que importa: prova que a transação é **atômica** — handle tomado
não deixa perfil órfão.

- [ ] **Step 5: Rodar os testes de rules**

Run: `npm run test:rules`
Expected: PASS

- [ ] **Step 6: Implementar o hook e a tela**

`src/features/profile/hooks/useProfile.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/core/firebase/client';
import type { UserDoc } from '@shared/types';

export function useProfile(uid: string | null) {
  return useQuery<UserDoc | null>({
    queryKey: ['user', uid],
    enabled: uid !== null,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', uid!));
      return snap.exists() ? (snap.data() as UserDoc) : null;
    },
  });
}
```

`src/features/profile/ProfileSetupScreen.tsx`:

```tsx
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Avatar } from '@/core/ui/Avatar';
import { Button } from '@/core/ui/Button';
import { theme } from '@/core/ui/theme';
import { useAuth } from '@/core/auth/useAuth';
import { HandleTakenError, createProfile, validateHandle } from './services/profile';

const EMOJIS = ['🦊', '🐻', '🐼', '🦁', '🐸', '🐧', '🦉', '🐙'];

export function ProfileSetupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState(EMOJIS[0]!);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (user === null) return;
    const check = validateHandle(handle);
    if (!check.ok) { setError(check.reason); return; }
    if (displayName.trim() === '') { setError('Como a gente te chama?'); return; }

    setBusy(true);
    setError(null);
    try {
      await createProfile({
        uid: user.uid,
        displayName,
        handle,
        avatarEmoji,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
      router.replace('/');
    } catch (e) {
      setError(e instanceof HandleTakenError ? e.message : 'Algo deu errado. Tenta de novo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quem é você por aqui?</Text>
      <View style={styles.avatarRow}>
        {EMOJIS.map((emoji) => (
          <View key={emoji} onTouchEnd={() => setAvatarEmoji(emoji)}>
            <Avatar
              photoURL={null}
              fallbackEmoji={emoji}
              size={emoji === avatarEmoji ? 56 : 44}
            />
          </View>
        ))}
      </View>
      <TextInput
        accessibilityLabel="Nome"
        placeholder="Seu nome"
        value={displayName}
        onChangeText={setDisplayName}
        style={styles.input}
      />
      <TextInput
        accessibilityLabel="Apelido"
        placeholder="@seuapelido"
        autoCapitalize="none"
        value={handle}
        onChangeText={setHandle}
        style={styles.input}
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <Button label="Continuar" onPress={() => void submit()} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.space[5], gap: theme.space[3] },
  // Campos explícitos em vez de `...theme.type.title`: espalhar o token inteiro quebra o
  // tsc, porque `fontWeight` vem como `string` e não como o literal que TextStyle exige.
  title: {
    fontSize: theme.type.title.fontSize,
    fontWeight: '700',
    color: theme.colors.ink[900],
    marginBottom: theme.space[4],
  },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space[2], marginBottom: theme.space[4] },
  input: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.paper[100],
    paddingHorizontal: theme.space[4],
    fontSize: theme.type.body.fontSize,
  },
  error: { color: theme.colors.danger, fontSize: theme.type.caption.fontSize },
});
```

`app/(auth)/profile-setup.tsx`:

```tsx
import { ProfileSetupScreen } from '@/features/profile/ProfileSetupScreen';

export default ProfileSetupScreen;
```

- [ ] **Step 7: Redirecionar quem está logado mas sem perfil**

`app/(app)/_layout.tsx`:

```tsx
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/core/auth/useAuth';
import { useProfile } from '@/features/profile/hooks/useProfile';

export default function AppLayout() {
  const { status, user } = useAuth();
  const profile = useProfile(user?.uid ?? null);

  if (status === 'loading' || (status === 'signedIn' && profile.isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  if (profile.data === null) return <Redirect href="/profile-setup" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Exceção consciente à regra "sem lógica em `app/`": um layout de rota **é** o lugar da
guarda no Expo Router, e o arquivo continua abaixo de 30 linhas.

- [ ] **Step 8: Verificar de ponta a ponta no Expo Go**

Com os emuladores rodando e `EXPO_PUBLIC_USE_EMULATOR=1`:

1. Criar conta → cai em `profile-setup`
2. Preencher nome e @ → entra no app
3. Fechar e reabrir → entra direto, sem passar pelo login
4. Tentar criar uma segunda conta com o **mesmo @** → mensagem "Esse @ já está em uso."
5. Conferir na UI do emulador que `handles/{handle}` e `users/{uid}` existem e que
   `stats` está zerado

- [ ] **Step 9: Rodar a validação completa**

Run: `npm run validate`
Expected: PASS — typecheck, testes do app e suíte de rules.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add profile setup with atomic unique handle claim"
```

---

## Self-review

**1. Cobertura da spec.** As seções 6 (arquitetura), 7 (modelo de dados — `users`,
`presence`, `handles`, e o travamento de `partnerships`/`invites`), 8 (estrutura de
pastas), 9 (design system) e 10 (componentes) estão cobertas nas Tasks 1–8. O que a
spec descreve e **não** está aqui pertence a outras specs por desenho: mapa e presença
em movimento (Spec 3), motor de progressão (Spec 4), missões (Spec 5). Um componente da
§10 ficou de fora conscientemente — `Sheet`, que depende de `@gorhom/bottom-sheet` e só
tem consumidor na Spec 3; construí-lo agora seria YAGNI.

**2. Desvios registrados.**
- **Autenticação por e-mail e senha** no lugar de Google/Apple/telefone (§19). Motivo
  técnico na Task 7; login social vai para o V1 com o dev build.
- **`ProgressRing` sem SVG animado** (§10). A versão por borda entrega o anel de
  temperatura hoje; a animada entra quando o mapa precisar dela.
- **Regras de `users` divididas em `create` e `update`**, e `visibleTo` fechado para
  escrita do cliente. Ambas endurecem a §7 — documentado na Task 6, Step 7.

**3. Consistência de tipos.** `INITIAL_USER_STATS` (Task 2) é o mesmo objeto que a regra
`zeroStats()` (Task 6) e que `tests/rules/helpers.ts` usa em `validProfile`. Os três
precisam mudar juntos — se divergirem, os testes de `users` quebram, que é o
comportamento desejado. `xpForNextLevel` é usado com o mesmo nome nas Tasks 2 e 4.
`bandForTemperature` retorna `TemperatureBand`, consumido pelo `Avatar` (Task 4) e pelo
`theme` (Task 3).

**4. Pré-requisitos manuais** — não são código e travam a execução se esquecidos:
instalar o **Temurin** (Task 5, Step 1) e criar o **projeto no console do Firebase**
(Task 5, Step 2).

---

*Plano da Spec 1 (Fundação) — Parcerio. Próxima: Spec 2 (Parceria — convite, deep link,
aceite, cerimônia de nascimento, Cloud Functions).*

