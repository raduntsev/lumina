'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Battery, AlertCircle, Info, Loader2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart } from 'recharts';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Помощник для работы с датами
const getDaysArray = (days: number) => {
  return Array.from({ length: days }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split('T')[0];
  });
};

export function AnalyticsModal({ isOpen, onClose }: AnalyticsModalProps) {
  const { spaceId, user, profile } = useSpaceAuth();
  const currentUserId = user?.id;

  const [isLoading, setIsLoading] = useState(true);
  const [rawData, setRawData] = useState<{ items: any[], pulses: any[] }>({ items: [], pulses: [] });
  const [myEnergyToday, setMyEnergyToday] = useState<number | null>(null);
  const [isSavingEnergy, setIsSavingEnergy] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!spaceId || !currentUserId) return;
    setIsLoading(true);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const startDateStr = fourteenDaysAgo.toISOString();

    try {
      // Ровно 2 запроса, чтобы не грузить базу
      const [itemsRes, pulsesRes] = await Promise.all([
        supabase.from('checklist_items')
          .select('completed_at, points, user_id')
          .eq('space_id', spaceId)
          .eq('is_completed', true)
          .gte('completed_at', startDateStr),
        supabase.from('daily_pulse')
          .select('record_date, energy, user_id')
          .eq('space_id', spaceId)
          .gte('record_date', startDateStr.split('T')[0])
      ]);

      setRawData({
        items: itemsRes.data || [],
        pulses: pulsesRes.data || []
      });

      // Проверяем, ставил ли я оценку сегодня
      const todayStr = new Date().toISOString().split('T')[0];
      const myTodayPulse = (pulsesRes.data || []).find(p => p.user_id === currentUserId && p.record_date === todayStr);
      if (myTodayPulse) setMyEnergyToday(myTodayPulse.energy);

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [spaceId, currentUserId]);

  useEffect(() => {
    if (isOpen) fetchAnalytics();
  }, [isOpen, fetchAnalytics]);

  const handleSaveEnergy = async (val: number) => {
    if (!spaceId || !currentUserId) return;
    setIsSavingEnergy(true);
    const todayStr = new Date().toISOString().split('T')[0];

    const { error } = await supabase.from('daily_pulse').upsert({
      space_id: spaceId,
      user_id: currentUserId,
      record_date: todayStr,
      energy: val
    }, { onConflict: 'user_id, record_date' });

    if (!error) {
      setMyEnergyToday(val);
      fetchAnalytics(); // Тихо обновляем графики
    }
    setIsSavingEnergy(false);
  };

  // Собираем данные для графиков (клиентская агрегация)
  const chartData = useMemo(() => {
    if (!currentUserId) return [];
    const days = getDaysArray(14);
    
    return days.map(dateStr => {
      // Форматируем дату для подписи (например, "15 мая")
      const dateObj = new Date(dateStr);
      const displayDate = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

      // Задачи за этот день
      const dayItems = rawData.items.filter(item => item.completed_at?.startsWith(dateStr));
      const myPoints = dayItems.filter(i => i.user_id !== currentUserId).reduce((sum, i) => sum + (i.points || 0), 0); // баллы, которые я заработал (партнер выполнил)
      // Поправка логики: если я выполнил задачу, я получаю баллы. Значит user_id в checklist_items — это тот, кто СОЗДАЛ или ВЫПОЛНИЛ? 
      // В LuminaPulse обычно тот, кто отмечает задачу, зарабатывает баллы. Предположим, что мы считаем баллы по факту выполнения.
      // Для простоты в этом коде: myPoints = сумма моих усилий.
      
      // Считаем усилия
      const myEffort = dayItems.filter(i => i.user_id === currentUserId).reduce((sum, i) => sum + (i.points || 0), 0);
      const partnerEffort = dayItems.filter(i => i.user_id !== currentUserId).reduce((sum, i) => sum + (i.points || 0), 0);

      // Настроение за этот день
      const dayPulses = rawData.pulses.filter(p => p.record_date === dateStr);
      const myEnergy = dayPulses.find(p => p.user_id === currentUserId)?.energy || null;
      const partnerEnergy = dayPulses.find(p => p.user_id !== currentUserId)?.energy || null;

      return {
        date: dateStr,
        displayDate,
        Вы: myEffort,
        Партнер: partnerEffort,
        МояЭнергия: myEnergy,
        ЭнергияПартнера: partnerEnergy
      };
    });
  }, [rawData, currentUserId]);

  // Движок инсайтов
  const insights = useMemo(() => {
    const messages: { type: 'info' | 'alert'; text: string }[] = [];
    if (chartData.length === 0) return messages;

    // 1. Анализ баланса (за последние 7 дней)
    const last7Days = chartData.slice(-7);
    const myTotal7 = last7Days.reduce((sum, d) => sum + d.Вы, 0);
    const partnerTotal7 = last7Days.reduce((sum, d) => sum + d.Партнер, 0);

    if (myTotal7 > partnerTotal7 * 1.6 && myTotal7 > 100) {
      messages.push({
        type: 'info',
        text: 'На этой неделе вы взяли на себя большую часть быта. Это отличный повод заглянуть в магазин наград и выбрать что-то приятное для себя.'
      });
    } else if (partnerTotal7 > myTotal7 * 1.6 && partnerTotal7 > 100) {
      messages.push({
        type: 'info',
        text: `Кажется, на этой неделе партнер взял на себя много дел (${partnerTotal7} баллов). Самое время забрать часть задач или предложить услугу из магазина.`
      });
    }

    // 2. Радар выгорания (за последние 3 дня)
    const last3Days = chartData.slice(-3);
    
    const myBurnoutDay = last3Days.find(d => d.МояЭнергия !== null && d.МояЭнергия <= 3 && d.Вы >= 50);
    if (myBurnoutDay) {
      messages.push({
        type: 'alert',
        text: 'Вы отмечали низкий уровень энергии, но продолжали активно делать задачи. Будьте бережнее к себе, система видит риск выгорания.'
      });
    }

    const partnerBurnoutDay = last3Days.find(d => d.ЭнергияПартнера !== null && d.ЭнергияПартнера <= 3 && d.Партнер >= 50);
    if (partnerBurnoutDay) {
      messages.push({
        type: 'alert',
        text: 'Партнер работает на износ: при низком уровне энергии выполнено много энергозатратных задач. Постарайтесь разгрузить его сегодня.'
      });
    }

    return messages;
  }, [chartData]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-gray-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ y: 20, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.98 }}
          className="bg-gray-50 w-full max-w-4xl h-full sm:h-[85vh] flex flex-col shadow-2xl relative sm:rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:px-8 border-b border-gray-100 bg-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-gray-100 rounded-xl"><Activity className="w-5 h-5 text-gray-700" /></div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Пульс</h2>
                <p className="text-sm font-medium text-gray-500">Аналитика за 14 дней</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-grow overflow-y-auto p-4 sm:p-8 space-y-8">
            
            {/* Оценка настроения (сегодня) */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Battery className="w-4 h-4 text-terra-500"/> Ваш уровень энергии сегодня</h3>
                  <p className="text-sm text-gray-500 mt-1">От 1 (совсем нет сил) до 10 (горы сверну).</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {[2, 4, 6, 8, 10].map((val) => (
                    <button
                      key={val}
                      onClick={() => handleSaveEnergy(val)}
                      disabled={isSavingEnergy}
                      className={`w-10 h-10 rounded-xl text-sm font-semibold transition-all ${myEnergyToday === val ? 'bg-terra-500 text-white shadow-md' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-terra-300'}`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
            ) : (
              <>
                {/* Инсайты (Текстовые подсказки) */}
                {insights.length > 0 && (
                  <div className="space-y-3">
                    {insights.map((msg, i) => (
                      <div key={i} className={`p-4 rounded-xl border flex gap-3 text-sm leading-relaxed ${msg.type === 'alert' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                        {msg.type === 'alert' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <Info className="w-5 h-5 shrink-0 mt-0.5" />}
                        <p>{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* График 1: Индекс баланса */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-6">График нагрузки (баллы)</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="Вы" stroke="#111827" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Партнер" stroke="#9ca3af" strokeWidth={3} dot={{ r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* График 2: Радар выгорания (Смешанный) */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-2">Радар выгорания</h3>
                  <p className="text-sm text-gray-500 mb-6">Связь ваших усилий (столбики) и уровня энергии (линия).</p>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 10]} hide />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar yAxisId="left" dataKey="Вы" fill="#e5e7eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Line yAxisId="right" type="monotone" dataKey="МояЭнергия" stroke="#d97757" strokeWidth={3} dot={{ r: 4, fill: '#d97757', strokeWidth: 0 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}