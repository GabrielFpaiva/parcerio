import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { serverTimestamp } from 'firebase/firestore';
import { ALICE, BOB, CAROL, createTestEnv, evitarViradaDeDia } from './helpers';
import { seedRound, seedSuperPartnership, seedUsers } from './factories';
import { GAME_XP, dayNumber, gameDateId, questionIndexFor } from '../../shared/dailyGame';

const SPID = 'sp-1';
const DAVE = 'dave-uid';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

beforeEach(async () => {
  // Finding 6: perto da virada de São Paulo, hoje()/hojeNum() (que leem
  // Date.now() abaixo) podem discordar do request.time que a regra vai ver
  // no momento da escrita. Evita a janela em vez de arriscar.
  await evitarViradaDeDia();
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

// Espelha o votoPath de game-votes.test.ts: o create e o update da rodada
// agora exigem (Finding 1 — existsAfter) que o voto do próprio uid exista
// depois da transação. Todo write de rodada que precisa PASSAR tem que
// levar o voto pareado no mesmo lote.
const votoPath = (voter: string, date = hoje()) =>
  `superPartnerships/${SPID}/games/${date}/votes/${voter}`;

describe('rodada — create', () => {
  it('PERMITE que um membro abra a rodada do dia, com o voto no mesmo lote', async () => {
    // Antes do Finding 1, isto era um set solteiro. Virou lote porque a
    // regra agora exige existsAfter(votes/{uid}) também no create — abrir a
    // rodada sem votar não é mais um caminho válido, nem para o primeiro
    // votante.
    const alice = env.authenticatedContext(ALICE).firestore();
    const b = alice.batch();
    b.set(alice.doc(caminho()), rodadaNova(ALICE));
    b.set(alice.doc(votoPath(ALICE)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('NEGA abrir a rodada com um set solteiro, sem o voto no mesmo lote', async () => {
    // O ataque do Finding 1: sem esta negação, dava para constar em
    // voterUids sem nunca escrever um voto — a rodada fechava (hasAll batia)
    // e quem fez isso lia o voto de todo mundo antes de votar.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(caminho()).set(rodadaNova(ALICE)));
  });

  it('NEGA que quem não é do grupo abra a rodada', async () => {
    // Bare set de propósito: DAVE não é membro, então isMember já nega
    // sozinho — e não há como parear um voto coerente aqui, porque
    // votes/create também exige isMember. Não há um "voto válido de DAVE"
    // para isolar o existsAfter desta guarda.
    const dave = env.authenticatedContext(DAVE).firestore();
    await assertFails(dave.doc(caminho()).set(rodadaNova(DAVE)));
  });

  it('NEGA abrir a rodada já contando o voto de outra pessoa', async () => {
    // Bare set de propósito: aqui voterUids é [BOB], não [ALICE] — a própria
    // ALICE nunca aparece no documento que ela está tentando criar, então
    // não existe um voto dela que faça existsAfter(votes/ALICE) passar sem
    // mudar o campo que este teste isola (voterUids != [auth.uid]).
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(caminho()).set(rodadaNova(BOB)));
  });

  it('NEGA a pergunta de ontem', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const ontem = `q${questionIndexFor(hojeNum() - 1)}`;
    const b = alice.batch();
    b.set(alice.doc(caminho()), rodadaNova(ALICE, { questionId: ontem }));
    b.set(alice.doc(votoPath(ALICE)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA a pergunta de amanhã', async () => {
    // Junto com o teste acima, é isto que impede re-sortear até cair uma
    // pergunta que convém a quem abriu primeiro.
    const alice = env.authenticatedContext(ALICE).firestore();
    const amanha = `q${questionIndexFor(hojeNum() + 1)}`;
    const b = alice.batch();
    b.set(alice.doc(caminho()), rodadaNova(ALICE, { questionId: amanha }));
    b.set(alice.doc(votoPath(ALICE)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA dayNumber que não é o de hoje', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const b = alice.batch();
    b.set(alice.doc(caminho()), rodadaNova(ALICE, { dayNumber: hojeNum() - 1 }));
    b.set(alice.doc(votoPath(ALICE)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA date diferente do id do documento', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const b = alice.batch();
    b.set(alice.doc(caminho()), rodadaNova(ALICE, { date: '2020-01-01' }));
    b.set(alice.doc(votoPath(ALICE)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA xpAwarded inflado', async () => {
    // 500 é literal de propósito: o teste prova que QUALQUER valor errado
    // cai, não um valor específico. Trocar por uma constante destruiria isso.
    const alice = env.authenticatedContext(ALICE).firestore();
    const b = alice.batch();
    b.set(alice.doc(caminho()), rodadaNova(ALICE, { xpAwarded: 500 }));
    b.set(alice.doc(votoPath(ALICE)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA xpAwarded 15 numa rodada que está só começando', async () => {
    // Um literal errado de cada vez: o resto do documento continua válido.
    // 15 é literal de propósito — é GAME_XP.COMPLETE, mas usado onde o
    // correto seria PARTIAL. O teste prova que o valor certo importa, então
    // não pode usar a constante que estaria provando estar certo.
    const alice = env.authenticatedContext(ALICE).firestore();
    const b = alice.batch();
    b.set(alice.doc(caminho()), rodadaNova(ALICE, { xpAwarded: 15 }));
    b.set(alice.doc(votoPath(ALICE)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA criar a rodada de hoje num id de outro dia', async () => {
    // `date == date` só amarra o campo ao id. Sem `date == todayId()`, dava
    // para cunhar quantas rodadas de 15 XP se quisesse, em ids arbitrários.
    const alice = env.authenticatedContext(ALICE).firestore();
    const ontem = gameDateId(Date.now() - 86_400_000);
    const b = alice.batch();
    b.set(alice.doc(caminho(ontem)), rodadaNova(ALICE, { date: ontem }));
    b.set(alice.doc(votoPath(ALICE, ontem)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA criar a rodada com campo além dos cinco permitidos', async () => {
    // O hasOnly do update congela o documento depois, então campo injetado
    // no create ficaria permanente naquela rodada.
    const alice = env.authenticatedContext(ALICE).firestore();
    const b = alice.batch();
    b.set(alice.doc(caminho()), rodadaNova(ALICE, { winner: BOB }));
    b.set(alice.doc(votoPath(ALICE)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });
});

describe('rodada — update', () => {
  beforeEach(async () => {
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE));
  });

  it('PERMITE que o segundo membro entre na rodada, com o voto no mesmo lote', async () => {
    // Antes do Finding 1, isto era um update solteiro. Virou lote porque a
    // regra agora exige existsAfter(votes/{uid}) também no update.
    const bob = env.authenticatedContext(BOB).firestore();
    const b = bob.batch();
    b.update(bob.doc(caminho()), { voterUids: [ALICE, BOB], xpAwarded: GAME_XP.PARTIAL });
    b.set(bob.doc(votoPath(BOB)), { votedFor: CAROL, votedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('NEGA entrar em voterUids com update solteiro, sem o voto no mesmo lote', async () => {
    // O ataque do Finding 1, na forma exata da Spec: Alice (já votante)
    // apenas se acrescenta a voterUids e sobe xpAwarded, sem nunca escrever
    // um voto. Antes do fix isto passava por TODAS as outras guardas.
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(caminho()).update({ voterUids: [ALICE, BOB], xpAwarded: GAME_XP.PARTIAL }),
    );
  });

  it('PERMITE fechar a rodada com 15 quando o último vota', async () => {
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { voterUids: [ALICE, BOB] }));
    const carol = env.authenticatedContext(CAROL).firestore();
    const b = carol.batch();
    b.update(carol.doc(caminho()), { voterUids: [ALICE, BOB, CAROL], xpAwarded: GAME_XP.COMPLETE });
    b.set(carol.doc(votoPath(CAROL)), { votedFor: ALICE, votedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('NEGA votar duas vezes', async () => {
    // ALICE já está em voterUids (seed). Ela aparece na sua própria escrita
    // proposta, então um voto dela batido no mesmo lote deixaria
    // existsAfter satisfeito — a negação sobra inteira para
    // !(auth.uid in resource.data.voterUids), que é a guarda sob teste.
    const alice = env.authenticatedContext(ALICE).firestore();
    const b = alice.batch();
    b.update(alice.doc(caminho()), { voterUids: [ALICE, ALICE], xpAwarded: GAME_XP.PARTIAL });
    b.set(alice.doc(votoPath(ALICE)), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA entrar na rodada em nome de outra pessoa', async () => {
    // Bare update de propósito: BOB nunca aparece no voterUids que ele
    // mesmo está propondo ([ALICE, CAROL]), então não existe um voto dele
    // que faça existsAfter(votes/BOB) passar sem mudar o campo sob teste
    // (o concat que barra impersonar outro membro).
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(caminho()).update({ voterUids: [ALICE, CAROL], xpAwarded: GAME_XP.PARTIAL }),
    );
  });

  it('NEGA remover alguém de voterUids', async () => {
    // Sem esta guarda daria para apagar o voto de quem já votou e reabrir a rodada.
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { voterUids: [ALICE, BOB] }));
    const carol = env.authenticatedContext(CAROL).firestore();
    const b = carol.batch();
    b.update(carol.doc(caminho()), { voterUids: [ALICE, CAROL], xpAwarded: GAME_XP.PARTIAL });
    b.set(carol.doc(votoPath(CAROL)), { votedFor: ALICE, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA cobrar 15 com a rodada ainda parcial', async () => {
    // 15 é literal de propósito: é GAME_XP.COMPLETE, cobrado onde só 2 de 3
    // votaram. O teste prova que o valor errado é rejeitado, não pode virar
    // a constante que estaria certa.
    const bob = env.authenticatedContext(BOB).firestore();
    const b = bob.batch();
    b.update(bob.doc(caminho()), { voterUids: [ALICE, BOB], xpAwarded: 15 });
    b.set(bob.doc(votoPath(BOB)), { votedFor: CAROL, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA trocar a pergunta no meio da rodada', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    const b = bob.batch();
    b.update(bob.doc(caminho()), {
      voterUids: [ALICE, BOB],
      xpAwarded: GAME_XP.PARTIAL,
      questionId: 'q001',
    });
    b.set(bob.doc(votoPath(BOB)), { votedFor: CAROL, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA entrar hoje numa rodada cujo dia já virou', async () => {
    // isRoundClosed já considera essa rodada fechada. Sem esta guarda, quem
    // faltou ontem entra hoje e empurra o xpAwarded de 6 pra 15.
    await seedRound(env, SPID, hoje(), rodadaNova(ALICE, { dayNumber: hojeNum() - 1 }));
    const bob = env.authenticatedContext(BOB).firestore();
    const b = bob.batch();
    b.update(bob.doc(caminho()), { voterUids: [ALICE, BOB], xpAwarded: GAME_XP.PARTIAL });
    b.set(bob.doc(votoPath(BOB)), { votedFor: CAROL, votedAt: serverTimestamp() });
    await assertFails(b.commit());
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

// Finding 7 da revisão de 2026-08-31: "Super Parceria é trio ou mais" é
// convenção de produto (§2 do design doc), não algo que a regra force. Sem
// pinar o intervalo aqui, gameXp(1, members.size()) pagando 15 para um
// grupo de 1 membro só não acontece porque nada cria Super Parceria assim
// hoje — um caso vivo, só explicado por uma leitura do doc de produto. Os
// testes abaixo usam Super Parcerias fora do próprio módulo de teste
// (spids e membros dedicados), semeadas por fora das regras, exatamente
// para provar que a regra em si barra o tamanho, não o fluxo normal do app.
describe('rodada — tamanho do grupo (3 a 8, pinado na regra)', () => {
  it('NEGA abrir a rodada numa Super Parceria com menos de 3 membros', async () => {
    const spidPequena = 'sp-pequena';
    await seedSuperPartnership(env, spidPequena, [ALICE, BOB]);
    const caminhoPequena = `superPartnerships/${spidPequena}/games/${hoje()}`;
    const votoPequena = `superPartnerships/${spidPequena}/games/${hoje()}/votes/${ALICE}`;
    const alice = env.authenticatedContext(ALICE).firestore();
    const b = alice.batch();
    b.set(alice.doc(caminhoPequena), rodadaNova(ALICE));
    b.set(alice.doc(votoPequena), { votedFor: BOB, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA abrir a rodada numa Super Parceria com mais de 8 membros', async () => {
    const membrosGrande = Array.from({ length: 9 }, (_, i) => `grande-uid-${i}`);
    await seedUsers(env, membrosGrande);
    const spidGrande = 'sp-grande';
    await seedSuperPartnership(env, spidGrande, membrosGrande);
    const quemAbre = membrosGrande[0]!;
    const caminhoGrande = `superPartnerships/${spidGrande}/games/${hoje()}`;
    const votoGrande = `superPartnerships/${spidGrande}/games/${hoje()}/votes/${quemAbre}`;
    const db = env.authenticatedContext(quemAbre).firestore();
    const b = db.batch();
    b.set(db.doc(caminhoGrande), rodadaNova(quemAbre));
    b.set(db.doc(votoGrande), { votedFor: membrosGrande[1]!, votedAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('NEGA update de rodada numa Super Parceria com menos de 3 membros', async () => {
    // O create já barra a existência da rodada num grupo pequeno — este
    // teste prova que a MESMA guarda também está no update, para o caso de
    // uma rodada ter sido semeada por fora (migração, bug, dado velho).
    const spidPequena = 'sp-pequena-update';
    await seedSuperPartnership(env, spidPequena, [ALICE, BOB]);
    await seedRound(env, spidPequena, hoje(), rodadaNova(ALICE));
    const bob = env.authenticatedContext(BOB).firestore();
    const b = bob.batch();
    b.update(bob.doc(`superPartnerships/${spidPequena}/games/${hoje()}`), {
      voterUids: [ALICE, BOB],
      xpAwarded: GAME_XP.COMPLETE,
    });
    b.set(bob.doc(`superPartnerships/${spidPequena}/games/${hoje()}/votes/${BOB}`), {
      votedFor: ALICE,
      votedAt: serverTimestamp(),
    });
    await assertFails(b.commit());
  });
});
