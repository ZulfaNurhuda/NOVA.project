import { nanoid } from 'nanoid';
import { argon2id } from '@noble/hashes/argon2.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';

export const generateEncryptionKey = (password?: string): string => {
    if (password && password.length > 0) {
        return password;
    }
    return nanoid(32);
};

export const generateSalt = (): string => {
    return nanoid(32);
};

// Argon2id (m=65540 KB, t=3, p=4) → 32-byte key
function getDerivedKey(userKeyString: string, salt: string): Uint8Array {
    return argon2id(
        new TextEncoder().encode(userKeyString),
        new TextEncoder().encode(salt),
        { m: 65540, t: 3, p: 4, dkLen: 32 }
    );
}

// Format: [nonce(12) || ciphertext+tag] as Uint8Array
export const encrypt = async (
    text: string,
    userEncryptionKey: string,
    salt: string
): Promise<Uint8Array> => {
    const key = getDerivedKey(userEncryptionKey, salt);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const cipher = chacha20poly1305(key, nonce);
    const ciphertext = cipher.encrypt(new TextEncoder().encode(text));
    const out = new Uint8Array(12 + ciphertext.length);
    out.set(nonce);
    out.set(ciphertext, 12);
    return out;
};

export const encryptFile = async (
    fileBuffer: ArrayBuffer,
    userEncryptionKey: string,
    salt: string
): Promise<Uint8Array> => {
    const key = getDerivedKey(userEncryptionKey, salt);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const cipher = chacha20poly1305(key, nonce);
    const ciphertext = cipher.encrypt(new Uint8Array(fileBuffer));
    const out = new Uint8Array(12 + ciphertext.length);
    out.set(nonce);
    out.set(ciphertext, 12);
    return out;
};

export const decrypt = async (
    fullMessage: Uint8Array,
    userEncryptionKey: string,
    salt: string
): Promise<string> => {
    const key = getDerivedKey(userEncryptionKey, salt);
    const nonce = fullMessage.slice(0, 12);
    const ciphertext = fullMessage.slice(12);
    try {
        const cipher = chacha20poly1305(key, nonce);
        const plaintext = cipher.decrypt(ciphertext);
        return new TextDecoder().decode(plaintext);
    } catch (e) {
        throw new Error('Could not decrypt message. The key may be wrong or the data corrupted.');
    }
};

export const decryptFile = async (
    fullMessage: Uint8Array,
    userEncryptionKey: string,
    salt: string
): Promise<Uint8Array> => {
    const key = getDerivedKey(userEncryptionKey, salt);
    const nonce = fullMessage.slice(0, 12);
    const ciphertext = fullMessage.slice(12);
    try {
        const cipher = chacha20poly1305(key, nonce);
        return cipher.decrypt(ciphertext);
    } catch (e) {
        throw new Error('Could not decrypt message. The key may be wrong or the data corrupted.');
    }
};
