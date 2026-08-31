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

it('NEGA anônimo consultar handle (:121 exige isSignedIn, sem teste até aqui)', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'handles', 'gabriel'), { uid: ALICE });
  });
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'handles', 'gabriel')));
});

// Hole 2 (revisão adversarial 2026-08-27): a regra só checava
// `uid == request.auth.uid`. Sem checar formato, handle vazio, com 500
// caracteres ou maiúsculo passavam — e como handles não tem update/delete e
// users.handle é imutável, nada disso era corrigível depois. Formato
// espelhado de HANDLE_PATTERN em src/features/profile/services/profile.ts.
describe('handles — formato (Hole 2)', () => {
  it('NEGA handle curto demais (abaixo de 3 caracteres)', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'handles', 'ab'), { uid: ALICE }));
  });

  it('NEGA handle longo demais (acima de 20 caracteres)', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    const longo = 'a'.repeat(21);
    await assertFails(setDoc(doc(db, 'handles', longo), { uid: ALICE }));
  });

  it('NEGA handle com maiúsculas', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'handles', 'Gabriel'), { uid: ALICE }));
  });

  it('NEGA handle com caractere fora do alfabeto permitido', async () => {
    const db = env.authenticatedContext(ALICE).firestore();
    await assertFails(setDoc(doc(db, 'handles', 'gabriel!'), { uid: ALICE }));
  });
});
