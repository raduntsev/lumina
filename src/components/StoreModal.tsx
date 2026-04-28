'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Store, Plus, CheckCircle2, Clock, Sparkles, Loader2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';


interface ShopItem {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  cost: number;
}

interface Purchase {
  id: string;
  item_id: string;
  buyer_id: string;
  seller_id: string;
  title: string;
  cost: number;
  is_fulfilled: boolean;
  created_at: string;
}

interface ShopRequest {
  id: string;
  requester_id: string;
  title: string;
  description: string;
  suggested_cost: number;
}

export function StoreModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { spaceId, user } = useSpaceAuth();
  const currentUserId = user?.id || null;

  const [activeTab, setActiveTab] = useState<'shop' | 'my_items' | 'history'>('shop');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [requests, setRequests] = useState<ShopRequest[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Добавлен стейт для лимита истории
  const [historyLimit, setHistoryLimit] = useState(5);

  // Формы
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCost, setNewCost] = useState(10);
  const [isRequesting, setIsRequesting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!spaceId || !currentUserId) return;
    setIsLoading(true);

    try {
      const { data: shopData } = await supabase.from('shop_items').select('*').eq('space_id', spaceId).order('created_at', { ascending: false });
      if (shopData) setItems(shopData);

      const { data: historyData } = await supabase.from('shop_purchases').select('*').eq('space_id', spaceId).order('created_at', { ascending: false });
      if (historyData) setPurchases(historyData);

      const { data: reqData } = await supabase.from('shop_requests').select('*').eq('space_id', spaceId).order('created_at', { ascending: false });
      if (reqData) setRequests(reqData);

      const { data: spaceChecklists } = await supabase.from('checklists').select('id').eq('space_id', spaceId);
      const checklistIds = spaceChecklists?.map(c => c.id) || [];

      let totalEarned = 0;
      if (checklistIds.length > 0) {
        const { data: earnedData } = await supabase
          .from('checklist_items')
          .select('points')
          .in('checklist_id', checklistIds)
          .eq('is_completed', true)
          .neq('user_id', currentUserId);
        totalEarned = earnedData?.reduce((sum, item) => sum + (item.points || 0), 0) || 0;
      }

      const totalSpent = historyData?.filter(p => p.buyer_id === currentUserId).reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
      setBalance(totalEarned - totalSpent);

    } catch (err) {
      console.error("Ошибка загрузки:", err);
    } finally {
      setIsLoading(false);
    }
  }, [spaceId, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setHistoryLimit(5); // Сбрасываем лимит при открытии
    }
  }, [isOpen, fetchData]);

  const partnerItems = items.filter(i => i.creator_id !== currentUserId);
  const myItems = items.filter(i => i.creator_id === currentUserId);
  const iBought = purchases.filter(p => p.buyer_id === currentUserId);
  const boughtFromMe = purchases.filter(p => p.seller_id === currentUserId);
  const myRequests = requests.filter(r => r.requester_id === currentUserId);
  const requestsForMe = requests.filter(r => r.requester_id !== currentUserId);

  const pendingOrdersCount = boughtFromMe.filter(p => !p.is_fulfilled).length;

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !spaceId || !currentUserId) return;

    const { data } = await supabase.from('shop_items').insert({
      space_id: spaceId, creator_id: currentUserId, title: newTitle.trim(), description: newDesc.trim(), cost: newCost
    }).select('*').single();

    if (data) {
      setItems([data, ...items]);
      setNewTitle(''); setNewDesc(''); setNewCost(10);
    }
  };

  const handleDeleteItem = async (id: string) => {
    await supabase.from('shop_items').delete().eq('id', id);
    setItems(items.filter(i => i.id !== id));
  };

  const handleBuy = async (item: ShopItem) => {
    if (!spaceId || !currentUserId) return;
    if (balance < item.cost) { alert('Недостаточно баллов!'); return; }

    if (window.confirm(`Потратить ${item.cost} баллов на "${item.title}"?`)) {
      const { data } = await supabase.from('shop_purchases').insert({
        space_id: spaceId, item_id: item.id, buyer_id: currentUserId, seller_id: item.creator_id, cost: item.cost, title: item.title
      }).select('*').single();

      if (data) {
        setPurchases([data, ...purchases]);
        setBalance(prev => prev - item.cost);
        setActiveTab('history');
      }
    }
  };

  const handleFulfill = async (purchaseId: string) => {
    await supabase.from('shop_purchases').update({ is_fulfilled: true }).eq('id', purchaseId);
    setPurchases(purchases.map(p => p.id === purchaseId ? { ...p, is_fulfilled: true } : p));
  };

  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !spaceId || !currentUserId) return;

    const { data } = await supabase.from('shop_requests').insert({
      space_id: spaceId, requester_id: currentUserId, title: newTitle.trim(), description: newDesc.trim(), suggested_cost: newCost
    }).select('*').single();

    if (data) {
      setRequests([data, ...requests]);
      setNewTitle(''); setNewDesc(''); setNewCost(10);
      setIsRequesting(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    await supabase.from('shop_requests').delete().eq('id', id);
    setRequests(requests.filter(r => r.id !== id));
  };

  const handleApproveRequest = async (req: ShopRequest) => {
    if (!spaceId || !currentUserId) return;
    const { data: newItem } = await supabase.from('shop_items').insert({
      space_id: spaceId, creator_id: currentUserId, title: req.title, description: req.description, cost: req.suggested_cost
    }).select('*').single();

    if (newItem) {
      setItems([newItem, ...items]);
      await supabase.from('shop_requests').delete().eq('id', req.id);
      setRequests(requests.filter(r => r.id !== req.id));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6"
        >
          <motion.div 
            initial={{ y: 20, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="bg-gray-50 w-full max-w-5xl h-full sm:h-[85vh] flex flex-col shadow-2xl relative sm:rounded-2xl overflow-hidden"
          >
            {/* Header окна */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 sm:px-8 border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0 gap-4">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-terra-50 border border-terra-100 rounded-xl">
                  <Store className="w-5 h-5 text-terra-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Витрина</h2>
                  <p className="text-sm font-medium text-gray-500">Обмен усилиями</p>
                </div>
              </div>
              <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                  <span className="text-sm font-medium text-gray-500">Ваш баланс:</span>
                  <span className="text-xl font-semibold text-terra-600">{balance} <span className="text-sm text-terra-500/70 font-medium">баллов</span></span>
                </div>
                {/* Убран класс hidden sm:block, чтобы крестик был виден всегда */}
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer text-gray-400 hover:text-gray-900">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Навигация (Табы) */}
            <div className="bg-white border-b border-gray-100 px-4 sm:px-8 py-4 shrink-0">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                  onClick={() => { setActiveTab('shop'); setIsRequesting(false); }} 
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer flex justify-center items-center gap-2 ${activeTab === 'shop' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Магазин
                </button>
                <button 
                  onClick={() => { setActiveTab('my_items'); setIsRequesting(false); }} 
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer flex justify-center items-center gap-2 ${activeTab === 'my_items' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Мои услуги
                  {requestsForMe.length > 0 && <span className="w-2 h-2 bg-terra-500 rounded-full animate-pulse" />}
                </button>
                <button 
                  onClick={() => setActiveTab('history')} 
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer flex justify-center items-center gap-2 ${activeTab === 'history' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Заказы
                  {pendingOrdersCount > 0 && <span className="w-5 h-5 bg-terra-500 text-white flex items-center justify-center rounded-md text-xs font-semibold animate-pulse">{pendingOrdersCount}</span>}
                </button>
              </div>
            </div>

            {/* Контент */}
            <div className="flex-grow overflow-y-auto p-4 sm:p-8">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-sm font-medium text-gray-400 flex-col gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                  <span>Обновление...</span>
                </div>
              ) : (
                <>
                  {/* ВИТРИНА ПАРТНЕРА */}
                  {activeTab === 'shop' && (
                    <div className="space-y-6 max-w-5xl mx-auto">
                      
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                        <p className="text-sm font-medium text-gray-500">Доступно для покупки</p>
                        <button 
                          onClick={() => setIsRequesting(!isRequesting)} 
                          className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors cursor-pointer flex items-center gap-2 border ${isRequesting ? 'bg-gray-100 text-gray-900 border-gray-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                          <Sparkles className="w-4 h-4 text-terra-500" />
                          {isRequesting ? 'Отменить' : 'Предложить идею'}
                        </button>
                      </div>

                      <AnimatePresence>
                        {isRequesting && (
                          <motion.form 
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            onSubmit={handleAddRequest} 
                            className="bg-white p-5 sm:p-6 border border-gray-200 rounded-2xl shadow-sm space-y-5 overflow-hidden"
                          >
                            <p className="text-base font-semibold text-gray-900">Запрос новой услуги</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="md:col-span-2 space-y-4">
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Название</label>
                                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 transition-shadow text-gray-900 placeholder:text-gray-400" placeholder="Например: Приготовить ужин" />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Описание</label>
                                  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 transition-shadow text-gray-900 placeholder:text-gray-400 resize-none h-20" placeholder="Детали пожелания..." />
                                </div>
                              </div>
                              <div className="flex flex-col justify-between space-y-4">
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Ваша цена (баллы)</label>
                                  <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 overflow-hidden focus-within:ring-2 focus-within:ring-terra-500/20 focus-within:border-terra-500 transition-shadow">
                                    <span className="text-gray-400 text-base font-medium pl-2">+</span>
                                    <input type="number" min="1" value={newCost} onChange={e => setNewCost(Number(e.target.value))} className="w-full py-3 text-xl text-terra-600 font-semibold bg-transparent outline-none text-center" />
                                  </div>
                                </div>
                                <button type="submit" className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors cursor-pointer shadow-sm">
                                  Отправить запрос
                                </button>
                              </div>
                            </div>
                          </motion.form>
                        )}
                      </AnimatePresence>

                      {partnerItems.length === 0 ? (
                        <div className="text-center py-16 text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-white">Партнер еще не выставил услуги</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {partnerItems.map(item => (
                            <div key={item.id} className="bg-white p-6 border border-gray-200 hover:border-gray-300 rounded-2xl transition-all flex flex-col justify-between group shadow-sm">
                              <div className="space-y-2 mb-6">
                                <h4 className="font-semibold text-lg text-gray-900 leading-tight">{item.title}</h4>
                                {item.description && <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>}
                              </div>
                              <div className="flex items-center justify-between pt-5 border-t border-gray-100 mt-auto">
                                <span className="font-semibold text-terra-600 text-xl">{item.cost} <span className="text-sm font-medium text-terra-600/60 ml-0.5">баллов</span></span>
                                <button 
                                  onClick={() => handleBuy(item)}
                                  disabled={balance < item.cost}
                                  className={`text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shadow-sm ${balance >= item.cost ? 'bg-gray-900 text-white hover:bg-black cursor-pointer' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                                >
                                  Купить
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {myRequests.length > 0 && (
                        <div className="pt-8 mt-8 border-t border-gray-200">
                          <p className="text-sm font-medium text-gray-500 mb-4">Ваши запросы ожидают ответа</p>
                          <div className="space-y-3">
                            {myRequests.map(req => (
                              <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-gray-200 rounded-xl gap-4 shadow-sm">
                                <div className="flex items-center gap-4">
                                  <span className="text-sm px-3 py-1 bg-gray-100 text-gray-700 font-semibold rounded-lg">{req.suggested_cost} баллов</span>
                                  <div>
                                    <h4 className="font-semibold text-base text-gray-900">{req.title}</h4>
                                    {req.description && <p className="text-sm text-gray-500 mt-0.5">{req.description}</p>}
                                  </div>
                                </div>
                                <button onClick={() => handleDeleteRequest(req.id)} className="text-sm font-medium text-gray-400 hover:text-red-500 transition-colors self-start sm:self-auto cursor-pointer px-3 py-1.5 hover:bg-red-50 rounded-lg">Отозвать</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* МОИ УСЛУГИ */}
                  {activeTab === 'my_items' && (
                    <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto">
                      
                      <div className="w-full lg:w-1/3 space-y-8">
                        {requestsForMe.length > 0 && (
                          <div className="space-y-4">
                            <p className="text-sm font-medium text-terra-600 flex items-center gap-2">
                              <Sparkles className="w-4 h-4" /> Запросы от партнера
                            </p>
                            <div className="space-y-3">
                              {requestsForMe.map(req => (
                                <div key={req.id} className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm relative overflow-hidden">
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-terra-500"></div>
                                  <div className="flex justify-between items-start mb-2 pl-2">
                                    <h4 className="font-semibold text-base text-gray-900">{req.title}</h4>
                                    <span className="text-xs px-2.5 py-1 bg-terra-50 text-terra-600 font-semibold rounded-lg whitespace-nowrap ml-2">{req.suggested_cost} баллов</span>
                                  </div>
                                  {req.description && <p className="text-sm text-gray-500 mb-5 pl-2">{req.description}</p>}
                                  <div className="flex gap-2 pl-2">
                                    <button onClick={() => handleApproveRequest(req)} className="flex-1 py-2 bg-terra-500 text-white text-sm font-medium rounded-xl hover:bg-terra-600 transition-colors cursor-pointer shadow-sm">Добавить</button>
                                    <button onClick={() => handleDeleteRequest(req.id)} className="px-3 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          <p className="text-sm font-medium text-gray-500">Добавить на витрину</p>
                          <form onSubmit={handleAddItem} className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm space-y-5">
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Название</label>
                              <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 transition-shadow text-gray-900 placeholder:text-gray-400" placeholder="Например: Массаж плеч" />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Описание</label>
                              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 transition-shadow text-gray-900 placeholder:text-gray-400 resize-none h-20" placeholder="Детали услуги..." />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Стоимость (баллы)</label>
                              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 overflow-hidden focus-within:ring-2 focus-within:ring-terra-500/20 focus-within:border-terra-500 transition-shadow">
                                <span className="text-gray-400 text-base font-medium pl-2">+</span>
                                <input type="number" min="1" value={newCost} onChange={e => setNewCost(Number(e.target.value))} className="w-full py-3 text-xl text-terra-600 font-semibold bg-transparent outline-none text-center" />
                              </div>
                            </div>
                            <button type="submit" className="w-full py-3 bg-gray-900 text-white text-sm rounded-xl mt-2 hover:bg-black transition-colors cursor-pointer flex justify-center items-center gap-2 font-medium shadow-sm">
                              <Plus className="w-4 h-4" /> Выставить в магазин
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="w-full lg:w-2/3 space-y-4">
                        <p className="text-sm font-medium text-gray-500">Ваши текущие лоты</p>
                        {myItems.length === 0 ? (
                          <div className="text-center py-16 text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-white">У вас пока нет активных лотов</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {myItems.map(item => (
                              <div key={item.id} className="p-6 bg-white border border-gray-200 rounded-2xl group shadow-sm flex flex-col justify-between">
                                <div className="mb-5">
                                  <div className="flex items-start justify-between gap-4 mb-2">
                                    <h4 className="font-semibold text-base text-gray-900 leading-tight">{item.title}</h4>
                                    <button onClick={() => handleDeleteItem(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-red-50 hover:text-red-500 p-1.5 rounded-lg transition-all cursor-pointer">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  {item.description && <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>}
                                </div>
                                <span className="text-sm font-semibold text-terra-600 bg-terra-50 self-start px-3 py-1 rounded-lg">{item.cost} баллов</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ИСТОРИЯ ЗАКАЗОВ (РАЗДЕЛЕННАЯ С ЛИМИТАМИ) */}
                  {activeTab === 'history' && (() => {
                    const pendingFromMe = boughtFromMe.filter(p => !p.is_fulfilled);
                    const fulfilledFromMe = boughtFromMe.filter(p => p.is_fulfilled);
                    
                    const pendingIBought = iBought.filter(p => !p.is_fulfilled);
                    const fulfilledIBought = iBought.filter(p => p.is_fulfilled);

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                        
                        {/* Нужно выполнить */}
                        <div className="space-y-4">
                          <p className="text-sm font-medium text-terra-600 flex items-center gap-2">
                            Нужно выполнить {pendingOrdersCount > 0 && <span className="w-2 h-2 bg-terra-500 rounded-full animate-pulse" />}
                          </p>
                          {boughtFromMe.length === 0 ? <p className="text-sm text-gray-400 py-12 border border-dashed border-gray-200 bg-white text-center rounded-2xl">У вас еще ничего не заказали</p> : (
                            <div className="space-y-4">
                              {/* Ожидающие (все) */}
                              {pendingFromMe.map(p => (
                                <div key={p.id} className="p-5 rounded-2xl border transition-all border-terra-200 bg-white shadow-sm">
                                  <div className="flex justify-between items-start mb-4">
                                    <h4 className="text-base font-semibold text-gray-900">{p.title}</h4>
                                    <span className="text-xs font-bold text-terra-600 px-2.5 py-1 bg-terra-50 rounded-lg">+{p.cost}</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                    <span className="text-xs font-medium text-gray-400">{new Date(p.created_at).toLocaleDateString('ru-RU')}</span>
                                    <button 
                                      onClick={() => handleFulfill(p.id)} 
                                      className="text-sm px-4 py-2 rounded-xl bg-terra-500 text-white font-medium cursor-pointer hover:bg-terra-600 transition-colors shadow-sm"
                                    >
                                      Завершить
                                    </button>
                                  </div>
                                </div>
                              ))}
                              
                              {/* Завершенные (обрезанные лимитом) */}
                              {fulfilledFromMe.slice(0, historyLimit).map(p => (
                                <div key={p.id} className="p-5 rounded-2xl border transition-all border-gray-100 bg-gray-50/50 opacity-60">
                                  <div className="flex justify-between items-start mb-4">
                                    <h4 className="text-base font-semibold text-gray-900 line-through text-gray-500">{p.title}</h4>
                                    <span className="text-xs font-bold text-terra-600 px-2.5 py-1 bg-terra-50 rounded-lg">+{p.cost}</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                    <span className="text-xs font-medium text-gray-400">{new Date(p.created_at).toLocaleDateString('ru-RU')}</span>
                                    <span className="text-xs text-gray-500 flex items-center gap-1.5 font-medium"><CheckCircle2 className="w-4 h-4 text-gray-400"/> Выполнено</span>
                                  </div>
                                </div>
                              ))}

                              {/* Кнопка "Показать еще" */}
                              {fulfilledFromMe.length > historyLimit && (
                                <button 
                                  onClick={() => setHistoryLimit(prev => prev + 5)}
                                  className="w-full py-3 mt-2 text-sm text-gray-600 font-medium bg-gray-50 rounded-xl hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
                                >
                                  Показать еще завершенные...
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Ваши покупки */}
                        <div className="space-y-4">
                          <p className="text-sm font-medium text-gray-500">Ваши покупки</p>
                          {iBought.length === 0 ? <p className="text-sm text-gray-400 py-12 border border-dashed border-gray-200 bg-white text-center rounded-2xl">Вы еще ничего не купили</p> : (
                            <div className="space-y-4">
                              {/* Ожидающие (все) */}
                              {pendingIBought.map(p => (
                                <div key={p.id} className="p-5 border border-gray-200 bg-white rounded-2xl flex items-center justify-between shadow-sm">
                                  <div>
                                    <h4 className="text-base font-semibold text-gray-900">{p.title}</h4>
                                    <span className="text-xs font-medium text-gray-400 mt-1 block">{new Date(p.created_at).toLocaleDateString('ru-RU')}</span>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded-lg">-{p.cost} pts</span>
                                    <span className="text-xs flex items-center gap-1.5 text-gray-400 font-medium"><Clock className="w-4 h-4" /> Ожидаем</span>
                                  </div>
                                </div>
                              ))}

                              {/* Полученные (обрезанные лимитом) */}
                              {fulfilledIBought.slice(0, historyLimit).map(p => (
                                <div key={p.id} className="p-5 border border-gray-200 bg-white rounded-2xl flex items-center justify-between shadow-sm opacity-60">
                                  <div>
                                    <h4 className="text-base font-semibold text-gray-900 opacity-50 line-through">{p.title}</h4>
                                    <span className="text-xs font-medium text-gray-400 mt-1 block">{new Date(p.created_at).toLocaleDateString('ru-RU')}</span>
                                  </div>
                                  <div className="flex flex-col items-end gap-2">
                                    <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded-lg">-{p.cost} pts</span>
                                    <span className="text-xs text-terra-500 font-medium flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/> Получено</span>
                                  </div>
                                </div>
                              ))}

                              {/* Кнопка "Показать еще" */}
                              {fulfilledIBought.length > historyLimit && (
                                <button 
                                  onClick={() => setHistoryLimit(prev => prev + 5)}
                                  className="w-full py-3 mt-2 text-sm text-gray-600 font-medium bg-gray-50 rounded-xl hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
                                >
                                  Показать еще полученные...
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}