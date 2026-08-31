import { evitarViradaDeDia, msAteViradaDeSaoPaulo } from './helpers';
import { MS_PER_DAY, SP_UTC_OFFSET_MS } from '../../shared/dailyGame';

// Finding 6 da revisão de 2026-08-31: hoje()/hojeNum() nos testes de rodada
// leem Date.now() no processo do teste; a regra lê request.time no instante
// da escrita. Perto da virada de São Paulo (03:00 UTC) os dois podem cair
// em dias diferentes — a suíte fica verde ou vermelha por sorte. Este
// arquivo prende só a lógica pura de "estamos perto da virada?", com
// relógio e sleep injetáveis — sem isso, testar a janela de verdade exigiria
// esperar a virada acontecer.
describe('msAteViradaDeSaoPaulo', () => {
  it('é MS_PER_DAY exatamente na virada', () => {
    const naVirada = SP_UTC_OFFSET_MS;
    expect(msAteViradaDeSaoPaulo(naVirada)).toBe(MS_PER_DAY);
  });

  it('é pequeno faltando pouco para a virada', () => {
    const quaseVirada = SP_UTC_OFFSET_MS + MS_PER_DAY - 1_000;
    expect(msAteViradaDeSaoPaulo(quaseVirada)).toBe(1_000);
  });

  it('é a metade do dia no meio do dia', () => {
    const meioDoDia = SP_UTC_OFFSET_MS + MS_PER_DAY / 2;
    expect(msAteViradaDeSaoPaulo(meioDoDia)).toBe(MS_PER_DAY / 2);
  });
});

describe('evitarViradaDeDia', () => {
  it('NÃO dorme quando a virada está longe', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const longeDaVirada = SP_UTC_OFFSET_MS + MS_PER_DAY / 2;
    await evitarViradaDeDia(() => longeDaVirada, sleep);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('dorme até passar da virada quando ela está perto', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const pertoDaVirada = SP_UTC_OFFSET_MS + MS_PER_DAY - 3_000;
    await evitarViradaDeDia(() => pertoDaVirada, sleep);
    expect(sleep).toHaveBeenCalledTimes(1);
    // Dorme o que falta (3000ms) mais uma folga, nunca menos que o que falta.
    const dormidoMs = sleep.mock.calls[0]![0] as number;
    expect(dormidoMs).toBeGreaterThan(3_000);
  });
});
