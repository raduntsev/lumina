'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle2, Lock, HeartHandshake, Plus, X, Copy, Clock, BookmarkPlus, Heart, Zap, Sparkles, Trash2, ListPlus } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

interface Task {
  id: string;
  content: string;
  is_ready: boolean;      
  is_completed: boolean;  
  points: number;
  author_id: string;      
}

interface DailyMetric {
  user_id: string;
  date: string;
  mood_score: number | null; // Теперь может быть null
  has_intimacy: boolean;
  has_conflict: boolean;
}

interface DayData {
  date: string;
  activityScore: number;
  metrics: DailyMetric[];
  hasSurprise: boolean;
}

interface Template {
  id: string;
  content: string;
  points: number;
}

interface TemplateTask {
  content: string;
  points: number;
}

interface TemplateSet {
  id: string;
  title: string;
  tasks: TemplateTask[];
  totalPoints: number;
}

export function DailyPulse() {
  const { spaceId, user, isLoading: isAuthLoading } = useSpaceAuth();
  const currentUserId = user?.id || null;
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  // Шаблоны и наборы
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSets, setTemplateSets] = useState<TemplateSet[]>([]);

  const [activeTab, setActiveTab] = useState<'my' | 'partner'>('my');
  const [viewMode, setViewMode] = useState<'my' | 'partner' | 'combined'>('combined');

  const [tasksByDate, setTasksByDate] = useState<Record<string, Task[]>>({});
  
  // UI States
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPoints, setNewTaskPoints] = useState<number>(1);

  // UI States для Наборов
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [newSetTitle, setNewSetTitle] = useState('');
  const [newSetTasks, setNewSetTasks] = useState<TemplateTask[]>([{ content: '', points: 1 }]);

  // Метрики (Настроение теперь может быть null для бесцветных дней)
  const [myMood, setMyMood] = useState<number | null>(null);
  const [myIntimacy, setMyIntimacy] = useState(false);
  const [myConflict, setMyConflict] = useState(false);

  const days = useMemo(() => eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  }), [currentMonth]);

  useEffect(() => {
    if (!spaceId || !currentUserId) return;
    async function getPartner() {
      const { data } = await supabase.from('profiles').select('id').eq('space_id', spaceId).neq('id', currentUserId).limit(1);
      if (data && data.length > 0) setPartnerId(data[0].id);
    }
    getPartner();
  }, [spaceId, currentUserId]);

  useEffect(() => {
    if (!spaceId || !currentUserId) return;
    async function fetchTemplates() {
      const { data } = await supabase.from('task_templates').select('id, content, points').eq('space_id', spaceId).eq('user_id', currentUserId).order('created_at', { ascending: true });
      
      if (data) {
        const singles: Template[] = [];
        const sets: TemplateSet[] = [];
        
        data.forEach(item => {
          try {
            const parsed = JSON.parse(item.content);
            if (parsed.isSet) {
              sets.push({ id: item.id, title: parsed.title, tasks: parsed.tasks, totalPoints: item.points });
            } else {
              singles.push(item);
            }
          } catch {
            singles.push(item); // Старые шаблоны (просто текст)
          }
        });
        
        setTemplates(singles);
        setTemplateSets(sets);
      }
    }
    fetchTemplates();
  }, [spaceId, currentUserId]);

  const fetchMonthActivity = useCallback(async () => {
    if (isAuthLoading) return;
    if (!spaceId || !currentUserId) { setIsDataLoading(false); return; }

    setIsDataLoading(true);
    try {
      if (!inviteCode) {
        const { data: space } = await supabase.from('spaces').select('invite_code').eq('id', spaceId).single();
        if (space) setInviteCode(space.invite_code);
      }

      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const { data: checklists } = await supabase.from('checklists').select('id, date').eq('space_id', spaceId).gte('date', start).lte('date', end);
      const checklistIds = checklists?.map(c => c.id) || [];
      let items: any[] = [];

      if (checklistIds.length > 0) {
        const { data: fetchedItems } = await supabase.from('checklist_items').select('*').in('checklist_id', checklistIds).order('sort_order', { ascending: true });
        items = fetchedItems || [];
      }

      const { data: metricsData } = await supabase.from('daily_metrics').select('*').eq('space_id', spaceId).gte('date', start).lte('date', end);
      const { data: purchasesData } = await supabase.from('shop_purchases').select('created_at').eq('space_id', spaceId).gte('created_at', start).lte('created_at', end);

      const newTasksByDate: Record<string, Task[]> = {};
      checklists?.forEach(c => {
        newTasksByDate[c.date] = items.filter(i => i.checklist_id === c.id).map(i => ({
          id: i.id, content: i.content, is_ready: i.is_ready || false, is_completed: i.is_completed || false, points: i.points || 1, author_id: i.user_id
        }));
      });
      setTasksByDate(newTasksByDate);

      const newMonthData: DayData[] = days.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayTasks = newTasksByDate[dateStr] || [];
        const earned = dayTasks.filter(t => t.is_completed).reduce((sum, t) => sum + t.points, 0);
        return {
          date: dateStr, activityScore: earned, metrics: (metricsData || []).filter(m => m.date === dateStr), hasSurprise: (purchasesData || []).some(p => format(new Date(p.created_at), 'yyyy-MM-dd') === dateStr)
        };
      });
      setMonthData(newMonthData);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDataLoading(false);
    }
  }, [currentMonth, spaceId, currentUserId, isAuthLoading, inviteCode, days]);

  useEffect(() => { fetchMonthActivity(); }, [fetchMonthActivity]);

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayData = monthData.find(d => d.date === dateStr);
    const myTodayMetric = dayData?.metrics.find(m => m.user_id === currentUserId);
    if (myTodayMetric) {
      setMyMood(myTodayMetric.mood_score); setMyIntimacy(myTodayMetric.has_intimacy); setMyConflict(myTodayMetric.has_conflict);
    } else {
      setMyMood(null); setMyIntimacy(false); setMyConflict(false);
    }
  }, [selectedDate, monthData, currentUserId]);

  // Обновлен для работы с null
  const saveMetrics = async (val: number | null, intim: boolean, conf: boolean) => {
    if (!spaceId || !currentUserId) return;
    await supabase.from('daily_metrics').upsert({
      space_id: spaceId, user_id: currentUserId, date: format(selectedDate, 'yyyy-MM-dd'), mood_score: val, has_intimacy: intim, has_conflict: conf
    }, { onConflict: 'user_id, date' });
    fetchMonthActivity();
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const allCurrentTasks = tasksByDate[selectedDateStr] || [];
  const myTasks = allCurrentTasks.filter(t => t.author_id !== currentUserId);
  const partnerTasks = allCurrentTasks.filter(t => t.author_id === currentUserId);
  const displayedTasks = activeTab === 'my' ? myTasks : partnerTasks;

  const earnedPoints = displayedTasks.filter(t => t.is_completed).reduce((sum, t) => sum + t.points, 0);
  const pendingPoints = displayedTasks.filter(t => t.is_ready && !t.is_completed).reduce((sum, t) => sum + t.points, 0);
  const totalPoints = displayedTasks.reduce((sum, t) => sum + t.points, 0);

  const handleToggleReady = async (taskId: string, currentReady: boolean) => {
    setTasksByDate(prev => ({ ...prev, [selectedDateStr]: prev[selectedDateStr].map(t => t.id === taskId ? { ...t, is_ready: !currentReady } : t) }));
    await supabase.from('checklist_items').update({ is_ready: !currentReady }).eq('id', taskId);
  };

  const handleToggleCompleted = async (taskId: string, currentCompleted: boolean) => {
    setTasksByDate(prev => ({ ...prev, [selectedDateStr]: prev[selectedDateStr].map(t => t.id === taskId ? { ...t, is_completed: !currentCompleted } : t) }));
    await supabase.from('checklist_items').update({ is_completed: !currentCompleted }).eq('id', taskId);
  };

  const handleReviewDay = async () => {
    const tasksToConfirm = partnerTasks.filter(t => t.is_ready && !t.is_completed);
    setTasksByDate(prev => ({ ...prev, [selectedDateStr]: prev[selectedDateStr].map(t => (t.is_ready && !t.is_completed && t.author_id === currentUserId) ? { ...t, is_completed: true } : t) }));
    await Promise.all(tasksToConfirm.map(t => supabase.from('checklist_items').update({ is_completed: true }).eq('id', t.id)));
  };

  const addTaskToDatabase = async (taskText: string, taskPoints: number) => {
    if (!spaceId || !currentUserId) return;
    if (!partnerId) { alert("Партнер еще не присоединился к вашему пространству!"); return; }

    let { data: checklist } = await supabase.from('checklists').select('id').eq('space_id', spaceId).eq('date', selectedDateStr).maybeSingle();
    if (!checklist) {
      const { data: nC } = await supabase.from('checklists').insert({ space_id: spaceId, user_id: currentUserId, target_user_id: partnerId, date: selectedDateStr }).select('id').single();
      checklist = nC;
    }

    if (checklist) {
      await supabase.from('checklist_items').insert({ checklist_id: checklist.id, space_id: spaceId, user_id: currentUserId, content: taskText, points: taskPoints, sort_order: allCurrentTasks.length, is_ready: false, is_completed: false });
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    await addTaskToDatabase(newTaskText.trim(), newTaskPoints);
    fetchMonthActivity();
    setNewTaskText(''); setNewTaskPoints(1); setIsAddingTask(false);
  };

  // --- ЛОГИКА ШАБЛОНОВ И НАБОРОВ ---
  const handleSaveTemplate = async () => {
    if (!newTaskText.trim() || !spaceId || !currentUserId) return;
    const { data } = await supabase.from('task_templates').insert({
      space_id: spaceId, user_id: currentUserId, content: newTaskText.trim(), points: newTaskPoints
    }).select('id, content, points').single();
    if (data) setTemplates(prev => [...prev, data]);
  };

  const handleSaveSet = async () => {
    if (!newSetTitle.trim() || newSetTasks.some(t => !t.content.trim()) || !spaceId || !currentUserId) {
      alert("Заполните название набора и все задачи."); return;
    }
    const total = newSetTasks.reduce((sum, t) => sum + (Number(t.points) || 0), 0);
    const payload = JSON.stringify({ isSet: true, title: newSetTitle.trim(), tasks: newSetTasks.filter(t => t.content.trim()) });
    
    const { data } = await supabase.from('task_templates').insert({
      space_id: spaceId, user_id: currentUserId, content: payload, points: total
    }).select('id, content, points').single();

    if (data) {
      const parsed = JSON.parse(data.content);
      setTemplateSets(prev => [...prev, { id: data.id, title: parsed.title, tasks: parsed.tasks, totalPoints: data.points }]);
      setIsCreatingSet(false); setNewSetTitle(''); setNewSetTasks([{ content: '', points: 1 }]);
    }
  };

  const handleUseTemplateSet = async (set: TemplateSet) => {
    for (const task of set.tasks) { await addTaskToDatabase(task.content, task.points); }
    fetchMonthActivity();
    setIsAddingTask(false);
  };

  const handleDeleteTemplate = async (templateId: string, isSet: boolean = false) => {
    await supabase.from('task_templates').delete().eq('id', templateId);
    if (isSet) setTemplateSets(prev => prev.filter(t => t.id !== templateId));
    else setTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  const handleDeleteTask = async (taskId: string) => {
    await supabase.from('checklist_items').delete().eq('id', taskId);
    setTasksByDate(prev => ({ ...prev, [selectedDateStr]: prev[selectedDateStr].filter(t => t.id !== taskId) }));
  };

  const getDayStyle = (dateStr: string) => {
    const data = monthData.find(d => d.date === dateStr);
    if (!data || data.metrics.length === 0) return { backgroundColor: 'transparent' };

    const myMetric = data.metrics.find(m => m.user_id === currentUserId);
    const partnerMetric = data.metrics.find(m => m.user_id !== currentUserId);

    const myScore = myMetric?.mood_score ?? null;
    const partnerScore = partnerMetric?.mood_score ?? null;

    const myOpacity = myScore !== null ? (myScore / 10) * 0.8 : 0;
    const partnerOpacity = partnerScore !== null ? (partnerScore / 10) * 0.8 : 0;

    const myColor = `rgba(230, 57, 70, ${myOpacity})`;
    const partnerColor = `rgba(17, 24, 39, ${partnerOpacity})`; // gray-900

    if (viewMode === 'my') return { backgroundColor: myMetric && myScore !== null ? myColor : 'transparent' };
    if (viewMode === 'partner') return { backgroundColor: partnerMetric && partnerScore !== null ? partnerColor : 'transparent' };
    
    if (myMetric && myScore !== null && partnerMetric && partnerScore !== null) {
      return { background: `linear-gradient(90deg, ${myColor} 50%, ${partnerColor} 50%)` };
    }
    
    if (myMetric && myScore !== null) return { backgroundColor: myColor };
    if (partnerMetric && partnerScore !== null) return { backgroundColor: partnerColor };
    
    return { backgroundColor: 'transparent' };
  };

  if (isAuthLoading) return <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-400 text-sm font-medium animate-pulse">Загрузка...</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Общая шапка (Новый швейцарский стиль) */}
      <div className="flex items-center justify-between border-b border-gray-100 p-4 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 capitalize">
            {format(currentMonth, 'LLLL yyyy', { locale: ru })}
          </h2>
          <div className="flex bg-gray-50 border border-gray-200 rounded-xl overflow-hidden p-0.5">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 hover:text-gray-900 transition-all cursor-pointer">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 hover:text-gray-900 transition-all cursor-pointer">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="hidden sm:flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setViewMode('my')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${viewMode === 'my' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Я</button>
          <button onClick={() => setViewMode('partner')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${viewMode === 'partner' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Партнер</button>
          <button onClick={() => setViewMode('combined')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${viewMode === 'combined' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Оба</button>
        </div>
        
        <div className="flex items-center gap-6">
          {isDataLoading && <span className="text-xs font-medium text-gray-400 animate-pulse">Синхронизация...</span>}
          {inviteCode && (
            <div onClick={() => { navigator.clipboard.writeText(inviteCode); alert('Код скопирован'); }} className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-900 transition-all cursor-pointer bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300">
              <span className="hidden sm:inline">Код:</span> 
              <strong className="text-terra-600 font-semibold">{inviteCode}</strong>
              <Copy className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-grow flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* ЛЕВАЯ ПАНЕЛЬ: Календарь */}
        <div className="flex-grow flex flex-col bg-gray-50 border-r border-gray-100 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100 bg-white/40 shrink-0">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
              <div key={day} className="py-3 text-xs font-semibold text-gray-400 text-center">{day}</div>
            ))}
          </div>

          <div className="flex-grow overflow-y-auto bg-white">
            <div className="grid grid-cols-7 auto-rows-[minmax(110px,1fr)]">
              {days.map((day, idx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayInfo = monthData.find(d => d.date === dateStr);
                const isSelected = isSameDay(day, selectedDate);
                const hasTasks = (tasksByDate[dateStr] || []).length > 0;
                
                const myM = dayInfo?.metrics.find(m => m.user_id === currentUserId);
                const partnerM = dayInfo?.metrics.find(m => m.user_id !== currentUserId);

                const showMyConflict = (viewMode === 'my' || viewMode === 'combined') && myM?.has_conflict;
                const showPartnerConflict = (viewMode === 'partner' || viewMode === 'combined') && partnerM?.has_conflict;

                return (
                  <button
                    key={dateStr}
                    onClick={() => { setSelectedDate(day); setIsAddingTask(false); setIsCreatingSet(false); }}
                    className={`relative p-4 flex flex-col items-start justify-between border-b border-r border-gray-100 transition-all duration-200 group cursor-pointer ${isSelected ? 'shadow-inner ring-2 ring-inset ring-terra-500 z-10' : 'hover:opacity-90'}`}
                    style={{ ...getDayStyle(dateStr), gridColumnStart: idx === 0 ? (day.getDay() === 0 ? 7 : day.getDay()) : 'auto' }}
                  >
                    <div className="flex justify-between w-full z-10">
                      <span className={`text-lg font-medium ${isToday(day) ? 'text-terra-600 font-bold underline' : 'text-gray-400 group-hover:text-gray-600'}`}>
                        {format(day, 'd')}
                      </span>
                      {viewMode === 'combined' && (myM || partnerM) && <div className="text-[10px] text-gray-400 font-medium mt-1">Me | P</div>}
                    </div>

                    {(showMyConflict || showPartnerConflict) && (
                      <div className="absolute inset-0 opacity-[0.05] pointer-events-none z-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '7px 7px' }} />
                    )}
                    
                    <div className="flex w-full justify-between items-end z-30 mt-auto">
                      {(viewMode === 'my' || viewMode === 'combined') ? (
                        <div className="flex gap-1 items-center w-1/3">
                          {myM?.has_intimacy && <Heart className="w-2.5 h-2.5 text-terra-600 fill-terra-600" />}
                          {myM?.has_conflict && <Zap className="w-2.5 h-2.5 text-gray-900" />}
                        </div>
                      ) : <div className="w-1/3" />}

                      <div className="flex flex-col items-center gap-1 opacity-40 w-1/3">
                        {dayInfo?.hasSurprise && <Sparkles className="w-2.5 h-2.5 text-terra-500 fill-terra-500" />}
                        {hasTasks && <div className="w-1.5 h-1.5 bg-gray-900 rounded-full" />}
                      </div>

                      {(viewMode === 'partner' || viewMode === 'combined') ? (
                        <div className="flex gap-1 items-center justify-end w-1/3">
                          {partnerM?.has_conflict && <Zap className="w-2.5 h-2.5 text-white drop-shadow-sm" />}
                          {partnerM?.has_intimacy && <Heart className="w-2.5 h-2.5 text-gray-900 fill-gray-900 opacity-60" />}
                        </div>
                      ) : <div className="w-1/3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ПРАВАЯ ПАНЕЛЬ */}
        <aside className="w-full lg:w-[420px] flex flex-col bg-white overflow-y-auto border-l border-gray-100">
          <AnimatePresence mode="wait">
            <motion.div key={selectedDate.toString()} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 sm:p-8 space-y-8">
              
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-gray-900 capitalize">{format(selectedDate, 'd MMMM', { locale: ru })}</h3>
                  {totalPoints > 0 && <span className="text-xs font-medium text-terra-600 bg-terra-50 px-2.5 py-1 rounded-md">+{earnedPoints} / {totalPoints}</span>}
                </div>
                <p className="text-sm text-gray-400 font-medium">Детали дня</p>
              </div>

              {/* Блок Настроения */}
              <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-5">Твоё настроение</p>
                <div className="flex items-center gap-5 mb-6">
                  {/* Показываем прочерк, если null */}
                  <span className="text-4xl font-bold text-gray-900 w-10 text-center">
                    {myMood !== null ? myMood : '-'}
                  </span>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={myMood || 5} // Если null, ставим ползунок посередине
                    onChange={(e) => { 
                      const val = Number(e.target.value);
                      setMyMood(val); 
                      saveMetrics(val, myIntimacy, myConflict); 
                    }} 
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-terra-500" 
                  />
                  {/* Кнопка очистки (крестик) */}
                  {myMood !== null && (
                    <button 
                      onClick={() => {
                        setMyMood(null);
                        saveMetrics(null, myIntimacy, myConflict);
                      }}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                      title="Сбросить настроение"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <div className="flex gap-4">
                  <div className="relative group">
                    <button onClick={() => { setMyIntimacy(!myIntimacy); saveMetrics(myMood, !myIntimacy, myConflict); }} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${myIntimacy ? 'bg-terra-500 text-white shadow-md shadow-terra-500/20' : 'bg-white border border-gray-200 text-gray-400 hover:border-terra-300 hover:text-terra-500'}`}><Heart className={`w-5 h-5 ${myIntimacy ? 'fill-white' : ''}`} /></button>
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">Близость</span>
                  </div>
                  <div className="relative group">
                    <button onClick={() => { setMyConflict(!myConflict); saveMetrics(myMood, myIntimacy, !myConflict); }} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${myConflict ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-900 hover:text-gray-900'}`}><Zap className="w-5 h-5" /></button>
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">Конфликт</span>
                  </div>
                </div>
              </div>

              {/* Табы Задач */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button onClick={() => { setActiveTab('my'); setIsAddingTask(false); setIsCreatingSet(false); }} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'my' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Мои задачи</button>
                <button onClick={() => { setActiveTab('partner'); setIsAddingTask(false); setIsCreatingSet(false); }} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'partner' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Задачи партнера</button>
              </div>

              {activeTab === 'partner' && pendingPoints > 0 && (
                <div className="flex items-center justify-between bg-orange-50 border border-orange-100 p-4 rounded-xl">
                  <div>
                    <span className="text-sm font-medium text-orange-800 block">Ждут проверки</span>
                    <span className="text-xs text-orange-600">На сумму +{pendingPoints} баллов</span>
                  </div>
                  <button onClick={handleReviewDay} className="text-sm font-medium bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors shadow-sm cursor-pointer">Подтвердить всё</button>
                </div>
              )}

              {/* Список задач */}
              <div className="space-y-3">
                {displayedTasks.map(task => {
                  const isMyTab = activeTab === 'my';
                  const isCompleted = task.is_completed;
                  const isWaiting = task.is_ready && !isCompleted;
                  const isChecked = isCompleted || (isMyTab && task.is_ready);

                  return (
                    <div key={task.id} className="group flex items-start gap-3 relative">
                      <label className={`flex-1 flex items-start gap-3 p-4 rounded-xl border transition-colors ${isCompleted ? 'bg-gray-50 border-transparent' : isWaiting ? 'bg-orange-50/30 border-orange-200' : 'bg-white border-gray-200 hover:border-gray-300'} ${isCompleted ? 'cursor-default' : 'cursor-pointer'}`}>
                        <div className="mt-0.5">
                          <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-terra-500 focus:ring-terra-500 cursor-pointer" checked={isChecked} disabled={isCompleted} onChange={() => { if (isMyTab) handleToggleReady(task.id, task.is_ready); else handleToggleCompleted(task.id, task.is_completed); }} />
                        </div>
                        <div className="flex-1">
                          <span className={`text-base font-medium transition-colors ${isChecked ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.content}</span>
                          {isWaiting && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span></span>
                              <span className="text-xs font-medium text-orange-600">Ожидает проверки</span>
                            </div>
                          )}
                        </div>
                        <span className={`text-sm font-semibold px-2 py-1 rounded-md ${isChecked ? 'bg-gray-100 text-gray-400' : 'bg-terra-50 text-terra-600'}`}>+{task.points}</span>
                      </label>
                      {!isMyTab && !isCompleted && (
                        <button onClick={() => handleDeleteTask(task.id)} className="absolute -right-2 -top-2 bg-white border border-gray-200 rounded-full p-1.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:border-red-200 transition-all cursor-pointer shadow-sm"><X className="w-3 h-3" /></button>
                      )}
                    </div>
                  );
                })}
                {displayedTasks.length === 0 && !isAddingTask && <p className="text-sm text-gray-400 text-center py-8">{activeTab === 'my' ? 'Партнер еще не назначил задачи' : 'Задач пока нет'}</p>}
              </div>

              {/* УПРАВЛЕНИЕ ЗАДАЧАМИ И НАБОРАМИ */}
              {activeTab === 'partner' && (
                <div className="pt-4 border-t border-gray-100 space-y-6">
                  
                  {!isAddingTask && !isCreatingSet && (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setIsAddingTask(true)} className="py-3 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors flex justify-center items-center gap-2 cursor-pointer">
                        <Plus className="w-4 h-4 text-terra-500" /> Разовая задача
                      </button>
                      <button onClick={() => setIsCreatingSet(true)} className="py-3 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors flex justify-center items-center gap-2 cursor-pointer">
                        <ListPlus className="w-4 h-4 text-gray-400" /> Создать набор
                      </button>
                    </div>
                  )}

                  {/* Форма: Создать разовую задачу */}
                  {isAddingTask && !isCreatingSet && (
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900">Новая задача</h4>
                      <form onSubmit={handleAddTask} className="flex gap-2">
                        <input type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder="Что нужно сделать?" className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terra-500/20 focus:border-terra-500 transition-shadow text-gray-900" autoFocus />
                        <div className="bg-white border border-gray-200 rounded-xl flex items-center px-2">
                          <span className="text-gray-400 text-sm font-medium">+</span>
                          <input type="number" min="1" max="999" value={newTaskPoints} onChange={e => setNewTaskPoints(Number(e.target.value))} className="w-10 bg-transparent text-sm font-semibold text-terra-600 text-center outline-none" />
                        </div>
                      </form>
                      <div className="flex items-center justify-between pt-2">
                        <button type="button" onClick={handleSaveTemplate} disabled={!newTaskText.trim()} className="text-xs font-medium text-gray-500 hover:text-terra-600 disabled:opacity-30 flex items-center gap-1"><BookmarkPlus className="w-4 h-4" /> В шаблоны</button>
                        <div className="flex gap-2">
                          <button onClick={() => setIsAddingTask(false)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-200 rounded-lg">Отмена</button>
                          <button onClick={handleAddTask} className="px-4 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-black rounded-lg">Добавить</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Форма: Создать набор шаблонов */}
                  {isCreatingSet && (
                    <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-gray-200 space-y-5">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Название набора</label>
                        <input type="text" value={newSetTitle} onChange={e => setNewSetTitle(e.target.value)} placeholder="Например: Уборка перед гостями" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-terra-500 font-semibold" autoFocus />
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Задачи в наборе</label>
                        {newSetTasks.map((t, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input value={t.content} onChange={e => { const updated = [...newSetTasks]; updated[idx].content = e.target.value; setNewSetTasks(updated); }} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-terra-400 outline-none" placeholder={`Шаг ${idx + 1}`} />
                            <div className="bg-white border border-gray-200 rounded-lg flex items-center px-2">
                              <span className="text-gray-400 text-xs">+</span>
                              <input type="number" min="1" value={t.points} onChange={e => { const updated = [...newSetTasks]; updated[idx].points = Number(e.target.value); setNewSetTasks(updated); }} className="w-10 py-2 text-sm font-semibold text-terra-600 text-center outline-none" />
                            </div>
                            {newSetTasks.length > 1 && (
                              <button onClick={() => setNewSetTasks(newSetTasks.filter((_, i) => i !== idx))} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => setNewSetTasks([...newSetTasks, { content: '', points: 1 }])} className="text-sm text-terra-600 font-medium flex items-center gap-1.5 py-2 hover:opacity-80 transition-opacity"><Plus className="w-4 h-4" /> Добавить шаг</button>
                      </div>
                      <div className="flex gap-3 pt-2 border-t border-gray-100">
                        <button onClick={() => setIsCreatingSet(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-xl">Отмена</button>
                        <button onClick={handleSaveSet} className="flex-1 py-2.5 text-sm font-medium bg-gray-900 text-white hover:bg-black rounded-xl">Сохранить набор</button>
                      </div>
                    </div>
                  )}

                  {/* Отображение сохраненных Наборов и Шаблонов */}
                  {!isAddingTask && !isCreatingSet && (templateSets.length > 0 || templates.length > 0) && (
                    <div className="space-y-5">
                      
                      {templateSets.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-500">Ваши наборы</p>
                          <div className="grid grid-cols-1 gap-3">
                            {templateSets.map(set => (
                              <div key={set.id} className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm flex flex-col group relative">
                                <div className="flex justify-between items-start mb-2 pr-4">
                                  <h4 className="font-semibold text-gray-900">{set.title}</h4>
                                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md">{set.tasks.length} задач</span>
                                </div>
                                <div className="text-sm text-gray-500 mb-4 line-clamp-2">
                                  {set.tasks.map(t => t.content).join(' • ')}
                                </div>
                                <button onClick={() => handleUseTemplateSet(set)} className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                                  <CheckCircle2 className="w-4 h-4" /> Добавить весь набор (+{set.totalPoints})
                                </button>
                                <button onClick={() => handleDeleteTemplate(set.id, true)} className="absolute -top-2 -right-2 bg-white border border-gray-200 p-1.5 rounded-full text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"><X className="w-4 h-4"/></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {templates.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-500">Одиночные шаблоны</p>
                          <div className="flex flex-wrap gap-2">
                            {templates.map(t => (
                              <button key={t.id} onClick={() => { addTaskToDatabase(t.content, t.points); fetchMonthActivity(); }} className="group relative text-sm font-medium bg-white border border-gray-200 px-3 py-2 rounded-xl hover:border-terra-300 hover:text-terra-600 transition-colors cursor-pointer flex items-center gap-1.5 pr-8 shadow-sm">
                                <span className="text-terra-500 font-bold">+{t.points}</span> {t.content}
                                <span onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id, false); }} className="absolute right-2 p-1 text-gray-300 hover:text-red-500 rounded-md transition-colors"><X className="w-3.5 h-3.5" /></span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}