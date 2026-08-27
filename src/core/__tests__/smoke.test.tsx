import { render, screen } from '@testing-library/react-native';
import MapPlaceholder from '../../../app/(app)/index';

describe('scaffold', () => {
  it('renderiza a rota placeholder', async () => {
    await render(<MapPlaceholder />);
    expect(screen.getByText('Parcerio')).toBeTruthy();
  });
});
