import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedPartnership, seedUsers, validPartnership } from './factories';

let env: RulesTestEnvironment;
const PID = [ALICE, BOB].sort().join('_');

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
});

function seedAliceBob(over: Record<string, unknown> = {}) {
  return seedPartnership(env, PID, {
    ...validPartnership(ALICE, BOB, 'AB3D4F7H'),
    createdAt: new Date(), activatedAt: new Date(), updatedAt: new Date(),
    ...over,
  });
}

// O aceite (Task 7) faz tx.get(partnerships/{pid}) para decidir entre
// nascimento e reativação. Sem documento não há resource.data.members, e
// isMember negava a leitura que só responde "ainda não existe".
describe('partnerships — get de parceria inexistente', () => {
  it('PERMITE que quem compõe o pid leia a parceria que ainda não existe', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.doc(`partnerships/${PID}`).get());
  });

  it('NEGA a quem não compõe o pid', async () => {
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(carol.doc(`partnerships/${PID}`).get());
  });

  it('NEGA a anônimo', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(anon.doc(`partnerships/${PID}`).get());
  });

  it('NEGA pid que não é um par (só o próprio uid)', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${BOB}`).get());
  });

  it('NEGA list da coleção', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.collection('partnerships').get());
  });
});

describe('partnerships — get de parceria existente', () => {
  it('PERMITE a membro', async () => {
    await seedAliceBob();
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(bob.doc(`partnerships/${PID}`).get());
  });

  it('NEGA a não-membro', async () => {
    await seedAliceBob();
    const carol = env.authenticatedContext(CAROL).firestore();
    await assertFails(carol.doc(`partnerships/${PID}`).get());
  });

  it('NEGA a quem compõe o pid mas não está em members', async () => {
    // Documento incoerente (as regras de create não o deixam nascer), só para
    // isolar `resource == null`: o ramo novo nunca abre um doc que existe.
    await seedAliceBob({ members: [ALICE, CAROL] });
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`partnerships/${PID}`).get());
  });
});
