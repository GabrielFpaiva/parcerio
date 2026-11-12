import Root from '../../../app/(app)/index';
import { PartnershipListScreen } from '@/features/partnership/PartnershipListScreen';

// A tela é testada por si; aqui só se garante que a raiz do app é a lista.
jest.mock('@/features/partnership/PartnershipListScreen', () => ({
  PartnershipListScreen: () => null,
}));

describe('scaffold', () => {
  it('a raiz do app é a lista de parcerias', () => {
    expect(Root).toBe(PartnershipListScreen);
  });
});
