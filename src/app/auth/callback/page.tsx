'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

export default function AuthCallback() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1. Сначала проверяем URL: не "съел" ли токен какой-нибудь бот мессенджера
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.includes('error=')) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const errorDescription = hashParams.get('error_description');
        if (errorDescription) {
          setErrorMsg(decodeURIComponent(errorDescription).replace(/\+/g, ' '));
          return; // Останавливаем выполнение, так как уже есть ошибка
        }
      }
    }

    // 2. Стандартная проверка сессии
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error && mounted) {
        setErrorMsg(error.message);
        return;
      }
      if (session && mounted) {
        router.push('/');
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || session) && mounted) {
        router.push('/');
      }
    });

    const timer = setTimeout(() => {
      if (mounted && !errorMsg) {
        setErrorMsg("Время ожидания истекло. Пожалуйста, убедитесь, что вы перешли по ссылке из почты, а не из мессенджера.");
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [router, errorMsg]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 border border-gray-200 rounded-2xl shadow-sm flex flex-col items-center gap-4 text-center w-full max-w-sm">
        {errorMsg ? (
          <>
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-2">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Сбой авторизации</h2>
            <p className="text-sm text-gray-500">
              {errorMsg === 'Email link is invalid or has expired' 
                ? 'Эта ссылка уже была использована (возможно, предпросмотром мессенджера). Запросите новую и откройте её напрямую из почты.' 
                : errorMsg}
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors"
            >
              На главную
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-terra-500 animate-spin mb-2" />
            <h2 className="text-lg font-semibold text-gray-900">Вход в систему...</h2>
            <p className="text-sm text-gray-500">Синхронизируем ключи доступа</p>
          </>
        )}
      </div>
    </div>
  );
}