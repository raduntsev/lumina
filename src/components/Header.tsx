'use client';

import React, { useState, useEffect } from 'react';
import { StoreModal } from './StoreModal';
import { LettersModal } from './LettersModal';
import { Store, Mail, Settings, Archive, LogOut } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

export function Header() {
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [isLettersOpen, setIsLettersOpen] = useState(false);
  
  const { spaceId, user, profile, signOut } = useSpaceAuth();
  
  const [unreadLettersCount, setUnreadLettersCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [dynamicBalance, setDynamicBalance] = useState(0);

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

    // Функция для получения реальной суммы баллов за выполненные задачи
    const fetchBalance = async () => {
      const { data } = await supabase
        .from('checklist_items')
        .select('points')
        .eq('space_id', spaceId)
        .eq('user_id', user.id) // Считаем баллы за задачи, выполненные ЭТИМ пользователем
        .eq('is_completed', true);
      
      const total = data?.reduce((sum, item) => sum + (item.points || 0), 0) || 0;
      setDynamicBalance(total);
    };

    fetchUnreadLetters();
    fetchPendingOrders();
    fetchBalance();

    const channel = supabase.channel('header_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'letters', filter: `space_id=eq.${spaceId}` }, () => {
        fetchUnreadLetters();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_purchases', filter: `space_id=eq.${spaceId}` }, () => {
        fetchPendingOrders();
      })
      // Слушаем изменения в задачах, чтобы обновлять баланс в реальном времени
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items', filter: `space_id=eq.${spaceId}` }, () => {
        fetchBalance();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [spaceId, user]);

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight cursor-default">
          Lumina<span className="text-terra-500 font-light">Pulse</span>
        </h1>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <nav className="flex items-center gap-2 sm:gap-4">
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

        <div className="flex items-center gap-3">
          {profile && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg cursor-default">
              <span className="text-sm font-medium text-gray-700">
                {profile.display_name || 'Партнер'}
              </span>
              <span className="text-gray-300 text-xs">•</span>
              <span className="text-sm font-bold text-terra-600">
                {dynamicBalance}
              </span>
            </div>
          )}
          
          <button onClick={signOut} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer group">
            <LogOut className="w-5 h-5 group-hover:scale-105 transition-transform" />
          </button>
        </div>
      </div>

      <StoreModal isOpen={isStoreOpen} onClose={() => setIsStoreOpen(false)} />
      <LettersModal isOpen={isLettersOpen} onClose={() => setIsLettersOpen(false)} />
    </header>
  );
}