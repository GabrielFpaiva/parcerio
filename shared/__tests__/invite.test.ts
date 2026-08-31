import {
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_TTL_MS,
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
  const NOW = 1_754_000_000_000;
  // Não existe campo `expiresAt`: o vencimento é derivado de createdAt + 7d.
  // O cliente não consegue prever `request.time`, então um expiresAt gravado
  // seria impossível de fixar por regra — e um convite eterno é o abuso óbvio.
  const base = {
    fromUid: 'bob-uid',
    usedBy: null,
    status: 'pending' as const,
    createdAtMs: NOW - 1000,
  };

  it('aceita convite válido de outra pessoa', () => {
    expect(checkInvite(base, 'alice-uid', NOW)).toBeNull();
  });

  it('aceita no último instante antes dos 7 dias', () => {
    expect(checkInvite({ ...base, createdAtMs: NOW - INVITE_TTL_MS + 1 }, 'alice-uid', NOW)).toBeNull();
  });

  it('recusa exatamente aos 7 dias', () => {
    expect(checkInvite({ ...base, createdAtMs: NOW - INVITE_TTL_MS }, 'alice-uid', NOW)).toBe('expired');
  });

  it('recusa convite já usado', () => {
    expect(checkInvite({ ...base, usedBy: 'carol-uid', status: 'accepted' }, 'alice-uid', NOW)).toBe('used');
  });

  it('recusa quem tenta aceitar o próprio convite', () => {
    expect(checkInvite(base, 'bob-uid', NOW)).toBe('self');
  });

  it('checa o auto-convite antes da expiração — a mensagem certa importa mais', () => {
    expect(checkInvite({ ...base, createdAtMs: NOW - INVITE_TTL_MS }, 'bob-uid', NOW)).toBe('self');
  });
});
