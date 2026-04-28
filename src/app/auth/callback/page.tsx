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

    // Клиент Supabase автоматически парсит URL (параметры ?code= или #access_token=)
    // Нам нужно просто проверить, появилась ли сессия
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        if (mounted) setErrorMsg(error.message);
        return;
      }
      if (session && mounted) {
        router.push('/');
      }
    };

    checkSession();

    // Слушатель на случай, если парсинг URL займет время
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || session) && mounted) {
        router.push('/');
      }
    });

    // Предохранитель от бесконечной загрузки
    const timer = setTimeout(() => {
      if (mounted) {
        setErrorMsg("Не удалось войти. Убедитесь, что ключи Vercel настроены верно, и попробуйте запросить ссылку заново.");
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 border border-gray-200 rounded-2xl shadow-sm flex flex-col items-center gap-4 text-center w-full max-w-sm">
        {errorMsg ? (
          <>
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-2">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Сбой авторизации</h2>
            <p className="text-sm text-gray-500">{errorMsg}</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors"
            >
              Вернуться на главную
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-terra-500 animate-spin mb-2" />
            <h2 className="text-lg font-semibold text-gray-900">Вход в систему...</h2>
            <p className="text-sm text-gray-500">Автоматическая авторизация</p>
          </>
        )}
      </div>
    </div>
  );
}