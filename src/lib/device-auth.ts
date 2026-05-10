// Device JWT auth helpers.
// Each device gets a unique secret on claim. The player signs every request:
//   Authorization: Bearer <jwt>
// Payload: { sub: deviceId, iat, exp }

import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';

export async function signDeviceToken(deviceId: string, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ sub: deviceId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(key);
}

export async function verifyDeviceToken(
  token: string,
  secret: string,
): Promise<{ deviceId: string } | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: [ALG] });
    if (!payload.sub) return null;
    return { deviceId: payload.sub };
  } catch {
    return null;
  }
}
