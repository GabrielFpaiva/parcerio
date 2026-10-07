import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { ALICE, BOB, CAROL, createTestEnv, validProfile } from './helpers';
import { seedInvite, seedPartnership, seedUsers, validInvite, validPartnership } from './factories';

let env: RulesTestEnvironment;

const CODE = 'AB3D4F7H';
const PID = [ALICE, BOB].sort().join('_');

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB, CAROL]);
  // Convite da Alice, pendente e recente. Bob é quem aceita.
  await seedInvite(env, CODE, validInvite(ALICE));
});

/** O evento que a Task 7 grava em events/born na mesma transação. */
const bornEvent = () => ({ type: 'partnership_born', occurredAt: serverTimestamp(), xpAwarded: 100 });

/**
 * O aceite inteiro, como a Task 7 faz: cria a parceria, consome o convite e
 * grava events/born no mesmo commit. Desde o acoplamento nos dois sentidos,
 * uma parceria escrita sem o convite (inviteConsumedBy) ou sem o evento
 * (eventAfterIs, Task 4) é negada — então os testes de negação abaixo
 * precisam do aceite completo, senão passariam pelo motivo errado.
 */
function acceptAs(uid: string, path: string, data: Record<string, unknown>, code: string) {
  const db = env.authenticatedContext(uid).firestore();
  const batch = db.batch();
  batch.set(db.doc(path), data);
  batch.update(db.doc(`invites/${code}`), { usedBy: uid, status: 'accepted' });
  batch.set(db.doc(`${path}/events/born`), bornEvent());
  return batch.commit();
}

/** Bob aceitando o convite da Alice, com um campo trocado. */
function bobAccepts(overrides: Record<string, unknown> = {}) {
  const data = validPartnership(ALICE, BOB, CODE, overrides);
  return acceptAs(BOB, `partnerships/${PID}`, data, data.bornFromInvite as string);
}

describe('nascimento — o caminho que deve funcionar', () => {
  it('PERMITE que o convidado crie a parceria com o convite válido', async () => {
    await assertSucceeds(bobAccepts());
  });
});

describe('nascimento — consentimento', () => {
  it('NEGA criar parceria sem apontar para convite nenhum', async () => {
    // Consome o convite real (CODE): atualizar um convite inexistente daria
    // NOT_FOUND, não PERMISSION_DENIED.
    const data = validPartnership(ALICE, BOB, CODE, { bornFromInvite: 'NAOEXISTE' });
    await assertFails(acceptAs(BOB, `partnerships/${PID}`, data, CODE));
  });

  it('NEGA usar convite de terceiro para virar parceiro de quem não convidou', async () => {
    // Convite da Carol, mas Bob tenta virar parceiro da Alice com ele. Nega
    // por mais de um motivo: o batch consome o CODE da Alice, que não é o
    // bornFromInvite. A guarda `inv.fromUid == inviterUid` sozinha é provada
    // em "convite de terceiro no mesmo commit", abaixo.
    await seedInvite(env, 'CAROLCOD', validInvite(CAROL));
    await assertFails(bobAccepts({ bornFromInvite: 'CAROLCOD' }));
  });

  it('NEGA apontar o dono do convite como createdBy sem ele estar em members', async () => {
    // O convite da Carol bate com createdBy: CAROL — só `createdBy in members`
    // impede que ele vire uma parceria Alice–Bob que nenhum dos dois pediu.
    await seedInvite(env, 'CAROLCOD', validInvite(CAROL));
    await assertFails(bobAccepts({ bornFromInvite: 'CAROLCOD', createdBy: CAROL }));
  });

  it('NEGA convite já usado', async () => {
    await seedInvite(env, 'USED1234', validInvite(ALICE, { usedBy: CAROL, status: 'accepted' }));
    await assertFails(bobAccepts({ bornFromInvite: 'USED1234' }));
  });

  // O teste acima troca usedBy e status juntos, então passa por qualquer um
  // dos dois motivos. Os dois abaixo isolam cada guarda.
  it('NEGA convite com usedBy preenchido, mesmo ainda pending', async () => {
    await seedInvite(env, 'USED1234', validInvite(ALICE, { usedBy: CAROL }));
    await assertFails(bobAccepts({ bornFromInvite: 'USED1234' }));
  });

  it('NEGA convite com status accepted, mesmo com usedBy nulo', async () => {
    await seedInvite(env, 'USED1234', validInvite(ALICE, { status: 'accepted' }));
    await assertFails(bobAccepts({ bornFromInvite: 'USED1234' }));
  });

  it('NEGA convite com mais de 7 dias', async () => {
    const old = Timestamp.fromMillis(Date.now() - 8 * 86_400_000);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('invites/OLDCODE1').set({ ...validInvite(ALICE), createdAt: old });
    });
    await assertFails(bobAccepts({ bornFromInvite: 'OLDCODE1' }));
  });

  it('NEGA que o dono do convite crie a parceria sozinho', async () => {
    // Quem nega primeiro é o lado do convite (`auth.uid != fromUid` em
    // invites.update), não `inv.fromUid == inviterUid`.
    const data = validPartnership(ALICE, BOB, CODE, { createdBy: BOB });
    await assertFails(acceptAs(ALICE, `partnerships/${PID}`, data, CODE));
  });

  it('NEGA que o dono do convite se declare createdBy e aceite o próprio convite', async () => {
    // Aqui o convite bate com createdBy, e do lado da parceria só sobram as
    // duas guardas redundantes: `createdBy != auth.uid` (create) e
    // `inv.fromUid != accepterUid` (inviteAuthorizes). Cada uma sozinha
    // basta — e o lado do convite também nega (`auth.uid != fromUid`).
    await assertFails(acceptAs(ALICE, `partnerships/${PID}`, validPartnership(ALICE, BOB, CODE), CODE));
  });

  it('NEGA criar parceria entre duas outras pessoas', async () => {
    await assertFails(acceptAs(CAROL, `partnerships/${PID}`, validPartnership(ALICE, BOB, CODE), CODE));
  });

  it('NEGA parceria consigo mesmo', async () => {
    const data = {
      ...validPartnership(ALICE, BOB, CODE),
      id: `${BOB}_${BOB}`,
      members: [BOB, BOB],
      createdBy: BOB,
    };
    await assertFails(acceptAs(BOB, `partnerships/${BOB}_${BOB}`, data, CODE));
  });
});

