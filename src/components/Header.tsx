'use client';

import React, { useState, useEffect } from 'react';
import { StoreModal } from './StoreModal';
import { LettersModal } from './LettersModal';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { SettingsModal } from './SettingsModal';
import { GuideModal } from './GuideModal'; // <-- НОВОЕ
import { Store, Mail, LogOut, Settings, BookHeart } from 'lucide-react';

export function Header() {
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Проверка на первый вход
  useEffect(() => {
    // Ждем секунду после загрузки, чтобы UI успел отрисоваться
    const timer = setTimeout(() => {
      const hasSeenGuide = localStorage.getItem('lumina_guide_seen');
      if (!hasSeenGuide) {
        setIsGuideOpen(true);
        localStorage.setItem('lumina_guide_seen', 'true');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, []);
  const [isLettersOpen, setIsLettersOpen] = useState(false);
  const { spaceId, user, profile, signOut } = useSpaceAuth();
  
  const [unreadLettersCount, setUnreadLettersCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [realBalance, setRealBalance] = useState<number>(0);

  useEffect(() => {
    if (!spaceId || !user?.id) return;

    const fetchUnreadLetters = async () => {
      const { count } = await supabase
        .from('letters')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId)
        .neq('sender_id', user.id)
        .eq('is_read', false);
      setUnreadLettersCount(count || 0);
    };

    const fetchPendingOrders = async () => {
      const { count } = await supabase
        .from('shop_purchases')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId)
        .eq('seller_id', user.id)
        .eq('is_fulfilled', false);
      setPendingOrdersCount(count || 0);
    };

    const fetchBalance = async () => {
      const { data, error } = await supabase.rpc('get_real_balance', { 
        usr_id: user.id, 
        spc_id: spaceId 
      });
      if (!error && data !== null) {
        setRealBalance(data);
      }
    };

    fetchUnreadLetters();
    fetchPendingOrders();
    fetchBalance();

    const channel = supabase.channel('header_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'letters', filter: `space_id=eq.${spaceId}` }, fetchUnreadLetters)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_purchases', filter: `space_id=eq.${spaceId}` }, () => {
        fetchPendingOrders();
        fetchBalance();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items', filter: `space_id=eq.${spaceId}` }, fetchBalance)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [spaceId, user]);

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight cursor-default">
          Lumina<span className="text-terra-500 font-light">Pulse</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-6">
        <nav className="flex items-center gap-1 sm:gap-4">
          <button onClick={() => setIsLettersOpen(true)} className="flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-all cursor-pointer group">
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 group-hover:text-terra-500 transition-colors" />
              {unreadLettersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terra-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-terra-500 border-2 border-white"></span>
                </span>
              )}
            </div>
            <span className="hidden sm:inline-block text-sm font-medium">Письма</span>
          </button>

          <button onClick={() => setIsStoreOpen(true)} className="flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-all cursor-pointer group">
            <div className="relative">
              <Store className="w-5 h-5 text-gray-400 group-hover:text-terra-500 transition-colors" />
              {pendingOrdersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terra-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-terra-500 border-2 border-white"></span>
                </span>
              )}
            </div>
            <span className="hidden sm:inline-block text-sm font-medium">Награды</span>
          </button>
        </nav>

        <div className="w-px h-6 bg-gray-200 hidden md:block" />

        <div className="flex items-center gap-1 sm:gap-3">
          {profile && (
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg cursor-default">
              <span className="hidden sm:block text-sm font-medium text-gray-700">{profile.display_name || 'Партнер'}</span>
              <span className="hidden sm:block text-gray-300 text-xs">•</span>
              <span className="text-sm font-bold text-terra-600">{realBalance}</span>
            </div>
          )}
          
          {/* НОВАЯ КНОПКА: Справочник / Гайд */}
          <button onClick={() => setIsGuideOpen(true)} className="p-2 text-gray-400 hover:text-terra-600 hover:bg-terra-50 rounded-xl transition-all cursor-pointer group" title="Как пользоваться приложением">
            <BookHeart className="w-5 h-5" />
          </button>

          {/* Кнопка настроек */}
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all cursor-pointer group" title="Настройки">
            <Settings className="w-5 h-5" />
          </button>

          {/* Выход */}
          <button onClick={signOut} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer group" title="Выйти из аккаунта">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <StoreModal isOpen={isStoreOpen} onClose={() => setIsStoreOpen(false)} />
      <LettersModal isOpen={isLettersOpen} onClose={() => setIsLettersOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* Подключаем GuideModal */}
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </header>
  );
}