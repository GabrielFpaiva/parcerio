import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteField, serverTimestamp } from 'firebase/firestore';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedInvite, seedPartnership, seedUsers, validInvite, validPartnership } from './factories';

let env: RulesTestEnvironment;

const CODE = 'AB3D4F7H';
const NEW_CODE = 'NEWCODE1';
const PID = [ALICE, BOB].sort().join('_');

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

/** Parceria já existente no status pedido, semeada por fora das regras. */
function seedWithStatus(status: string) {
  return seedPartnership(env, PID, {
    ...validPartnership(ALICE, BOB, CODE),
    status,
    createdAt: new Date(),
    activatedAt: new Date(),
    updatedAt: new Date(),
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
    await seedWithStatus(from);
    const bob = env.authenticatedContext(BOB).firestore();
    const write = bob.doc(`partnerships/${PID}`).update({ status: to, updatedAt: serverTimestamp() });
    await (permitido ? assertSucceeds(write) : assertFails(write));
  });

  it('NEGA que não-membro mude o status', async () => {
    await seedWithStatus('active');
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(
      carol.doc(`partnerships/${PID}`).update({ status: 'ended', updatedAt: serverTimestamp() }),
    );
  });

  it('NEGA carona: mudar status e xparceria na mesma escrita', async () => {
    // O buraco clássico. hasOnly(['status','updatedAt']) é o que fecha.
    await seedWithStatus('active');
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${PID}`)
        .update({ status: 'paused', xparceria: 999_999, updatedAt: serverTimestamp() }),
    );
  });

  it('NEGA updatedAt escolhido pelo cliente', async () => {
    await seedWithStatus('active');
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).update({ status: 'paused', updatedAt: new Date(0) }));
  });

  it('NEGA delete — encerrar é mudar status, nunca apagar', async () => {
    await seedWithStatus('active');
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).delete());
  });
});

describe('reativação de parceria encerrada', () => {
  /** O que o reaceite muda na parceria. memberProfiles vem de users/{uid}. */
  const reativa = (over: Record<string, unknown> = {}) => ({
    status: 'active',
    temperature: 50,
    temperatureBand: 'mild',
    memberProfiles: validPartnership(ALICE, BOB, CODE).memberProfiles,
    bornFromInvite: NEW_CODE,
    updatedAt: serverTimestamp(),
    ...over,
  });

  type Opts = { consume?: string | null; eventId?: string | null; eventType?: string };

  /**
   * O reaceite inteiro, como a Task 7 faz: parceria + convite consumido +
   * evento `partnership_resumed` com id = código do convite, num commit só.
   * `consume: null` / `eventId: null` tiram aquela perna da escrita.
   */
  function reactivateAs(uid: string, over: Record<string, unknown> = {}, opts: Opts = {}) {
    const data = reativa(over);
    const code = data.bornFromInvite as string;
    const consume = opts.consume === undefined ? NEW_CODE : opts.consume;
    const eventId = opts.eventId === undefined ? code : opts.eventId;
    const db = env.authenticatedContext(uid).firestore();
    const batch = db.batch();
    batch.update(db.doc(`partnerships/${PID}`), data);
    if (consume !== null) {
      batch.update(db.doc(`invites/${consume}`), { usedBy: uid, status: 'accepted' });
    }
    if (eventId !== null) {
      batch.set(db.doc(`partnerships/${PID}/events/${eventId}`), {
        type: opts.eventType ?? 'partnership_resumed',
        occurredAt: serverTimestamp(),
        xpAwarded: 0,
      });
    }
    return batch.commit();
  }

  beforeEach(async () => {
    await seedWithStatus('ended');
    await seedInvite(env, NEW_CODE, validInvite(ALICE, { code: NEW_CODE }));
  });

  it('PERMITE a reativação completa: parceria, convite e evento no mesmo commit', async () => {
    await assertSucceeds(reactivateAs(BOB));
  });

  it('PERMITE a reativação completa numa transação', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(
      bob.runTransaction(async (tx) => {
        tx.update(bob.doc(`partnerships/${PID}`), reativa());
        tx.update(bob.doc(`invites/${NEW_CODE}`), { usedBy: BOB, status: 'accepted' });
        tx.set(bob.doc(`partnerships/${PID}/events/${NEW_CODE}`), {
          type: 'partnership_resumed', occurredAt: serverTimestamp(), xpAwarded: 0,
        });
      }),
    );
  });

  it('NEGA reativar sem convite válido', async () => {
    // Consome o convite real: atualizar um convite inexistente daria NOT_FOUND.
    await assertFails(reactivateAs(BOB, { bornFromInvite: 'NAOEXISTE' }));
  });

  it('NEGA reativar com o próprio convite', async () => {
    await seedInvite(env, 'BOBCODE1', validInvite(BOB, { code: 'BOBCODE1' }));
    await assertFails(reactivateAs(BOB, { bornFromInvite: 'BOBCODE1' }, { consume: 'BOBCODE1' }));
  });

  it('NEGA reativar com convite de terceiro', async () => {
    // Convite aberto da Carol: Bob o consome para ressuscitar a parceria com
    // a Alice, que não convidou ninguém.
    await seedInvite(env, 'CAROLCOD', validInvite(CAROL, { code: 'CAROLCOD' }));
    await assertFails(reactivateAs(BOB, { bornFromInvite: 'CAROLCOD' }, { consume: 'CAROLCOD' }));
  });

  it('NEGA que não-membro reative com o convite de um dos membros', async () => {
    // otherMember() devolve a Alice para a Carol também: sem isMember, a
    // Carol ressuscitaria a parceria dos dois com o convite da Alice.
    await assertFails(reactivateAs(CAROL));
  });

  it('NEGA reativar sem consumir o convite no mesmo commit', async () => {
    // Sem inviteConsumedBy, o uso único do convite voltava pelo update.
    await assertFails(reactivateAs(BOB, {}, { consume: null }));
  });

  it('NEGA reativar com convite já usado por outra pessoa', async () => {
    await seedInvite(env, NEW_CODE, validInvite(ALICE, { code: NEW_CODE, usedBy: CAROL, status: 'accepted' }));
    await assertFails(reactivateAs(BOB, {}, { consume: null }));
  });

  it('NEGA reativar com o perfil da Alice forjado', async () => {
    const profiles = validPartnership(ALICE, BOB, CODE).memberProfiles;
    await assertFails(
      reactivateAs(BOB, {
        memberProfiles: { ...profiles, [ALICE]: { ...profiles[ALICE], displayName: 'Alice Falsa' } },
      }),
    );
  });

  it('NEGA reativar com perfil de quem não é membro', async () => {
    const profiles = validPartnership(ALICE, BOB, CODE).memberProfiles;
    await assertFails(
      reactivateAs(BOB, {
        memberProfiles: { ...profiles, [CAROL]: profiles[ALICE] },
      }),
    );
  });

  it('NEGA reconceder XParceria na volta — nada é perdido, nada é ganho de graça', async () => {
    await assertFails(reactivateAs(BOB, { xparceria: 200 }));
  });

  it('NEGA temperatura diferente de 50 na volta', async () => {
    await assertFails(reactivateAs(BOB, { temperature: 100 }));
  });

  it('NEGA faixa de temperatura diferente de mild na volta', async () => {
    await assertFails(reactivateAs(BOB, { temperatureBand: 'hot' }));
  });

  it('NEGA voltar em status diferente de active', async () => {
    await assertFails(reactivateAs(BOB, { status: 'paused' }));
  });

  it('NEGA updatedAt escolhido pelo cliente na volta', async () => {
    await assertFails(reactivateAs(BOB, { updatedAt: new Date(0) }));
  });

  it('NEGA mexer no aniversário da parceria', async () => {
    await assertFails(reactivateAs(BOB, { activatedAt: serverTimestamp() }));
  });

  it('NEGA reativar parceria que está apenas pausada', async () => {
    // A escrita é a mesma do caminho feliz: só o status de partida muda.
    await seedWithStatus('paused');
    await assertFails(reactivateAs(BOB));
  });

  // ---- os dois sentidos de cada amarra -----------------------------------

  it('NEGA consumir o convite novo sem reativar a parceria', async () => {
    // Sentido convite → parceria: a parceria `ended` continua apontando para
    // o código antigo, então o lado do convite nega.
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`invites/${NEW_CODE}`).update({ usedBy: BOB, status: 'accepted' }));
  });

  it('NEGA reativar sem gravar o evento partnership_resumed', async () => {
    // Sentido parceria → evento: a volta sempre deixa rastro na timeline.
    await assertFails(reactivateAs(BOB, {}, { eventId: null }));
  });

  it('NEGA reativar quando o doc no id do código não é partnership_resumed', async () => {
    // O id do evento é escolhido pelo cliente: alguém poderia ter gravado um
    // evento de pausa com id = código antes. A parceria confere o tipo.
    await seedPartnership(env, `${PID}/events/${NEW_CODE}`, {
      type: 'partnership_paused', occurredAt: new Date(), xpAwarded: 0,
    });
    await assertFails(reactivateAs(BOB, {}, { eventId: null }));
  });
});

describe('propagação do próprio perfil', () => {
  beforeEach(() => seedWithStatus('active'));

  const bobNovo = { displayName: 'Bob Novo', photoURL: null, avatarEmoji: '🐢' };

  it('PERMITE atualizar a própria entrada em memberProfiles', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(
      bob.doc(`partnerships/${PID}`).update({
        [`memberProfiles.${BOB}`]: bobNovo,
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

  it('NEGA mudar o próprio perfil e o do outro na mesma escrita', async () => {
    // Separa a igualdade de um hasAny: o diff contém a própria chave também.
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${PID}`).update({
        [`memberProfiles.${BOB}`]: bobNovo,
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

  it('NEGA que não-membro se acrescente em memberProfiles', async () => {
    // O diff afeta só a chave da Carol — hasOnly([auth.uid]) passaria.
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(
      carol.doc(`partnerships/${PID}`).update({
        [`memberProfiles.${CAROL}`]: bobNovo,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('NEGA apagar a própria entrada', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${PID}`).update({
        [`memberProfiles.${BOB}`]: deleteField(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('NEGA campo fora do formato de MemberProfile', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${PID}`).update({
        [`memberProfiles.${BOB}`]: { ...bobNovo, bio: 'campo extra' },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('NEGA update que só mexe em updatedAt', async () => {
    // Diff vazio em memberProfiles: hasOnly([auth.uid]) aceitaria.
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).update({ updatedAt: serverTimestamp() }));
  });

  it('NEGA updatedAt escolhido pelo cliente na propagação', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(
      bob.doc(`partnerships/${PID}`).update({
        [`memberProfiles.${BOB}`]: bobNovo,
        updatedAt: new Date(0),
      }),
    );
  });
});
