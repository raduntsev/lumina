'use client';

import React, { useState, useEffect } from 'react';
import { StoreModal } from './StoreModal';
import { LettersModal } from './LettersModal';
import { Store, Mail, Settings, Archive } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

export function Header() {
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [isLettersOpen, setIsLettersOpen] = useState(false);
  const { spaceId, user } = useSpaceAuth();
  
  const [unreadLettersCount, setUnreadLettersCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

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

    fetchUnreadLetters();
    fetchPendingOrders();

    const channel = supabase.channel('header_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'letters', filter: `space_id=eq.${spaceId}` }, () => {
        fetchUnreadLetters();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_purchases', filter: `space_id=eq.${spaceId}` }, () => {
        fetchPendingOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [spaceId, user]);

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 sticky top-0 z-40">
      
      {/* Логотип */}
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight cursor-default">
          Lumina<span className="text-terra-500 font-light">Pulse</span>
        </h1>
      </div>

      {/* Навигация */}
      <nav className="flex items-center gap-2 sm:gap-4">
        
        {/* Кнопка: Письма */}
        <button 
          onClick={() => setIsLettersOpen(true)} 
          className="flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-all cursor-pointer group"
        >
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

        {/* Кнопка: Награды (Магазин) */}
        <button 
          onClick={() => setIsStoreOpen(true)} 
          className="flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-all cursor-pointer group"
        >
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
        
        {/* Разделитель */}
        <div className="w-px h-6 bg-gray-200 mx-2 hidden sm:block" />

        {/* Неактивные кнопки */}
        <button className="hidden sm:flex items-center gap-2.5 px-3 py-2 text-gray-300 cursor-not-allowed">
          <Archive className="w-5 h-5" />
          <span className="text-sm font-medium">Архив</span>
        </button>
        <button className="hidden sm:flex items-center gap-2.5 px-3 py-2 text-gray-300 cursor-not-allowed">
          <Settings className="w-5 h-5" />
          <span className="text-sm font-medium">Настройки</span>
        </button>
      </nav>

      {/* Модальные окна */}
      <StoreModal isOpen={isStoreOpen} onClose={() => setIsStoreOpen(false)} />
      <LettersModal isOpen={isLettersOpen} onClose={() => setIsLettersOpen(false)} />
    </header>
  );
}