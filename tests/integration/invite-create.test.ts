import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { setLogLevel, type Firestore } from 'firebase/firestore';
import { INVITE_CODE_LENGTH } from '../../shared/invite';
import type { UserDoc } from '../../shared/types';
import { createInvite, inviteUrl, readInvite } from '../../src/features/invite/services/invites';
import { ALICE, BOB, createTestEnv, validProfile } from '../rules/helpers';
import { seedUsers } from '../rules/factories';

let env: RulesTestEnvironment;
const dbOf = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;

beforeAll(async () => {
  // O teste de negação faz o SDK avisar no console; o aviso é esperado.
  setLogLevel('error');
  env = await createTestEnv();
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB]);
});

// seedUsers grava o handle como o uid sem hifens; o perfil enviado precisa
// bater com o que está no banco, senão a regra (matchesOwnProfile) nega.
const ALICE_HANDLE = ALICE.replace(/-/g, '');
const aliceProfile = () => validProfile(ALICE, ALICE_HANDLE) as unknown as UserDoc;

describe('createInvite', () => {
  it('grava um convite pendente e devolve o código', async () => {
    const code = await createInvite(dbOf(ALICE), ALICE, aliceProfile());
    expect(code).toHaveLength(INVITE_CODE_LENGTH);

    const invite = await readInvite(dbOf(BOB), code);
    expect(invite).toMatchObject({ code, fromUid: ALICE, usedBy: null, status: 'pending', maxUses: 1 });
  });

  it('copia o perfil real de quem convida — a regra não aceita outro', async () => {
    const code = await createInvite(dbOf(ALICE), ALICE, aliceProfile());
    const invite = await readInvite(dbOf(BOB), code);
    expect(invite?.fromProfile.displayName).toBe(aliceProfile().displayName);
    expect(invite?.fromProfile.handle).toBe(ALICE_HANDLE);
  });

  it('gera códigos diferentes a cada chamada', async () => {
    const a = await createInvite(dbOf(ALICE), ALICE, aliceProfile());
    const b = await createInvite(dbOf(ALICE), ALICE, aliceProfile());
    expect(a).not.toBe(b);
  });

  it('devolve null para código inexistente, em vez de estourar', async () => {
    expect(await readInvite(dbOf(BOB), 'NAOEXIST')).toBeNull();
  });

  it('a regra impede convite com perfil de outra pessoa', async () => {
    const mentiroso = { ...aliceProfile(), displayName: 'Bob' };
    await assertFails(createInvite(dbOf(ALICE), ALICE, mentiroso));
    // O que chega é a negação da regra, não um erro genérico após o retry.
    await expect(createInvite(dbOf(ALICE), ALICE, mentiroso)).rejects.toMatchObject({ code: 'permission-denied' });
    // E o mesmo perfil, sem a mentira, passa: a negação acima é só do displayName.
    await expect(createInvite(dbOf(ALICE), ALICE, aliceProfile())).resolves.toHaveLength(INVITE_CODE_LENGTH);
  });
});

describe('inviteUrl', () => {
  it('leva o código e o nome, para a landing personalizar sem ler o banco', () => {
    const url = inviteUrl('AB3D4F7H', 'Alice Não-Sei-Quê');
    expect(url).toContain('c=AB3D4F7H');
    expect(url).toContain(encodeURIComponent('Alice Não-Sei-Quê'));
  });
});
