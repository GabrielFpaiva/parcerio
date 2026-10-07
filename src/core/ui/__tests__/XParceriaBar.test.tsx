import { render, screen } from '@testing-library/react-native';
import { XParceriaBar } from '../XParceriaBar';

describe('XParceriaBar', () => {
  it('mostra progresso contra o custo do nível atual', async () => {
    // nível 18 exige 496 para o próximo (ver shared/level.ts)
    await render(<XParceriaBar level={18} xpIntoLevel={420} />);
    expect(screen.getByText('420 / 496 XParceria')).toBeTruthy();
  });

  it('nunca escreve a palavra "XP" sozinha na interface', async () => {
    await render(<XParceriaBar level={3} xpIntoLevel={10} />);
    expect(screen.queryByText(/\bXP\b/)).toBeNull();
  });

  it('expõe o progresso para leitores de tela', async () => {
    await render(<XParceriaBar level={18} xpIntoLevel={420} />);
    const bar = screen.getByLabelText('Progresso de XParceria');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 496, now: 420 });
  });

  it('aceita preenchimento animado e esconde o texto sem mudar a semântica', async () => {
    const { Animated } = require('react-native');
    await render(
      <XParceriaBar
        level={1}
        xpIntoLevel={100}
        FillComponent={Animated.View}
        fillStyle={{ transform: [{ scaleX: 0.5 }] }}
        hideLabel
      />,
    );
    expect(screen.queryByText(/XParceria$/)).toBeNull();
    const bar = screen.getByLabelText('Progresso de XParceria');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 122, now: 100 });
  });
});
