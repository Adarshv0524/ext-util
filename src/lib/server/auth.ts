import { env } from '$env/dynamic/private';
import { Google } from 'arctic';

// Initialize Arctic Google OAuth provider
// This will throw if these are not set in .dev.vars / Cloudflare Environment
export const google = new Google(
    env.GOOGLE_CLIENT_ID || '',
    env.GOOGLE_CLIENT_SECRET || '',
    (env.APP_URL || 'http://localhost:5173') + '/login/google/callback'
);

export type User = {
    id: string;
    google_id: string;
    email: string;
    name: string | null;
    picture: string | null;
    role: 'USER' | 'ADMIN';
    status: 'PENDING' | 'APPROVED' | 'BANNED';
    created_at: string;
};

export type Session = {
    id: string;
    user_id: string;
    expires_at: Date;
};

export function generateId(length = 15): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    let id = '';
    for (let i = 0; i < length; i++) {
        id += chars[values[i] % chars.length];
    }
    return id;
}
