import { TEMPERATURE, XP } from '../constants';
import { buildBirthPartnership, buildReactivationUpdate, partnershipId } from '../partnership';
import type { MemberProfile } from '../types';

const ALICE = 'alice-uid';
const BOB = 'bob-uid';

const aliceProfile: MemberProfile = { displayName: 'Alice', photoURL: null, avatarEmoji: '🦊' };
const bobProfile: MemberProfile = { displayName: 'Bob', photoURL: 'https://x/p.jpg', avatarEmoji: '🐢' };

describe('partnershipId', () => {
  it('é o mesmo independente da ordem dos argumentos', () => {
    expect(partnershipId(ALICE, BOB)).toBe(partnershipId(BOB, ALICE));
  });

  it('junta os uids ordenados com underline', () => {
    expect(partnershipId(BOB, ALICE)).toBe('alice-uid_bob-uid');
  });

  it('recusa parceria de alguém consigo mesmo', () => {
    expect(() => partnershipId(ALICE, ALICE)).toThrow('mesma pessoa');
  });
});

describe('buildBirthPartnership', () => {
  const birth = buildBirthPartnership({
    inviter: { uid: BOB, profile: bobProfile },
    accepter: { uid: ALICE, profile: aliceProfile },
    inviteCode: 'AB3D4F7H',
  });

  it('ordena os membros, independente de quem convidou', () => {
    expect(birth.members).toEqual([ALICE, BOB]);
    expect(birth.id).toBe('alice-uid_bob-uid');
  });

  it('registra quem convidou, não quem aceitou', () => {
    expect(birth.createdBy).toBe(BOB);
  });

  it('guarda o convite que a autorizou — é como a regra prova o consentimento', () => {
    expect(birth.bornFromInvite).toBe('AB3D4F7H');
  });

  it('nasce ativa — "pending" não existe como parceria', () => {
    expect(birth.status).toBe('active');
  });

  it('concede o XParceria de nascimento e deixa a barra a um passo do nível 2', () => {
    expect(birth.xparceria).toBe(XP.PARTNERSHIP_BORN);
    expect(birth.level).toBe(1);
    expect(birth.xpIntoLevel).toBe(100);
    expect(birth.xpForNextLevel).toBe(122);
  });

  it('nasce morna, com a banda derivada da temperatura e não digitada à mão', () => {
    expect(birth.temperature).toBe(TEMPERATURE.INITIAL);
    expect(birth.temperatureBand).toBe('mild');
  });

  it('desnormaliza os dois perfis', () => {
    expect(birth.memberProfiles).toEqual({ [ALICE]: aliceProfile, [BOB]: bobProfile });
  });

  it('zera streak e stats e concede a conquista do começo', () => {
    expect(birth.streak).toEqual({ current: 0, longest: 0, lastDay: null, freezesLeft: 2 });
    expect(birth.stats.encounterCount).toBe(0);
    expect(birth.stats.lastEncounterAt).toBeNull();
    expect(birth.achievements).toEqual(['o-comeco']);
    expect(birth.superPartnershipId).toBeNull();
  });

  it('não carrega timestamp — quem escreve é que decide o relógio', () => {
    expect(birth).not.toHaveProperty('createdAt');
    expect(birth).not.toHaveProperty('activatedAt');
    expect(birth).not.toHaveProperty('updatedAt');
  });
});

describe('buildReactivationUpdate', () => {
  const update = buildReactivationUpdate({ [ALICE]: aliceProfile, [BOB]: bobProfile }, 'NEWCODE1');

  it('volta a ficar ativa e morna', () => {
    expect(update.status).toBe('active');
    expect(update.temperature).toBe(TEMPERATURE.INITIAL);
    expect(update.temperatureBand).toBe('mild');
  });

  it('registra o convite novo que autorizou a volta', () => {
    expect(update.bornFromInvite).toBe('NEWCODE1');
  });

  it('não toca em XParceria, nível nem conquistas — nada é perdido', () => {
    expect(update).not.toHaveProperty('xparceria');
    expect(update).not.toHaveProperty('level');
    expect(update).not.toHaveProperty('achievements');
    expect(update).not.toHaveProperty('stats');
  });

  it('não mexe no aniversário da parceria', () => {
    expect(update).not.toHaveProperty('activatedAt');
  });
});
