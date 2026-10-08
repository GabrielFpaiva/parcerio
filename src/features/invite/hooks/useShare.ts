import { useCallback, useState } from 'react';
import { SHARE_FAILED_MESSAGE, shareText } from '../inviteShare';

/** Compartilha e guarda a falha do Share para a tela mostrar. */
export function useShare() {
  const [failed, setFailed] = useState(false);
  const share = useCallback(async (message: string) => {
    setFailed(false);
    setFailed(!(await shareText(message)));
  }, []);
  return { share, error: failed ? SHARE_FAILED_MESSAGE : null };
}
