import { firestoreErrorMessage } from '../firestoreError';

describe('firestoreErrorMessage', () => {
  it('traduz permissão negada sem vazar o código', () => {
    const msg = firestoreErrorMessage({ code: 'permission-denied' });
    expect(msg).toBe('Você não tem acesso a isso.');
    expect(msg).not.toContain('permission');
  });

  it('traduz indisponibilidade como problema de conexão', () => {
    expect(firestoreErrorMessage({ code: 'unavailable' })).toBe('Sem conexão. Tenta de novo.');
  });

  it('cai numa mensagem genérica para código desconhecido', () => {
    expect(firestoreErrorMessage({ code: 'aborted' })).toBe('Algo deu errado. Tenta de novo.');
  });

  it('aguenta erro que não é do Firestore', () => {
    expect(firestoreErrorMessage(new Error('boom'))).toBe('Algo deu errado. Tenta de novo.');
  });
});
