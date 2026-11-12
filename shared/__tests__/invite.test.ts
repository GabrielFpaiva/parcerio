import {
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  checkInvite,
  generateInviteCode,
  normalizeInviteCode,
} from '../invite';

describe('INVITE_ALPHABET', () => {
  it('tem 32 caracteres e nenhum ambíguo — o código é digitado à mão', () => {
    expect(INVITE_ALPHABET).toHaveLength(32);
    for (const c of 'ILOU') expect(INVITE_ALPHABET).not.toContain(c);
  });

  it('não repete caractere', () => {
    expect(new Set(INVITE_ALPHABET).size).toBe(32);
  });
});

describe('generateInviteCode', () => {
  it('tem o comprimento definido e só usa o alfabeto', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    for (const c of code) expect(INVITE_ALPHABET).toContain(c);
  });

  it('mapeia o gerador aleatório para o alfabeto inteiro', () => {
    expect(generateInviteCode(() => 0)).toBe('0'.repeat(INVITE_CODE_LENGTH));
    expect(generateInviteCode(() => 0.9999)).toBe('Z'.repeat(INVITE_CODE_LENGTH));
  });

  it('com a fonte padrão (CSPRNG), gera códigos do alfabeto, no tamanho certo, e diferentes a cada chamada', () => {
    // Não dá para testar "é imprevisível" — só o contrato: alfabeto certo,
    // tamanho certo, e que duas chamadas seguidas não caem no mesmo código.
    const a = generateInviteCode();
    const b = generateInviteCode();
    for (const code of [a, b]) {
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      for (const c of code) expect(INVITE_ALPHABET).toContain(c);
    }
    expect(a).not.toBe(b);
  });

  it('não repete em 500 gerações', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateInviteCode()));
    expect(codes.size).toBe(500);
  });
});

describe('normalizeInviteCode', () => {
  it('sobe para maiúsculas e remove espaço e hífen', () => {
    expect(normalizeInviteCode(' ab3d-4f7h ')).toBe('AB3D4F7H');
  });

  it('corrige os caracteres que o alfabeto exclui, em vez de recusar', () => {
    // Quem lê o código em voz alta erra I/1 e O/0. Recusar seria hostil.
    expect(normalizeInviteCode('IL0O')).toBe('1100');
    expect(normalizeInviteCode('u')).toBe('V');
  });
});

describe('checkInvite', () => {
  // Vencimento não é decidido aqui: o relógio do aparelho não é confiável.
  // Quem decide é a regra (request.time), e o aceite traduz a negação.
  const base = { fromUid: 'bob-uid', usedBy: null, status: 'pending' as const };

  it('aceita convite válido de outra pessoa', () => {
    expect(checkInvite(base, 'alice-uid')).toBeNull();
  });

  it('recusa convite já usado', () => {
    expect(checkInvite({ ...base, usedBy: 'carol-uid', status: 'accepted' }, 'alice-uid')).toBe('used');
  });

  it('recusa quem tenta aceitar o próprio convite', () => {
    expect(checkInvite(base, 'bob-uid')).toBe('self');
  });

  it('checa o auto-convite antes do uso — a mensagem certa importa mais', () => {
    expect(checkInvite({ ...base, usedBy: 'carol-uid', status: 'accepted' }, 'bob-uid')).toBe('self');
  });
});
