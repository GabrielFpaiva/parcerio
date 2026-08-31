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

  // :94 e :95 de matchesOwnProfile nunca tinham teste isolando photoURL nem
  // avatarEmoji — só displayName e handle eram forjados até aqui.
  it('NEGA forjar o photoURL no fromProfile', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const forged = validInvite(ALICE);
    forged.fromProfile.photoURL = 'https://evil.example/bob.jpg';
    await assertFails(alice.doc('invites/AB3D4F7H').set(forged));
  });

  it('NEGA forjar o avatarEmoji no fromProfile', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const forged = validInvite(ALICE);
    forged.fromProfile.avatarEmoji = '🐸';
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

  it('NEGA código no documento diferente do id do documento', async () => {
    // Sem esta guarda, invites/AB3D4F7H poderia conter code: 'OUTROCOD'.
    // O documento passaria a mentir sobre a própria identidade, e a regra que
    // impede isso seria uma linha que nenhum teste exerce.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('invites/AB3D4F7H').set(validInvite(ALICE, { code: 'OUTROCOD' })));
  });

  it('NEGA criação a quem não está autenticado', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(anon.doc('invites/AB3D4F7H').set(validInvite(ALICE)));
  });

  it('NEGA campo além dos sete previstos no convite', async () => {
    // Qualquer autenticado dá `get` num invite por código — sem o hasOnly,
    // um campo extra aqui seria lido por gente de fora do par
    // convite/convidado, igual ao risco que hasOnly já fecha em
    // questionSuggestions e na criação da rodada.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      alice.doc('invites/AB3D4F7H').set({ ...validInvite(ALICE), nota: 'campo extra' }),
    );
  });

  it('NEGA campo além dos quatro previstos em fromProfile', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const comCampoExtra = validInvite(ALICE);
    (comCampoExtra.fromProfile as Record<string, unknown>).bio = 'campo extra';
    await assertFails(alice.doc('invites/AB3D4F7H').set(comCampoExtra));
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

  it('NEGA que anônimo marque um convite como usado', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(anon.doc('invites/AB3D4F7H').update({ usedBy: BOB, status: 'accepted' }));
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

  it('NEGA aceitar convite com usedBy preenchido e status ainda pendente', async () => {
    // Estado inconsistente, só alcançável por escrita administrativa ou
    // migração futura. A guarda `usedBy == null` é o que o barra — sem este
    // teste ela é uma linha que alguém remove sem consequência.
    await seedInvite(env, 'INCONS01', validInvite(ALICE, { usedBy: CAROL }));
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc('invites/INCONS01').update({ usedBy: BOB, status: 'accepted' }));
  });

  it('NEGA aceitar convite com status accepted e usedBy ainda nulo', async () => {
    // O espelho do teste acima: o outro estado inconsistente, alcançável só
    // por escrita administrativa. Sem ele, `status == 'pending'` é uma guarda
    // que nenhum teste exerce — um teste que vira os dois campos de uma vez
    // prova que um deles importa, nunca qual.
    await seedInvite(env, 'INCONS02', validInvite(ALICE, { status: 'accepted' }));
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc('invites/INCONS02').update({ usedBy: BOB, status: 'accepted' }));
  });

  it('NEGA mexer em qualquer campo além de usedBy e status', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc('invites/AB3D4F7H').update({ usedBy: BOB, status: 'accepted', fromUid: BOB }),
    );
  });

  // Hole 3 (revisão adversarial 2026-08-27): shared/types.ts e o comentário
  // em firestore.rules diziam que o vencimento era "derivado" — mas nenhuma
  // regra lia createdAt. A revisão confirmou que um convite de 100 dias
  // ainda era aceito. INVITE_TTL_DAYS (shared/invite.ts) é 7.
  it('NEGA aceitar convite vencido (createdAt com mais de 7 dias)', async () => {
    const vencido = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await seedInvite(env, 'OLD00001', validInvite(ALICE, { createdAt: vencido }));
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc('invites/OLD00001').update({ usedBy: BOB, status: 'accepted' }));
  });

  it('PERMITE aceitar convite dentro do prazo (createdAt há 6 dias)', async () => {
    const dentroDoPrazo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    await seedInvite(env, 'NEW00001', validInvite(ALICE, { createdAt: dentroDoPrazo }));
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.doc('invites/NEW00001').update({ usedBy: BOB, status: 'accepted' }));
  });

  it('NEGA delete', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('invites/AB3D4F7H').delete());
  });
});
