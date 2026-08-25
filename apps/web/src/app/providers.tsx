'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  useEffect(() => {
    const finish = () => useAuthStore.setState({ _hasHydrated: true });
    const persistApi = useAuthStore.persist;
    if (!persistApi?.rehydrate) {
      finish();
      return;
    }
    try {
      const unsub = persistApi.onFinishHydration?.(finish);
      Promise.resolve(persistApi.rehydrate()).finally(finish);
      return typeof unsub === 'function' ? unsub : undefined;
    } catch {
      finish();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </QueryClientProvider>
  );
}