describe('nascimento — convite e parceria amarrados nos dois sentidos', () => {
  it('PERMITE o par completo numa transação', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertSucceeds(
      bob.runTransaction(async (tx) => {
        tx.set(bob.doc(`partnerships/${PID}`), validPartnership(ALICE, BOB, CODE));
        tx.update(bob.doc(`invites/${CODE}`), { usedBy: BOB, status: 'accepted' });
        tx.set(bob.doc(`partnerships/${PID}/events/born`), bornEvent());
      }),
    );
  });

  it('NEGA criar a parceria sem consumir o convite no mesmo commit', async () => {
    // Com o evento de nascimento, para que só a falta do convite negue.
    const bob = env.authenticatedContext(BOB).firestore();
    const batch = bob.batch();
    batch.set(bob.doc(`partnerships/${PID}`), validPartnership(ALICE, BOB, CODE));
    batch.set(bob.doc(`partnerships/${PID}/events/born`), bornEvent());
    await assertFails(batch.commit());
  });

  it('NEGA consumir o convite sem a parceria nascer', async () => {
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`invites/${CODE}`).update({ usedBy: BOB, status: 'accepted' }));
  });

  it('NEGA consumir o convite quando a parceria do par aponta para outro código', async () => {
    // A parceria existe (ex.: `ended`, à espera da reativação da Task 4), mas
    // ninguém a está fazendo apontar para este convite. Prova que o lado do
    // convite confere bornFromInvite, não só a existência da parceria.
    await seedPartnership(env, PID, {
      ...validPartnership(ALICE, BOB, 'ANTIGO01'),
      status: 'ended',
      createdAt: new Date(),
      activatedAt: new Date(),
      updatedAt: new Date(),
    });
    const bob = env.authenticatedContext(BOB).firestore();
    await assertFails(bob.doc(`invites/${CODE}`).update({ usedBy: BOB, status: 'accepted' }));
  });

  it('NEGA uma segunda parceria com o mesmo convite, por outra pessoa', async () => {
    // O furo de antes: Bob e depois Carol viravam parceiros da Alice com o
    // mesmo código de uso único. A Carol faz o aceite COMPLETO (parceria +
    // convite no mesmo commit): gravando só a parceria, quem negaria era
    // inviteConsumedBy, e o teste repetiria o "sem consumir o convite". Aqui
    // quem nega é o convite já usado — inviteIsOpen, nas duas regras.
    await assertSucceeds(bobAccepts());
    const carolPid = [ALICE, CAROL].sort().join('_');
    await assertFails(
      acceptAs(CAROL, `partnerships/${carolPid}`, validPartnership(ALICE, CAROL, CODE), CODE),
    );
  });
});

