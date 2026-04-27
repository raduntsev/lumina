'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Слушаем изменение состояния: как только токен из URL применится и мы войдем — кидаем на главную
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-milk flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-1.5 h-1.5 bg-terra/40 animate-ping rounded-full" />
        <span className="text-[10px] uppercase tracking-[0.3em] opacity-40">
          Синхронизация ключей...
        </span>
      </div>
    </div>
  );
}