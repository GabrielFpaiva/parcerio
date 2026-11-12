import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, query, setLogLevel, where, type Firestore,
} from 'firebase/firestore';
import { partnershipId } from '../../shared/partnership';
import type { UserDoc } from '../../shared/types';
import { acceptInvite, createInvite } from '../../src/features/invite/services/invites';
import {
  endPartnership, pausePartnership, propagateProfile, resumePartnership,
} from '../../src/features/partnership/services/partnerships';
import { ALICE, BOB, CAROL, createTestEnv, validProfile } from '../rules/helpers';
import { seedUsers } from '../rules/factories';

let env: RulesTestEnvironment;
const dbOf = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const profileOf = (uid: string) => validProfile(uid, uid.replace(/-/g, '')) as unknown as UserDoc;
const PID = partnershipId(ALICE, BOB);
const PID_BC = partnershipId(BOB, CAROL);

async function nascer(a: string, b: string) {
  const code = await createInvite(dbOf(a), a, profileOf(a));
  await acceptInvite(dbOf(b), code, b);
}

async function eventosDoTipo(tipo: string) {
  return getDocs(query(collection(dbOf(BOB), `partnerships/${PID}/events`), where('type', '==', tipo)));
}

const readPartnership = async (pid: string) => getDoc(doc(dbOf(BOB), 'partnerships', pid));

beforeAll(async () => {
  setLogLevel('error');
  env = await createTestEnv();
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
  await nascer(ALICE, BOB);
});

describe('ciclo de vida', () => {
  it('pausar desliga a parceria e registra o evento', async () => {
    await pausePartnership(dbOf(BOB), PID);
    expect((await readPartnership(PID)).get('status')).toBe('paused');
    const evs = await eventosDoTipo('partnership_paused');
    expect(evs.size).toBe(1);
    expect(evs.docs[0]!.get('xpAwarded')).toBe(0);
  });

  it('retomar volta para ativa e registra o evento', async () => {
    await pausePartnership(dbOf(BOB), PID);
    await resumePartnership(dbOf(ALICE), PID);
    expect((await readPartnership(PID)).get('status')).toBe('active');
    expect((await eventosDoTipo('partnership_resumed')).size).toBe(1);
  });

  it('encerrar preserva XParceria, nível e a timeline', async () => {
    await endPartnership(dbOf(BOB), PID);
    const snap = await readPartnership(PID);
    expect(snap.get('status')).toBe('ended');
    expect(snap.get('xparceria')).toBe(100);
    expect(snap.get('level')).toBe(1);
    expect((await getDoc(doc(dbOf(BOB), `partnerships/${PID}/events`, 'born'))).exists()).toBe(true);
    expect((await eventosDoTipo('partnership_ended')).size).toBe(1);
  });

  it('NEGA que não-membro pause', async () => {
    await assertFails(pausePartnership(dbOf(CAROL), PID));
  });

  it('NEGA pausar uma parceria já encerrada', async () => {
    await endPartnership(dbOf(BOB), PID);
    await assertFails(pausePartnership(dbOf(BOB), PID));
  });

  it('NEGA retomar uma parceria que não está pausada', async () => {
    await assertFails(resumePartnership(dbOf(BOB), PID));
  });
});

describe('propagação de perfil', () => {
  const novo = { displayName: 'Bob Novo', photoURL: null, avatarEmoji: '🐙' };
  const profilesOf = async (pid: string) => (await readPartnership(pid)).get('memberProfiles');

  it('atualiza a própria entrada em memberProfiles', async () => {
    await propagateProfile(dbOf(BOB), BOB, novo, [PID]);
    expect((await profilesOf(PID))[BOB]).toEqual(novo);
  });

  it('não toca no perfil do outro membro', async () => {
    const antes = (await profilesOf(PID))[ALICE];
    await propagateProfile(dbOf(BOB), BOB, novo, [PID]);
    expect((await profilesOf(PID))[ALICE]).toEqual(antes);
  });

  it('NEGA reescrever o perfil do outro passando o uid dele', async () => {
    await assertFails(propagateProfile(dbOf(BOB), ALICE, novo, [PID]));
  });

  it('pula a parceria já igual e escreve só a desatualizada', async () => {
    await nascer(CAROL, BOB);
    await propagateProfile(dbOf(BOB), BOB, novo, [PID]); // PID passa a estar igual
    const igualAntes = (await readPartnership(PID)).get('updatedAt');
    const velhaAntes = (await readPartnership(PID_BC)).get('updatedAt');

    await propagateProfile(dbOf(BOB), BOB, novo, [PID, PID_BC]);

    expect((await profilesOf(PID_BC))[BOB]).toEqual(novo);
    expect((await readPartnership(PID)).get('updatedAt').isEqual(igualAntes)).toBe(true);
    expect((await readPartnership(PID_BC)).get('updatedAt').isEqual(velhaAntes)).toBe(false);
  });

  it('não falha quando todas as parcerias já estão iguais', async () => {
    await propagateProfile(dbOf(BOB), BOB, novo, [PID]);
    await expect(propagateProfile(dbOf(BOB), BOB, novo, [PID])).resolves.toBeUndefined();
  });
});
