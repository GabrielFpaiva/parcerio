import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ALICE, BOB, CAROL, createTestEnv } from './helpers';
import { seedSuperPartnership, seedUsers, validSuperPartnership } from './factories';

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

// Finding 5 da revisão de 2026-08-31: sem um bloco explícito para
// superPartnerships/{spid}, o documento cai no catch-all
// (`allow read, write: if false`) — proteção por acidente. Quem escrever a
// Spec 6 e adicionar uma regra para este documento pode abrir `members` sem
// perceber o que depende disso: roundClosed() compara
// voterUids.hasAll(members), e gameXp() lê members.size() ao vivo em cada
// write da rodada. Um membro saindo no meio de uma rodada, com `members`
// mutável, trava xpAwarded em 6 para sempre — todo mundo que ficou já
// votou, então nenhum update novo bate mais o quórum.
describe('superPartnerships — members é imutável enquanto a Spec 6 não existir', () => {
  it('PERMITE que um membro leia a própria Super Parceria', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(alice.doc(`superPartnerships/${SPID}`).get());
  });

  it('NEGA que quem não é membro leia a Super Parceria', async () => {
    const dave = env.authenticatedContext(DAVE).firestore();
    await assertFails(dave.doc(`superPartnerships/${SPID}`).get());
  });

  it('NEGA que um membro mude members', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      alice.doc(`superPartnerships/${SPID}`).update({ members: [ALICE, BOB, CAROL, DAVE] }),
    );
  });

  it('NEGA update em qualquer outro campo — o documento inteiro é congelado até a Spec 6', async () => {
    // Um campo isolado que não é `members`, para provar que a negação não é
    // só sobre `members` especificamente: é `allow update: if false` no
    // documento inteiro.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(`superPartnerships/${SPID}`).update({ name: 'Nome Novo' }));
  });

  it('NEGA criação pelo cliente', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(
      alice.doc(`superPartnerships/sp-novo`).set(validSuperPartnership([ALICE, BOB, CAROL])),
    );
  });

  it('NEGA apagar', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc(`superPartnerships/${SPID}`).delete());
  });
});
