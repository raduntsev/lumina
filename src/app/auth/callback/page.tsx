'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1. Защита от ботов: проверяем URL на наличие ошибки
    if (typeof window !== 'undefined' && window.location.hash.includes('error=')) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const desc = params.get('error_description');
      if (desc && mounted) {
        // Если ссылка протухла, показываем текст, а не крутим загрузку
        setError(decodeURIComponent(desc).replace(/\+/g, ' '));
        return;
      }
    }

    // 2. Если мы уже вошли, сразу кидаем на главную
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mounted) {
        router.push('/');
      }
    });

    // 3. Слушаем момент применения токена
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && mounted) {
        router.push('/');
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-milk flex items-center justify-center p-6 text-center">
      {error ? (
        <div className="flex flex-col items-center gap-6 max-w-xs">
          <div className="text-red-600/80 text-sm font-medium">
            Эта ссылка устарела или уже была использована.<br />Пожалуйста, запросите новую.
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-xs uppercase tracking-wider hover:bg-black transition-colors"
          >
            Вернуться
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="w-1.5 h-1.5 bg-terra/40 animate-ping rounded-full" />
          <span className="text-[10px] uppercase tracking-[0.3em] opacity-40">
            Синхронизация ключей...
          </span>
        </div>
      )}
    </div>
  );
}