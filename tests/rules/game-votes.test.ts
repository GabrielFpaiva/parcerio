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
    // A Carol JÁ está em voterUids, então o getAfter passa e a única guarda
    // que pode derrubar isto é o isOwner. Antes, com a Carol fora da lista,
    // as duas falhavam juntas e o teste continuaria verde sem o isOwner.
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { voterUids: [ALICE, CAROL] }));
    const db = env.authenticatedContext(BOB).firestore();
    const b = db.batch();
    b.update(db.doc(caminho()), { voterUids: [ALICE, CAROL, BOB], xpAwarded: 15 });
    b.set(db.doc(votoPath(CAROL)), { votedFor: ALICE, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA voto de quem não é do grupo, mesmo já constando em voterUids', async () => {
    // isMember é defesa em profundidade: com DAVE já em voterUids (via seed
    // que ignora as regras), o getAfter e o resto do payload batem — só a
    // guarda isMember pode barrar isto.
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { voterUids: [ALICE, DAVE] }));
    const dave = env.authenticatedContext(DAVE).firestore();
    await assertFails(
      dave.doc(votoPath(DAVE)).set({ votedFor: ALICE, votedAt: serverTimestamp() }),
    );
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

  it('NEGA anexar campo além de votedFor e votedAt', async () => {
    // Sem o hasOnly, o cliente colaria qualquer campo extra no voto — o
    // mesmo risco que questionSuggestions e a criação da rodada já fecham.
    const db = env.authenticatedContext(BOB).firestore();
    const b = db.batch();
    b.update(db.doc(caminho()), { voterUids: [ALICE, BOB], xpAwarded: 6 });
    b.set(db.doc(votoPath(BOB)), {
      votedFor: CAROL,
      votedAt: serverTimestamp(),
      nota: 'campo extra',
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

describe('voto — create (primeiro votante)', () => {
  // Sem beforeEach de seedRound: a rodada de hoje não existe ainda. Todo dia
  // alguém é o primeiro — este é o caminho mais comum do produto, não a
  // exceção, então tem que estar coberto separadamente do "entrar" acima.
  it('PERMITE ao primeiro votante criar a rodada e o próprio voto no mesmo lote', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    const b = db.batch();
    b.set(db.doc(caminho()), rodadaNova(ALICE));
    b.set(db.doc(votoPath(ALICE)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
});

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