describe('nascimento — convite de terceiro no mesmo commit', () => {
  // O ataque que só `inv.fromUid == inviterUid` (inviteAuthorizes) segura:
  // Bob aceita, de verdade, o convite da Carol (nasce CAROL_BOB) e, no mesmo
  // commit, cria ALICE_BOB apontando para o mesmo código. O lado do convite
  // fica satisfeito com CAROL_BOB e o convite é consumido por Bob — sem a
  // guarda, nasce uma parceria com a Alice sem ela ter convidado ninguém.
  const CAROL_CODE = 'CAROLCOD';
  const CB = [CAROL, BOB].sort().join('_');

  beforeEach(() => seedInvite(env, CAROL_CODE, validInvite(CAROL, { code: CAROL_CODE })));

  type Db = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>;
  type Batch = ReturnType<Db['batch']>;

  /** O aceite legítimo; `extra` acrescenta a parte do ataque no mesmo batch. */
  function bobAcceptsCarol(extra?: (db: Db, batch: Batch) => void) {
    const db = env.authenticatedContext(BOB).firestore();
    const batch = db.batch();
    batch.set(db.doc(`partnerships/${CB}`), validPartnership(CAROL, BOB, CAROL_CODE));
    batch.set(db.doc(`partnerships/${CB}/events/born`), bornEvent());
    batch.update(db.doc(`invites/${CAROL_CODE}`), { usedBy: BOB, status: 'accepted' });
    extra?.(db, batch);
    return batch.commit();
  }

  it('PERMITE o aceite legítimo do convite da Carol (controle)', async () => {
    await assertSucceeds(bobAcceptsCarol());
  });

  it('NEGA nascer ALICE_BOB com o convite da Carol junto do aceite legítimo', async () => {
    await assertFails(
      bobAcceptsCarol((db, batch) => {
        batch.set(db.doc(`partnerships/${PID}`), validPartnership(ALICE, BOB, CAROL_CODE));
        batch.set(db.doc(`partnerships/${PID}/events/born`), bornEvent());
      }),
    );
  });
});

describe('nascimento — memberProfiles é cópia de users/{uid}', () => {
  // ALICE < BOB, então members = [ALICE, BOB]: um teste para cada índice.
  const realProfiles = () =>
    validPartnership(ALICE, BOB, CODE).memberProfiles as Record<string, Record<string, unknown>>;
  const withProfile = (uid: string, patch: Record<string, unknown>) => {
    const profiles = realProfiles();
    return { memberProfiles: { ...profiles, [uid]: { ...profiles[uid], ...patch } } };
  };

  it('NEGA Bob forjar o displayName da Alice', async () => {
    await assertFails(bobAccepts(withProfile(ALICE, { displayName: 'Alice, a chata' })));
  });

  it('NEGA Bob forjar o photoURL da Alice', async () => {
    await assertFails(bobAccepts(withProfile(ALICE, { photoURL: 'https://evil.example/a.jpg' })));
  });

  it('NEGA Bob forjar o avatarEmoji da Alice', async () => {
    await assertFails(bobAccepts(withProfile(ALICE, { avatarEmoji: '💩' })));
  });

  it('NEGA Bob gravar o próprio perfil diferente de users/{bob}', async () => {
    await assertFails(bobAccepts(withProfile(BOB, { displayName: 'Bob Verificado' })));
  });

  it('NEGA campo extra dentro de um perfil', async () => {
    await assertFails(bobAccepts(withProfile(ALICE, { handle: 'alice' })));
  });

  it('NEGA perfil de alguém que não é membro', async () => {
    const profiles = realProfiles();
    await assertFails(bobAccepts({ memberProfiles: { ...profiles, [CAROL]: profiles[ALICE] } }));
  });

  it('NEGA faltar o perfil de um membro', async () => {
    const profiles = realProfiles();
    await assertFails(bobAccepts({ memberProfiles: { [BOB]: profiles[BOB] } }));
  });

  // users.create usa hasOnly, não hasAll: um users doc sem photoURL ou
  // avatarEmoji passa pela regra (createProfile sempre grava os dois, mas a
  // regra não obriga). Chave ausente em users ⇒ ausente ou null no perfil,
  // nunca um valor escolhido por quem aceita.
  describe('quando users/{alice} não tem photoURL nem avatarEmoji', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const { photoURL: _p, avatarEmoji: _a, ...semFoto } = validProfile(ALICE, 'alice');
        await ctx.firestore().doc(`users/${ALICE}`).set(semFoto);
      });
    });

    const aliceProfile = (extra: Record<string, unknown>) => {
      const profiles = realProfiles();
      return { memberProfiles: { ...profiles, [ALICE]: { displayName: profiles[ALICE]!.displayName, ...extra } } };
    };

    it('PERMITE o perfil da Alice sem as chaves ausentes', async () => {
      await assertSucceeds(bobAccepts(aliceProfile({})));
    });

    it('PERMITE as chaves ausentes gravadas como null', async () => {
      await assertSucceeds(bobAccepts(aliceProfile({ photoURL: null, avatarEmoji: null })));
    });

    it('NEGA Bob preencher o avatarEmoji ausente com valor livre', async () => {
      await assertFails(bobAccepts(aliceProfile({ avatarEmoji: '💩' })));
    });

    it('NEGA Bob preencher o photoURL ausente com valor livre', async () => {
      await assertFails(bobAccepts(aliceProfile({ photoURL: 'https://evil.example/a.jpg' })));
    });
  });
});

