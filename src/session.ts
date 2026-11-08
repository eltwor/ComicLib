import { createHmac, timingSafeEqual } from "node:crypto";

export const signSession = (secret: string, expiresAt: number) : string => {
    const signature = createHmac("sha256", secret).update(String(expiresAt)).digest("base64url");
    return `${expiresAt}.${signature}`
}

export const isValidSession = (token: string | undefined, secret: string, now: number) : boolean => {
    if (!token) return false;
    const [exp,sig] = token?.split(".");
    if (!exp || !sig) return false;
    const expiresAt = Number(exp)
    if (!Number.isFinite(expiresAt)) return false;
    const expected = createHmac("sha256", secret).update(exp).digest("base64url");
    const a = Buffer.from(sig);
const b = Buffer.from(expected);
if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    return expiresAt > now;
}

export const readCookie = (header: string | undefined, name: string) : string | undefined => {
    if (!header) return undefined;
    for (const part of header.split(";")) {
        const [k, ...rest] = part.trim().split("=");
        if (k===name) return rest.join("=");
    }
return undefined;    
}