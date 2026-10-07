import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setLogLevel,
  type Firestore,
} from 'firebase/firestore';
import { INVITE_TTL_MS } from '../../shared/invite';
import { partnershipId } from '../../shared/partnership';
import type { UserDoc } from '../../shared/types';
import {
  InviteRejectedError,
  acceptInvite,
  createInvite,
} from '../../src/features/invite/services/invites';
import { ALICE, BOB, CAROL, createTestEnv, validProfile } from '../rules/helpers';
import { seedInvite, seedUsers, validInvite } from '../rules/factories';

let env: RulesTestEnvironment;
const dbOf = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
// seedUsers grava o handle como o uid sem hifens; o perfil do convite precisa bater.
const profileOf = (uid: string) => validProfile(uid, uid.replace(/-/g, '')) as unknown as UserDoc;
const PID = partnershipId(ALICE, BOB);

beforeAll(async () => {
  // Os testes de recusa fazem o SDK avisar no console; o aviso é esperado.
  setLogLevel('error');
  env = await createTestEnv();
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
});

async function aliceInvites() {
  return createInvite(dbOf(ALICE), ALICE, profileOf(ALICE));
}

describe('nascimento', () => {
  it('cria a parceria com os valores do domínio', async () => {
    const code = await aliceInvites();
    const result = await acceptInvite(dbOf(BOB), code, BOB);

    expect(result).toEqual({ pid: PID, reactivated: false });

    const snap = await getDoc(doc(dbOf(BOB), 'partnerships', PID));
    expect(snap.data()).toMatchObject({
      members: [ALICE, BOB].sort(),
      status: 'active',
      createdBy: ALICE,
      bornFromInvite: code,
      xparceria: 100,
      level: 1,
      xpForNextLevel: 122,
      temperature: 50,
      temperatureBand: 'mild',
      achievements: ['o-comeco'],
    });
  });

  it('grava o evento de nascimento na mesma transação', async () => {
    // É o que getAfter() torna possível: a regra do evento enxerga a parceria
    // que ainda está nascendo. Sem ela, este teste é impossível de passar.
    const code = await aliceInvites();
    await acceptInvite(dbOf(BOB), code, BOB);

    const ev = await getDoc(doc(dbOf(BOB), `partnerships/${PID}/events`, 'born'));
    expect(ev.exists()).toBe(true);
    expect(ev.data()).toMatchObject({ type: 'partnership_born', xpAwarded: 100 });
  });

  it('desnormaliza os dois perfis a partir de users/{uid}', async () => {
    const code = await aliceInvites();
    await acceptInvite(dbOf(BOB), code, BOB);
    const snap = await getDoc(doc(dbOf(BOB), 'partnerships', PID));
    const profiles = snap.get('memberProfiles');
    expect(Object.keys(profiles).sort()).toEqual([ALICE, BOB].sort());
    const { displayName, photoURL, avatarEmoji } = profileOf(BOB);
    expect(profiles[BOB]).toEqual({ displayName, photoURL, avatarEmoji });
  });

  it('usa o perfil atual de quem convidou, não a cópia velha do convite', async () => {
    const code = await aliceInvites();
    // A Alice muda o perfil depois de mandar o convite: invite.fromProfile fica velho.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`users/${ALICE}`)
        .update({ displayName: 'Alice Nova', avatarEmoji: '🐙' });
    });

    await acceptInvite(dbOf(BOB), code, BOB);

    const snap = await getDoc(doc(dbOf(BOB), 'partnerships', PID));
    expect(snap.get(`memberProfiles.${ALICE}`)).toEqual({
      displayName: 'Alice Nova',
      photoURL: null,
      avatarEmoji: '🐙',
    });
  });

  it('marca o convite como usado', async () => {
    const code = await aliceInvites();
    await acceptInvite(dbOf(BOB), code, BOB);
    const invite = await getDoc(doc(dbOf(BOB), 'invites', code));
    expect(invite.data()).toMatchObject({ usedBy: BOB, status: 'accepted' });
  });

  it('não escreve nada no documento do usuário — stats é derivado', async () => {
    const code = await aliceInvites();
    await acceptInvite(dbOf(BOB), code, BOB);
    const alice = await getDoc(doc(dbOf(BOB), 'users', ALICE));
    expect(alice.get('stats.partnershipCount')).toBe(0);
  });
});

describe('fraude e casos de borda', () => {
  it('recusa aceitar o próprio convite', async () => {
    const code = await aliceInvites();
    await expect(acceptInvite(dbOf(ALICE), code, ALICE))
      .rejects.toMatchObject({ reason: 'self' });
  });

  it('recusa código inexistente', async () => {
    const attempt = acceptInvite(dbOf(BOB), 'NAOEXIST', BOB);
    await expect(attempt).rejects.toBeInstanceOf(InviteRejectedError);
    await expect(attempt).rejects.toMatchObject({ reason: 'not-found' });
  });

  it('recusa convite vencido', async () => {
    await seedInvite(env, 'VELHO123', validInvite(ALICE, {
      code: 'VELHO123',
      createdAt: new Date(Date.now() - INVITE_TTL_MS - 60_000),
    }));
    await expect(acceptInvite(dbOf(BOB), 'VELHO123', BOB))
      .rejects.toMatchObject({ reason: 'expired' });
  });

  it('recusa o segundo aceite do mesmo convite', async () => {
    const code = await aliceInvites();
    await acceptInvite(dbOf(BOB), code, BOB);
    await expect(acceptInvite(dbOf(CAROL), code, CAROL))
      .rejects.toMatchObject({ reason: 'used' });
  });

  it('recusa quando as duas pessoas já são parceiras ativas', async () => {
    const first = await aliceInvites();
    await acceptInvite(dbOf(BOB), first, BOB);
    const second = await aliceInvites();
    await expect(acceptInvite(dbOf(BOB), second, BOB))
      .rejects.toMatchObject({ reason: 'already-partners' });
    // E o convite novo continua pendente: a recusa não queima o convite.
    const invite = await getDoc(doc(dbOf(BOB), 'invites', second));
    expect(invite.data()).toMatchObject({ usedBy: null, status: 'pending' });
  });
});
