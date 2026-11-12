import { fireEvent, render, screen } from '@testing-library/react-native';
import { EnterCodeScreen } from '../EnterCodeScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const field = () => screen.getByLabelText('Código do convite');

beforeEach(() => mockPush.mockReset());

describe('EnterCodeScreen', () => {
  it('normaliza enquanto digita', async () => {
    await render(<EnterCodeScreen />);
    await fireEvent.changeText(field(), 'ab3d-4f7h');
    expect(field().props.value).toBe('AB3D4F7H');
  });

  it('corrige os caracteres que o alfabeto exclui', async () => {
    await render(<EnterCodeScreen />);
    await fireEvent.changeText(field(), 'IL0O');
    expect(field().props.value).toBe('1100');
  });

  it('só habilita o botão com 8 caracteres', async () => {
    await render(<EnterCodeScreen />);
    await fireEvent.changeText(field(), 'AB3D4F7');
    expect(screen.getByLabelText('Continuar').props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(field(), 'AB3D4F7H');
    expect(screen.getByLabelText('Continuar').props.accessibilityState.disabled).toBe(false);
  });

  it('navega para o convite ao enviar', async () => {
    await render(<EnterCodeScreen />);
    await fireEvent.changeText(field(), 'ab3d-4f7h');
    await fireEvent.press(screen.getByLabelText('Continuar'));
    expect(mockPush).toHaveBeenCalledWith('/invite/AB3D4F7H');
  });

  it('não enviar com código incompleto', async () => {
    await render(<EnterCodeScreen />);
    await fireEvent.changeText(field(), 'AB3');
    await fireEvent.press(screen.getByLabelText('Continuar'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('desliga a correção automática do teclado', async () => {
    await render(<EnterCodeScreen />);
    expect(field().props.autoCapitalize).toBe('characters');
    expect(field().props.autoCorrect).toBe(false);
  });
});