describe('nascimento — integridade do id', () => {
  it('NEGA id que não corresponde aos membros ordenados', async () => {
    const data = validPartnership(ALICE, BOB, CODE, { id: 'id-inventado' });
    await assertFails(acceptAs(BOB, 'partnerships/id-inventado', data, CODE));
  });

  it('NEGA campo id diferente do id do documento', async () => {
    // O teste acima erra o caminho e o campo juntos — cai em pidMatches antes.
    // Aqui o caminho está certo e só o campo mente.
    await assertFails(bobAccepts({ id: 'id-inventado' }));
  });

  it('NEGA members fora de ordem — senão o mesmo par teria dois documentos', async () => {
    const reversed = [ALICE, BOB].sort().reverse();
    await assertFails(bobAccepts({ members: reversed }));
  });

  it('NEGA o par invertido mesmo com id coerente com a ordem invertida', async () => {
    // O teste acima mantém o caminho em PID e cai em `pid == members[0]_members[1]`.
    // Aqui caminho, id e members concordam entre si na ordem errada — só
    // `members[0] < members[1]` impede o segundo documento do mesmo par.
    const reversed = [ALICE, BOB].sort().reverse();
    const reversedId = reversed.join('_');
    const data = validPartnership(ALICE, BOB, CODE, { id: reversedId, members: reversed });
    await assertFails(acceptAs(BOB, `partnerships/${reversedId}`, data, CODE));
  });

  it('NEGA members com três pessoas', async () => {
    await assertFails(bobAccepts({ members: [ALICE, BOB, CAROL].sort() }));
  });
});

describe('nascimento — cada número é literal na regra', () => {
  const forjas: Array<[string, Record<string, unknown>]> = [
    ['xparceria', { xparceria: 999_999 }],
    ['level', { level: 42 }],
    ['xpIntoLevel', { xpIntoLevel: 121 }],
    ['xpForNextLevel', { xpForNextLevel: 1 }],
    ['temperature', { temperature: 100 }],
    ['temperatureBand', { temperatureBand: 'burning' }],
    ['status', { status: 'hibernating' }],
    ['achievements', { achievements: ['o-comeco', 'lenda'] }],
    ['superPartnershipId', { superPartnershipId: 'super-1' }],
    ['streak', { streak: { current: 99, longest: 99, lastDay: '2026-08-06', freezesLeft: 9 } }],
    ['stats.encounterCount', {
      stats: {
        encounterCount: 50, totalMinutesTogether: 9999, lastEncounterAt: null,
        daysSinceLastEncounter: 0, firstEncounterAt: null,
        longestEncounterMinutes: 0, maxDistanceKm: 0, placesVisited: 0,
      },
    }],
  ];

  it.each(forjas)('NEGA forjar %s no nascimento', async (_campo, override) => {
    await assertFails(bobAccepts(override));
  });

  it('NEGA createdAt escolhido pelo cliente', async () => {
    await assertFails(bobAccepts({ createdAt: Timestamp.fromMillis(0) }));
  });

  it('NEGA activatedAt escolhido pelo cliente', async () => {
    await assertFails(bobAccepts({ activatedAt: Timestamp.fromMillis(0) }));
  });

  // A spec (§3.2) lista updatedAt: request.time entre os literais do
  // nascimento; o brief não o fixava.
  it('NEGA updatedAt escolhido pelo cliente', async () => {
    await assertFails(bobAccepts({ updatedAt: Timestamp.fromMillis(0) }));
  });

  it('NEGA campo fora do shape de PartnershipDoc', async () => {
    // Um campo livre aqui seria um número que o cliente escolheu — e a Spec 4
    // pode vir a ler qualquer coisa que esteja no documento.
    await assertFails(bobAccepts({ xparceriaBonus: 500 }));
  });
});
