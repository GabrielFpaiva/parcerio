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
