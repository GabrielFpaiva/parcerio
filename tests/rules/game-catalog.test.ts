import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, serverTimestamp } from 'firebase/firestore';
import { ALICE, BOB, createTestEnv } from './helpers';
import { seedUsers } from './factories';

let env: RulesTestEnvironment;

beforeAll(async () => { env = await createTestEnv(); });
afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seedUsers(env, [ALICE, BOB]);
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc('gameQuestions/q0').set({
      text: 'Quem é mais provável de ter um pirrai?',
      emoji: '👶',
      order: 0,
    });
  });
});

const sugestao = (overrides: Record<string, unknown> = {}) => ({
  text: 'Quem é mais provável de dormir no cinema?',
  suggestedBy: ALICE,
  suggestedAt: serverTimestamp(),
  ...overrides,
});

describe('gameQuestions', () => {
  it('PERMITE que qualquer autenticado leia o catálogo', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(alice.doc('gameQuestions/q0').get());
  });

  it('NEGA leitura anônima', async () => {
    await assertFails(env.unauthenticatedContext().firestore().doc('gameQuestions/q0').get());
  });

  it('NEGA que o cliente crie pergunta', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('gameQuestions/q999').set({ text: 'x', emoji: '🙂', order: 999 }));
  });

  it('NEGA que o cliente reescreva o texto de uma pergunta', async () => {
    // Se isto passasse, qualquer um trocaria a pergunta do dia do app inteiro.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('gameQuestions/q0').update({ text: 'outra coisa' }));
  });

  it('NEGA que o cliente apague uma pergunta', async () => {
    // Apagar abre buraco no `order` e deixa um dia sem pergunta.
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('gameQuestions/q0').delete());
  });
});

describe('questionSuggestions', () => {
  it('PERMITE sugerir uma pergunta', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertSucceeds(alice.doc('questionSuggestions/s1').set(sugestao()));
  });

  it('NEGA sugerir em nome de outra pessoa', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('questionSuggestions/s1').set(sugestao({ suggestedBy: BOB })));
  });

  it('NEGA ler a fila, mesmo a própria sugestão', async () => {
    // A fila é só de entrada. Ler daria um canal de mensagem entre usuários
    // sem nenhuma moderação, que é exatamente o que o produto não quer ter.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('questionSuggestions/s1').set({
        text: 'Quem é mais provável de dormir no cinema?',
        suggestedBy: ALICE,
        suggestedAt: new Date(),
      });
    });
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('questionSuggestions/s1').get());
  });

  it('NEGA suggestedAt escolhido pelo cliente', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    const futuro = Timestamp.fromMillis(Date.now() + 86_400_000);
    await assertFails(alice.doc('questionSuggestions/s1').set(sugestao({ suggestedAt: futuro })));
  });

  it('NEGA texto curto demais para ser pergunta', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('questionSuggestions/s1').set(sugestao({ text: 'oi' })));
  });

  it('NEGA texto longo demais', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await assertFails(alice.doc('questionSuggestions/s1').set(sugestao({ text: 'a'.repeat(141) })));
  });

  it('NEGA editar a própria sugestão depois de enviada', async () => {
    const alice = env.authenticatedContext(ALICE).firestore();
    await alice.doc('questionSuggestions/s1').set(sugestao());
    await assertFails(alice.doc('questionSuggestions/s1').update({ text: 'trocando o texto todo' }));
  });
});
