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
