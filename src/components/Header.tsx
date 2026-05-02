'use client';

import React, { useState, useEffect } from 'react';
import { StoreModal } from './StoreModal';
import { LettersModal } from './LettersModal';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { SettingsModal } from './SettingsModal';
import { GuideModal } from './GuideModal'; 
import { Store, Mail, LogOut, Settings, BookHeart, Activity } from 'lucide-react';
import { AnalyticsModal } from './AnalyticsModal';

export function Header() {
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  // Проверка на первый вход
  useEffect(() => {
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
  const [partnerBalance, setPartnerBalance] = useState<number>(0);

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
      // 1. Получаем свой баланс
      const { data: myData, error: myError } = await supabase.rpc('get_real_balance', { 
        usr_id: user.id, 
        spc_id: spaceId 
      });
      if (!myError && myData !== null) {
        setRealBalance(myData);
      }

      // 2. Ищем ID партнера и получаем его баланс
      const { data: partnerData } = await supabase
        .from('profiles')
        .select('id')
        .eq('space_id', spaceId)
        .neq('id', user.id)
        .limit(1)
        .maybeSingle();

      if (partnerData) {
        const { data: pData, error: pError } = await supabase.rpc('get_real_balance', { 
          usr_id: partnerData.id, 
          spc_id: spaceId 
        });
        if (!pError && pData !== null) {
          setPartnerBalance(pData);
        }
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

      <div className="flex items-center gap-1 sm:gap-2">
        
        {/* Баланс */}
        {profile && (
          <div className="flex items-center mr-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl cursor-default">
            <span className="text-sm font-bold text-terra-600">{realBalance}</span>
          </div>
        )}
        
        {/* Письма */}
        <button onClick={() => setIsLettersOpen(true)} className="relative p-2 text-gray-400 hover:text-terra-600 hover:bg-terra-50 rounded-xl transition-all cursor-pointer group" title="Письма">
          <Mail className="w-5 h-5" />
          {unreadLettersCount > 0 && (
            <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terra-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-terra-500 border-2 border-white"></span>
            </span>
          )}
        </button>

        {/* Награды (Магазин) */}
        <button onClick={() => setIsStoreOpen(true)} className="relative p-2 text-gray-400 hover:text-terra-600 hover:bg-terra-50 rounded-xl transition-all cursor-pointer group" title="Награды">
          <Store className="w-5 h-5" />
          {pendingOrdersCount > 0 && (
            <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-terra-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-terra-500 border-2 border-white"></span>
            </span>
          )}
        </button>

        {/* Пульс (Аналитика) */}
        <button onClick={() => setIsAnalyticsOpen(true)} className="p-2 text-gray-400 hover:text-terra-600 hover:bg-terra-50 rounded-xl transition-all cursor-pointer group" title="Аналитика и пульс">
          <Activity className="w-5 h-5" />
        </button>
        
        {/* Справочник / Гайд */}
        <button onClick={() => setIsGuideOpen(true)} className="p-2 text-gray-400 hover:text-terra-600 hover:bg-terra-50 rounded-xl transition-all cursor-pointer group" title="Как пользоваться приложением">
          <BookHeart className="w-5 h-5" />
        </button>

        {/* Настройки */}
        <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all cursor-pointer group" title="Настройки">
          <Settings className="w-5 h-5" />
        </button>

        {/* Выход */}
        <button onClick={signOut} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer group" title="Выйти из аккаунта">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <StoreModal isOpen={isStoreOpen} onClose={() => setIsStoreOpen(false)} />
      <LettersModal isOpen={isLettersOpen} onClose={() => setIsLettersOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <AnalyticsModal isOpen={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} />
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </header>
  );
}