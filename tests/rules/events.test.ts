import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { serverTimestamp } from 'firebase/firestore';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedInvite, seedPartnership, seedUsers, validInvite, validPartnership } from './factories';

let env: RulesTestEnvironment;
const CODE = 'AB3D4F7H';
const PID = [ALICE, BOB].sort().join('_');

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

function seedWithStatus(status: string) {
  return seedPartnership(env, PID, {
    ...validPartnership(ALICE, BOB, CODE),
    status,
    createdAt: new Date(), activatedAt: new Date(), updatedAt: new Date(),
  });
}

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
  await seedWithStatus('active');
  await seedPartnership(env, `${PID}/events/born`, {
    type: 'partnership_born', occurredAt: new Date(), xpAwarded: 100,
  });
});

const evento = (over: Record<string, unknown> = {}) => ({
  type: 'partnership_paused', occurredAt: serverTimestamp(), xpAwarded: 0, ...over,
});

/**
 * Status e evento no mesmo commit, como o `transition()` da Task 8. Os testes
 * de negação usam a mesma escrita com UM campo trocado — sem a mudança de
 * status, todos negariam pela amarra evento → parceria, e não pela guarda
 * que dizem testar.
 */
function transitionAs(
  uid: string,
  status: string,
  ev: Record<string, unknown>,
  eventId: string | null = null,
) {
  const db = env.authenticatedContext(uid).firestore();
  const batch = db.batch();
  batch.update(db.doc(`partnerships/${PID}`), { status, updatedAt: serverTimestamp() });
  const events = db.collection(`partnerships/${PID}/events`);
  batch.set(eventId === null ? events.doc() : events.doc(eventId), ev);
  return batch.commit();
}

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

