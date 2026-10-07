import type { AuthStore } from '@/types';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useAuthStore = create<AuthStore>()(
    devtools(
        (set) => ({
            status: 'idle',
            isBootstrapped: false,
            user: null,
            error: null,
            setLoading: () => set({
                status: 'loading',
                error: null,
            }, false, 'setLoading'),
            setUser: (user) => set({
                status: 'ready',
                isBootstrapped: true,
                user,
                error: null,
            }, false, 'setUser'),
            setError: (message) => set({
                status: 'error',
                isBootstrapped: true,
                error: message
            }, false, 'setError'),
            clearAuth: () => set({
                status: "ready",
                isBootstrapped: true,
                user: null,
                error: null,
            }, false, 'clearAuth')
        }),
        { name: 'AuthStore' }
    )
);
