'use client';

import { useState, useEffect } from 'react';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { DailyPulse } from '@/components/DailyPulse'; 
import { ArrowRight, Loader2, Heart, Plus, Link as LinkIcon, LogOut } from 'lucide-react';
import supabase from '@/lib/supabase';

export default function Home() {
  const { 
    isAuthenticated, hasSpace, isLoading, profile, 
    user, spaceId, 
    sendMagicLink, createSpace, joinSpace, signOut 
  } = useSpaceAuth();

  const [email, setEmail] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [authStep, setAuthStep] = useState<'email' | 'sent'>('email');

  const [realBalance, setRealBalance] = useState<number>(0);

  useEffect(() => {
    if (!hasSpace || !user?.id || !spaceId) return;

    const fetchBalance = async () => {
      const { data, error } = await supabase.rpc('get_real_balance', { 
        usr_id: user.id, 
        spc_id: spaceId 
      });
      if (!error && data !== null) {
        setRealBalance(data);
      }
    };

    fetchBalance();

    const channel = supabase.channel('header_balance_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items', filter: `space_id=eq.${spaceId}` }, () => {
        fetchBalance();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_purchases', filter: `space_id=eq.${spaceId}` }, () => {
        fetchBalance();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hasSpace, user, spaceId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 text-sm font-medium text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        Загрузка пространства...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 border border-gray-200 rounded-2xl shadow-sm text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-terra-50 border border-terra-100 rounded-2xl flex items-center justify-center">
              <Heart className="w-8 h-8 text-terra-500" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2 tracking-tight">Lumina Pulse</h1>
          <p className="text-sm font-medium text-gray-500 mb-8">Синхронизация ваших состояний</p>
          
          {authStep === 'email' ? (
            <div className="space-y-4">
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Ваш email"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 transition-shadow text-gray-900 placeholder:text-gray-400 text-center"
              />
              <button 
                onClick={() => { sendMagicLink(email); setAuthStep('sent'); }}
                disabled={!email}
                className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              >
                Войти по ссылке <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-green-50 text-green-800 p-5 rounded-xl border border-green-100 text-sm font-medium">
              Ссылка отправлена! Проверьте вашу почту (и папку Спам).
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!hasSpace) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 gap-8">
        
        {/* Создать пространство */}
        <div className="w-full max-w-md bg-white p-8 border border-gray-200 rounded-2xl shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Создать пространство</h2>
          <p className="text-sm font-medium text-gray-500 mb-6 leading-relaxed">Начните новую историю и пригласите партнера по уникальному коду.</p>
          <button 
            onClick={() => createSpace()}
            className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus className="w-5 h-5" /> Создать новое
          </button>
        </div>

        <div className="flex items-center gap-4 w-full max-w-md opacity-40">
          <div className="flex-grow h-px bg-gray-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Или</span>
          <div className="flex-grow h-px bg-gray-400" />
        </div>

        {/* Присоединиться */}
        <div className="w-full max-w-md bg-white p-8 border border-gray-200 rounded-2xl shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Присоединиться</h2>
          <p className="text-sm font-medium text-gray-500 mb-6 leading-relaxed">Введите код, который вам отправил партнер.</p>
          <div className="flex gap-3">
            <input 
              type="text" 
              value={inviteCodeInput}
              onChange={e => setInviteCodeInput(e.target.value)}
              placeholder="Код приглашения"
              className="flex-grow bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 transition-shadow text-gray-900 placeholder:text-gray-400"
            />
            <button 
              onClick={() => joinSpace(inviteCodeInput)}
              disabled={!inviteCodeInput.trim()}
              className="py-3 px-6 bg-terra-500 text-white text-sm font-medium rounded-xl hover:bg-terra-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <button onClick={signOut} className="text-sm font-medium text-gray-400 hover:text-gray-900 transition-colors mt-4">
          Выйти из аккаунта
        </button>
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col h-full overflow-hidden">
      
      {/* Шапка приветствия */}
      <section className="p-6 sm:p-8 border-b border-gray-100 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shrink-0 z-10 relative">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
            Привет, {profile?.display_name || 'Странник'}
          </h1>
          <p className="text-sm font-medium text-gray-500 capitalize">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
           {/* Виджет баланса */}
           <div className="bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 flex flex-col items-start sm:items-end flex-grow sm:flex-grow-0">
              <span className="text-xs font-medium text-gray-400 mb-0.5">Ваш баланс</span>
              <div className="text-xl font-semibold text-terra-600 leading-none">
                {realBalance} <span className="text-sm text-terra-500/70 font-medium">баллов</span>
              </div>
           </div>

           <div className="hidden sm:block w-px h-10 bg-gray-200" />
           
           {/* Кнопка выхода */}
           <button 
             onClick={signOut} 
             title="Выйти"
             className="text-gray-400 hover:text-gray-900 p-3 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
           >
              <LogOut className="w-5 h-5" />
           </button>
        </div>
      </section>

      {/* Основной компонент календаря */}
      <DailyPulse />
      
    </div>
  );
}