describe('events — escrita de ciclo de vida', () => {
  const casos: Array<[string, string, string]> = [
    ['active', 'paused', 'partnership_paused'],
    ['paused', 'active', 'partnership_resumed'],
    ['active', 'ended', 'partnership_ended'],
    ['paused', 'ended', 'partnership_ended'],
  ];

  it.each(casos)('PERMITE %s → %s com o evento %s no mesmo commit', async (from, to, type) => {
    await seedWithStatus(from);
    await assertSucceeds(transitionAs(BOB, to, evento({ type })));
  });

  it('NEGA a não-membro', async () => {
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(carol.collection(`partnerships/${PID}/events`).add(evento()));
  });

  it('NEGA evento de pausa sem pausar a parceria no mesmo commit', async () => {
    // Sentido evento → parceria: sem isto, qualquer membro escrevia na
    // timeline do par "encerrou" ou "pausou" sem ter acontecido.
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.collection(`partnerships/${PID}/events`).add(evento()));
  });

  it('NEGA evento que não narra a transição feita', async () => {
    // Pausa a parceria, mas grava "encerrou".
    await assertFails(transitionAs(BOB, 'paused', evento({ type: 'partnership_ended' })));
  });

  it('NEGA evento de encontro — XParceria de verdade é da Spec 4', async () => {
    await assertFails(transitionAs(BOB, 'paused', evento({ type: 'encounter' })));
  });

  it('NEGA encontro mesmo com xpAwarded zerado', async () => {
    // Fecha o furo do sentinel: sem `isLifecycleEvent`, um tipo desconhecido
    // com xpAwarded igual ao sentinel passaria.
    await assertFails(transitionAs(BOB, 'paused', evento({ type: 'encounter', xpAwarded: 0 })));
  });

  it('NEGA xpAwarded fora da tabela', async () => {
    await assertFails(transitionAs(BOB, 'paused', evento({ xpAwarded: 5000 })));
  });

  it('NEGA occurredAt escolhido pelo cliente', async () => {
    await assertFails(transitionAs(BOB, 'paused', evento({ occurredAt: new Date(0) })));
  });

  it('NEGA campo fora do formato do evento', async () => {
    await assertFails(transitionAs(BOB, 'paused', evento({ nota: 'campo extra' })));
  });

  it('NEGA um segundo nascimento numa parceria que já existe', async () => {
    // XP 100 de graça, quantas vezes quisesse, com id automático.
    await assertFails(
      transitionAs(BOB, 'paused', evento({ type: 'partnership_born', xpAwarded: 100 })),
    );
  });

  it('NEGA evento de pausa numa parceria já pausada, sem mudança de status', async () => {
    // paused → paused não é transição: o evento não narra nada.
    await seedWithStatus('paused');
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.collection(`partnerships/${PID}/events`).add(evento()));
  });

  it('NEGA events/born numa parceria existente que ainda não tem esse doc', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`partnerships/${PID}/events/born`).delete();
    });
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${PID}/events/born`)
        .set(evento({ type: 'partnership_born', xpAwarded: 100 })),
    );
  });

  it('NEGA partnership_resumed da reativação fora do id = código do convite', async () => {
    // A reativação grava o evento em events/{código novo}: um por convite,
    // e é esse doc que a parceria confere. Com id automático, nega.
    await seedWithStatus('ended');
    await seedInvite(env, 'NEWCODE1', validInvite(ALICE, { code: 'NEWCODE1' }));
    const bob = env.authenticatedContext(BOB).firestore();
    const batch = bob.batch();
    batch.update(bob.doc(`partnerships/${PID}`), {
      status: 'active', temperature: 50, temperatureBand: 'mild',
      memberProfiles: validPartnership(ALICE, BOB, CODE).memberProfiles,
      bornFromInvite: 'NEWCODE1', updatedAt: serverTimestamp(),
    });
    batch.update(bob.doc('invites/NEWCODE1'), { usedBy: BOB, status: 'accepted' });
    batch.set(bob.doc(`partnerships/${PID}/events/NEWCODE1`), evento({ type: 'partnership_resumed' }));
    batch.set(bob.collection(`partnerships/${PID}/events`).doc(), evento({ type: 'partnership_resumed' }));
    await assertFails(batch.commit());
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

describe('events — nascimento', () => {
  // Par novo (Alice convida, Carol aceita): a parceria nasce neste commit.
  const BIRTH_CODE = 'BIRTHCD1';
  const BIRTH_PID = [ALICE, CAROL].sort().join('_');

  beforeEach(() => seedInvite(env, BIRTH_CODE, validInvite(ALICE, { code: BIRTH_CODE })));

  function birthAs(uid: string, ev: Record<string, unknown> | null, eventId = 'born') {
    const db = env.authenticatedContext(uid).firestore();
    const batch = db.batch();
    batch.set(db.doc(`partnerships/${BIRTH_PID}`), validPartnership(ALICE, CAROL, BIRTH_CODE));
    batch.update(db.doc(`invites/${BIRTH_CODE}`), { usedBy: uid, status: 'accepted' });
    if (ev !== null) batch.set(db.doc(`partnerships/${BIRTH_PID}/events/${eventId}`), ev);
    return batch.commit();
  }

  const born = (over: Record<string, unknown> = {}) =>
    evento({ type: 'partnership_born', xpAwarded: 100, ...over });

  it('PERMITE o evento de nascimento junto com a parceria que está nascendo', async () => {
    await assertSucceeds(birthAs(CAROL, born()));
  });

  it('NEGA nascimento com xpAwarded diferente de 100', async () => {
    await assertFails(birthAs(CAROL, born({ xpAwarded: 999 })));
  });

  it('NEGA o nascimento com id diferente de born', async () => {
    // Id fixo é o que torna o nascimento único: um segundo `set` em
    // events/born vira update, que é negado.
    await assertFails(birthAs(CAROL, born(), 'outro-id'));
  });

  it('NEGA um segundo nascimento, com outro id, no commit do nascimento', async () => {
    // events/born existe (a parceria fica satisfeita); o extra só cai pelo id.
    const db = env.authenticatedContext(CAROL).firestore();
    const batch = db.batch();
    batch.set(db.doc(`partnerships/${BIRTH_PID}`), validPartnership(ALICE, CAROL, BIRTH_CODE));
    batch.update(db.doc(`invites/${BIRTH_CODE}`), { usedBy: CAROL, status: 'accepted' });
    batch.set(db.doc(`partnerships/${BIRTH_PID}/events/born`), born());
    batch.set(db.collection(`partnerships/${BIRTH_PID}/events`).doc(), born());
    await assertFails(batch.commit());
  });

  it('NEGA a parceria nascer sem o evento de nascimento', async () => {
    // Sentido parceria → evento: a parceria confere events/born no getAfter.
    await assertFails(birthAs(CAROL, null));
  });

  it('NEGA evento de pausa no lugar do nascimento', async () => {
    await assertFails(birthAs(CAROL, evento()));
  });
});
