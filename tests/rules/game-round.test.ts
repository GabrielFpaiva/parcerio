import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedRound, seedSuperPartnership, seedUsers } from './factories';
import { GAME_XP, dayNumber, gameDateId, questionIndexFor } from '../../shared/dailyGame';

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
  xpAwarded: GAME_XP.PARTIAL,
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
    // 500 é literal de propósito: o teste prova que QUALQUER valor errado
    // cai, não um valor específico. Trocar por uma constante destruiria isso.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(caminho()).set(rodadaNova(ALICE, { xpAwarded: 500 })));
  });

  it('NEGA xpAwarded 15 numa rodada que está só começando', async () => {
    // Um literal errado de cada vez: o resto do documento continua válido.
    // 15 é literal de propósito — é GAME_XP.COMPLETE, mas usado onde o
    // correto seria PARTIAL. O teste prova que o valor certo importa, então
    // não pode usar a constante que estaria provando estar certo.
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
      bob.doc(caminho()).update({ voterUids: [ALICE, BOB], xpAwarded: GAME_XP.PARTIAL }),
    );
  });

  it('PERMITE fechar a rodada com 15 quando o último vota', async () => {
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { voterUids: [ALICE, BOB] }));
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertSucceeds(
      carol.doc(caminho()).update({ voterUids: [ALICE, BOB, CAROL], xpAwarded: GAME_XP.COMPLETE }),
    );
  });

  it('NEGA votar duas vezes', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      alice.doc(caminho()).update({ voterUids: [ALICE, ALICE], xpAwarded: GAME_XP.PARTIAL }),
    );
  });

  it('NEGA entrar na rodada em nome de outra pessoa', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(caminho()).update({ voterUids: [ALICE, CAROL], xpAwarded: GAME_XP.PARTIAL }),
    );
  });

  it('NEGA remover alguém de voterUids', async () => {
    // Sem esta guarda daria para apagar o voto de quem já votou e reabrir a rodada.
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { voterUids: [ALICE, BOB] }));
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(
      carol.doc(caminho()).update({ voterUids: [ALICE, CAROL], xpAwarded: GAME_XP.PARTIAL }),
    );
  });

  it('NEGA cobrar 15 com a rodada ainda parcial', async () => {
    // 15 é literal de propósito: é GAME_XP.COMPLETE, cobrado onde só 2 de 3
    // votaram. O teste prova que o valor errado é rejeitado, não pode virar
    // a constante que estaria certa.
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(caminho()).update({ voterUids: [ALICE, BOB], xpAwarded: 15 }),
    );
  });

  it('NEGA trocar a pergunta no meio da rodada', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(caminho()).update({ voterUids: [ALICE, BOB], xpAwarded: GAME_XP.PARTIAL, questionId: 'q001' }),
    );
  });

  it('NEGA entrar hoje numa rodada cujo dia já virou', async () => {
    // isRoundClosed já considera essa rodada fechada. Sem esta guarda, quem
    // faltou ontem entra hoje e empurra o xpAwarded de 6 pra 15.
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { dayNumber: hojeNum() - 1 }));
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(caminho()).update({ voterUids: [ALICE, BOB], xpAwarded: GAME_XP.PARTIAL }),
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
