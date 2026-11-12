// Em Node (testes contra o emulador) o expo-crypto nativo não carrega. Este
// shim entrega o mesmo CSPRNG via node:crypto; só o que shared/invite.ts usa.
import { randomBytes } from 'node:crypto';

export function getRandomBytes(size: number): Uint8Array {
  return new Uint8Array(randomBytes(size));
}
