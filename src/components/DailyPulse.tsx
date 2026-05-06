'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp, 
  CheckCircle2, 
  Plus, 
  X, 
  Copy, 
  Heart, 
  Zap, 
  Sparkles, 
  Trash2, 
  ListPlus,
  Lock
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

// ── Интерфейсы ──────────────────────────────────────────────────────────

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
  mood_score: number | null;
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

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSets, setTemplateSets] = useState<TemplateSet[]>([]);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<'my' | 'partner'>('my');
  const [viewMode, setViewMode] = useState<'my' | 'partner' | 'combined'>('combined');
  const [tasksByDate, setTasksByDate] = useState<Record<string, Task[]>>({});
  
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPoints, setNewTaskPoints] = useState<number>(1);

  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [newSetTitle, setNewSetTitle] = useState('');
  const [newSetTasks, setNewSetTasks] = useState<TemplateTask[]>([{ content: '', points: 1 }]);

  // Локальные состояния для метрик дня
  const [myMood, setMyMood] = useState<number>(5);
  const [myIntimacy, setMyIntimacy] = useState(false);
  const [myConflict, setMyConflict] = useState(false);
  const [partnerMood, setPartnerMood] = useState<number | null>(null);

  // Состояние для блокировки спам-кликов по задачам
  const [processingTasks, setProcessingTasks] = useState<Set<string>>(new Set());

  const days = useMemo(() => eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  }), [currentMonth]);

  // ── Логика получения данных ──────────────────────────────────────────

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
            singles.push(item);
          }
        });
        setTemplates(singles);
        setTemplateSets(sets);
      }
    }
    fetchTemplates();
  }, [spaceId, currentUserId]);

  const fetchMonthActivity = useCallback(async () => {
    if (isAuthLoading || !spaceId || !currentUserId) { setIsDataLoading(false); return; }
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

  useEffect(() => {
    if (!isAuthLoading && spaceId) {
      fetchMonthActivity();
    }
  }, [fetchMonthActivity, isAuthLoading, spaceId]);

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayData = monthData.find(d => d.date === dateStr);
    
    const myTodayMetric = dayData?.metrics.find(m => m.user_id === currentUserId);
    const partnerTodayMetric = dayData?.metrics.find(m => m.user_id !== currentUserId);

    setMyMood(myTodayMetric?.mood_score ?? 5);
    setMyIntimacy(myTodayMetric?.has_intimacy ?? false);
    setMyConflict(myTodayMetric?.has_conflict ?? false);
    setPartnerMood(partnerTodayMetric?.mood_score ?? null);
  }, [selectedDate, monthData, currentUserId]);

  // ── Обработчики (Защищенные от спама и рассинхрона) ──────────────────

  const saveMetrics = async (val: number | null, intim: boolean, conf: boolean) => {
    if (!spaceId || !currentUserId) return;
    await supabase.from('daily_metrics').upsert({
      space_id: spaceId, user_id: currentUserId, date: format(selectedDate, 'yyyy-MM-dd'), mood_score: val, has_intimacy: intim, has_conflict: conf
    }, { onConflict: 'user_id, date' });
    fetchMonthActivity();
  };

  const handleToggleReady = async (taskId: string, currentReady: boolean) => {
    if (processingTasks.has(taskId)) return; // Блокировка от спам-кликов
    setProcessingTasks(prev => new Set(prev).add(taskId));

    // Оптимистичный UI
    setTasksByDate(prev => ({ ...prev, [selectedDateStr]: prev[selectedDateStr].map(t => t.id === taskId ? { ...t, is_ready: !currentReady } : t) }));
    
    const { data, error } = await supabase.from('checklist_items')
      .update({ is_ready: !currentReady })
      .eq('id', taskId)
      .select('id');

    if (error || !data || data.length === 0) {
      alert('Не удалось обновить. Похоже, партнер изменил эту задачу.');
      fetchMonthActivity();
    }

    setProcessingTasks(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  const handleToggleCompleted = async (taskId: string, currentCompleted: boolean) => {
    if (processingTasks.has(taskId)) return;
    setProcessingTasks(prev => new Set(prev).add(taskId));

    setTasksByDate(prev => ({ ...prev, [selectedDateStr]: prev[selectedDateStr].map(t => t.id === taskId ? { ...t, is_completed: !currentCompleted } : t) }));
    
    const { data, error } = await supabase.from('checklist_items')
      .update({ is_completed: !currentCompleted })
      .eq('id', taskId)
      .select('id');

    if (error || !data || data.length === 0) {
      alert('Ошибка синхронизации: задача была изменена партнером.');
      fetchMonthActivity(); 
    }

    setProcessingTasks(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  const handleReviewDay = async () => {
    const tasksToConfirm = partnerTasks.filter(t => t.is_ready && !t.is_completed);
    if (tasksToConfirm.length === 0) return;
    
    setTasksByDate(prev => ({ ...prev, [selectedDateStr]: prev[selectedDateStr].map(t => (t.is_ready && !t.is_completed && t.author_id === currentUserId) ? { ...t, is_completed: true } : t) }));
    
    const taskIds = tasksToConfirm.map(t => t.id);
    const { data, error } = await supabase.from('checklist_items')
      .update({ is_completed: true })
      .in('id', taskIds)
      .select('id');

    if (error || !data || data.length !== taskIds.length) {
       fetchMonthActivity();
    }
  };

  const addTaskToDatabase = async (taskText: string, taskPoints: number) => {
    if (!spaceId || !currentUserId || !partnerId) return;
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

  const handleSaveSet = async () => {
    if (!spaceId || !currentUserId || !newSetTitle.trim()) return;
    const validTasks = newSetTasks.filter(t => t.content.trim() !== '');
    if (validTasks.length === 0) return;

    const totalPoints = validTasks.reduce((sum, t) => sum + t.points, 0);
    const contentStr = JSON.stringify({ isSet: true, title: newSetTitle.trim(), tasks: validTasks });

    const { data, error } = await supabase.from('task_templates').insert({
      space_id: spaceId,
      user_id: currentUserId,
      content: contentStr,
      points: totalPoints
    }).select('id, content, points').single();

    if (data && !error) {
      setTemplateSets(prev => [...prev, { id: data.id, title: newSetTitle.trim(), tasks: validTasks, totalPoints }]);
      setIsCreatingSet(false);
      setNewSetTitle('');
      setNewSetTasks([{ content: '', points: 1 }]);
    }
  };

  const handleUseTemplateSet = async (set: TemplateSet) => {
    if (!spaceId || !currentUserId || !partnerId) return;
    let { data: checklist } = await supabase.from('checklists').select('id').eq('space_id', spaceId).eq('date', selectedDateStr).maybeSingle();
    if (!checklist) {
      const { data: nC } = await supabase.from('checklists').insert({ space_id: spaceId, user_id: currentUserId, target_user_id: partnerId, date: selectedDateStr }).select('id').single();
      checklist = nC;
    }
    if (checklist) {
      const items = set.tasks.map((task, index) => ({
        checklist_id: checklist.id,
        space_id: spaceId,
        user_id: currentUserId,
        content: task.content,
        points: task.points,
        sort_order: allCurrentTasks.length + index,
        is_ready: false,
        is_completed: false
      }));
      await supabase.from('checklist_items').insert(items);
      fetchMonthActivity();
      setIsAddingTask(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string, isSet: boolean = false) => {
    await supabase.from('task_templates').delete().eq('id', templateId);
    if (isSet) setTemplateSets(prev => prev.filter(t => t.id !== templateId));
    else setTemplates(prev => prev.filter(t => t.id !== templateId));
  };

  const handleDeleteTask = async (taskId: string) => {
    if (processingTasks.has(taskId)) return;
    setProcessingTasks(prev => new Set(prev).add(taskId));

    setTasksByDate(prev => ({ ...prev, [selectedDateStr]: prev[selectedDateStr].filter(t => t.id !== taskId) }));
    await supabase.from('checklist_items').delete().eq('id', taskId);

    setProcessingTasks(prev => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  const toggleExpandedSet = (setId: string) => {
    setExpandedSets(prev => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  };

  // ── Вспомогательные функции UI ────────────────────────────────────────

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const allCurrentTasks = tasksByDate[selectedDateStr] || [];
  const myTasks = allCurrentTasks.filter(t => t.author_id !== currentUserId);
  const partnerTasks = allCurrentTasks.filter(t => t.author_id === currentUserId);
  const displayedTasks = activeTab === 'my' ? myTasks : partnerTasks;

  const earnedPoints = displayedTasks.filter(t => t.is_completed).reduce((sum, t) => sum + t.points, 0);
  const pendingPoints = displayedTasks.filter(t => t.is_ready && !t.is_completed).reduce((sum, t) => sum + t.points, 0);
  const totalPoints = displayedTasks.reduce((sum, t) => sum + t.points, 0);

  // Состояние синхронизации метрик
  const dayDataLocal = monthData.find(d => d.date === selectedDateStr);
  const mySavedMetric = dayDataLocal?.metrics.find(m => m.user_id === currentUserId);
  const savedMood = mySavedMetric?.mood_score ?? null;
  const savedInt = mySavedMetric?.has_intimacy ?? false;
  const savedConf = mySavedMetric?.has_conflict ?? false;

  // Проверка: есть ли несохраненные изменения
  const isMetricsChanged = myMood !== (savedMood ?? 5) || myIntimacy !== savedInt || myConflict !== savedConf || savedMood === null;

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
    const partnerColor = `rgba(17, 24, 39, ${partnerOpacity})`; 
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
      {/* ── Адаптивная шапка календаря ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-b border-gray-100 p-4 bg-white shrink-0 gap-4 sm:gap-0">
        
        {/* Месяц и стрелки */}
        <div className="flex items-center justify-between w-full sm:w-auto">
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
        </div>

        {/* Переключатели режимов */}
        <div className="flex w-full sm:w-auto bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setViewMode('my')} className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${viewMode === 'my' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Я</button>
          <button onClick={() => setViewMode('partner')} className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${viewMode === 'partner' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Партнер</button>
          <button onClick={() => setViewMode('combined')} className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${viewMode === 'combined' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Оба</button>
        </div>
        
        {/* Инвайт код */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          {isDataLoading ? (
            <span className="text-xs font-medium text-gray-400 animate-pulse">Синхронизация...</span>
          ) : <div />}
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
        {/* ── Сетка календаря ───────────────────────────────────────────── */}
        <div className="flex-grow flex flex-col bg-gray-50 border-r border-gray-100 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100 bg-white/40 shrink-0">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
              <div key={day} className="py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-400 text-center">{day}</div>
            ))}
          </div>

          <div className="flex-grow overflow-y-auto bg-white">
            <div className="grid grid-cols-7 auto-rows-[minmax(70px,1fr)] sm:auto-rows-[minmax(110px,1fr)]">
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
                    className={`relative p-1.5 sm:p-4 flex flex-col items-start justify-between border-b border-r border-gray-100 transition-all duration-200 group cursor-pointer ${isSelected ? 'shadow-inner ring-2 ring-inset ring-terra-500 z-10' : 'hover:opacity-90'}`}
                    style={{ ...getDayStyle(dateStr), gridColumnStart: idx === 0 ? (day.getDay() === 0 ? 7 : day.getDay()) : 'auto' }}
                  >
                    <div className="flex justify-between w-full z-10">
                      <span className={`text-sm sm:text-lg font-medium ${isToday(day) ? 'text-terra-600 font-bold underline' : 'text-gray-400 group-hover:text-gray-600'}`}>
                        {format(day, 'd')}
                      </span>
                    </div>

                    {(showMyConflict || showPartnerConflict) && (
                      <div className="absolute inset-0 opacity-[0.05] pointer-events-none z-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '7px 7px' }} />
                    )}

                    <div className="flex w-full justify-between items-end z-30 mt-auto">
                      {(viewMode === 'my' || viewMode === 'combined') ? (
                        <div className="flex flex-wrap gap-0.5 sm:gap-1 items-center w-1/3">
                          {myM?.has_intimacy && <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-terra-600 fill-terra-600" />}
                          {myM?.has_conflict && <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-gray-900" />}
                        </div>
                      ) : <div className="w-1/3" />}

                      <div className="flex flex-col items-center gap-0.5 sm:gap-1 opacity-40 w-1/3">
                        {dayInfo?.hasSurprise && <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-terra-500 fill-terra-500" />}
                        {hasTasks && <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-gray-900 rounded-full" />}
                      </div>

                      {(viewMode === 'partner' || viewMode === 'combined') ? (
                        <div className="flex flex-wrap gap-0.5 sm:gap-1 items-center justify-end w-1/3">
                          {partnerM?.has_conflict && <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-white drop-shadow-sm" />}
                          {partnerM?.has_intimacy && <Heart className="w-3 h-3 sm:w-4 sm:h-4 text-gray-900 fill-gray-900 opacity-60" />}
                        </div>
                      ) : <div className="w-1/3" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Правая панель с задачами ───────────────────────────────────── */}
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

              {/* Настроение */}
              <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                <div className="flex justify-between items-center mb-5">
                  <p className="text-sm font-medium text-gray-500">Твоё настроение</p>
                  
                  {/* Логика показа партнера */}
                  {partnerMood !== null && (
                    savedMood !== null ? (
                      <div className="text-xs font-semibold px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg flex items-center gap-1.5 shadow-sm">
                        Партнер: <span className="text-gray-900">{partnerMood}/10</span>
                      </div>
                    ) : (
                      <div className="text-xs font-semibold px-2.5 py-1 bg-gray-100 border border-gray-200 text-gray-400 rounded-lg flex items-center gap-1.5 shadow-inner cursor-help" title="Отправьте свое настроение, чтобы увидеть оценку партнера">
                        Партнер: <span className="blur-[3px] select-none text-gray-800">5/10</span>
                        <Lock className="w-3 h-3 text-gray-400 ml-0.5" />
                      </div>
                    )
                  )}
                </div>

                <div className="flex items-center gap-5 mb-6">
                  <span className="text-4xl font-bold text-gray-900 w-10 text-center">{myMood}</span>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={myMood} 
                    onChange={(e) => setMyMood(Number(e.target.value))} 
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-terra-500" 
                  />
                  {savedMood !== null && (
                    <button 
                      onClick={() => { setMyMood(5); saveMetrics(null, myIntimacy, myConflict); }} 
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                      title="Сбросить оценку"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-4 items-center">
                  <button onClick={() => setMyIntimacy(!myIntimacy)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${myIntimacy ? 'bg-white border-2 border-terra-500 text-terra-500 shadow-md' : 'bg-white border border-gray-200 text-gray-400'}`}>
                    <Heart className={`w-5 h-5 ${myIntimacy ? 'fill-terra-500' : ''}`} />
                  </button>
                  <button onClick={() => setMyConflict(!myConflict)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${myConflict ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-400'}`}>
                    <Zap className="w-5 h-5" />
                  </button>
                  
                  {/* Кнопка отправки появляется при несохраненных изменениях */}
                  {isMetricsChanged && (
                    <button 
                      onClick={() => saveMetrics(myMood, myIntimacy, myConflict)} 
                      className="ml-auto px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors shadow-sm cursor-pointer"
                    >
                      {savedMood === null ? 'Отправить' : 'Обновить'}
                    </button>
                  )}
                </div>
              </div>

              {/* Список задач */}
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button onClick={() => { setActiveTab('my'); setIsAddingTask(false); }} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'my' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Мои задачи</button>
                <button onClick={() => { setActiveTab('partner'); setIsAddingTask(false); }} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'partner' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Задачи партнера</button>
              </div>

              {activeTab === 'partner' && pendingPoints > 0 && (
                <div className="flex items-center justify-between bg-orange-50 border border-orange-200 p-4 rounded-xl">
                  <div className="text-sm font-medium text-orange-900">Ждут проверки (+{pendingPoints})</div>
                  <button onClick={handleReviewDay} className="text-sm font-medium bg-orange-500 text-white px-4 py-2 rounded-lg cursor-pointer shadow-sm hover:bg-orange-600 transition-colors">Подтвердить всё</button>
                </div>
              )}

              <div className="space-y-3">
                {displayedTasks.map(task => {
                  const isMyTab = activeTab === 'my';
                  const isLocked = processingTasks.has(task.id);
                  
                  // Логика визуального выделения задач, ожидающих подтверждения
                  const isAwaitingMyConfirmation = !isMyTab && task.is_ready && !task.is_completed;
                  const isAwaitingPartnerConfirmation = isMyTab && task.is_ready && !task.is_completed;

                  // Чекбокс активен всегда для автора (Задачи партнера). 
                  // Для исполнителя (Мои задачи) - только пока партнер не подтвердил.
                  const isDisabled = (isMyTab && task.is_completed) || isLocked;
                  const isChecked = task.is_completed || (isMyTab && task.is_ready);

                  // Стилизация в зависимости от статуса
                  let taskBg = 'bg-white border-gray-200';
                  let textClass = 'text-gray-900';
                  let pointsClass = 'text-terra-600';

                  if (task.is_completed) {
                    taskBg = 'bg-gray-50 border-transparent';
                    textClass = 'text-gray-400 line-through';
                    pointsClass = 'text-gray-400';
                  } else if (isAwaitingMyConfirmation) {
                    taskBg = 'bg-orange-50 border-orange-200';
                    textClass = 'text-orange-900';
                    pointsClass = 'text-orange-600';
                  } else if (isAwaitingPartnerConfirmation) {
                    taskBg = 'bg-blue-50 border-blue-200';
                    textClass = 'text-blue-900';
                    pointsClass = 'text-blue-600';
                  }

                  return (
                    <div key={task.id} className={`group flex items-start gap-3 relative pr-8 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                      <label className={`flex-1 flex items-start gap-3 p-4 rounded-xl border transition-colors ${taskBg} cursor-pointer`}>
                        <input 
                          type="checkbox" 
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-terra-500 cursor-pointer disabled:opacity-50" 
                          checked={isChecked} 
                          disabled={isDisabled} 
                          onChange={() => { if (isMyTab) handleToggleReady(task.id, task.is_ready); else handleToggleCompleted(task.id, task.is_completed); }} 
                        />
                        <span className={`flex-1 text-base font-medium ${textClass}`}>
                          {task.content}
                          {isAwaitingMyConfirmation && <span className="block text-xs font-semibold opacity-70 mt-1">Ожидает вашего подтверждения</span>}
                          {isAwaitingPartnerConfirmation && <span className="block text-xs font-semibold opacity-70 mt-1">Ожидает подтверждения партнера</span>}
                        </span>
                        <span className={`text-sm font-semibold ${pointsClass}`}>+{task.points}</span>
                      </label>
                      {!isMyTab && !task.is_completed && (
                        <button 
                          onClick={() => handleDeleteTask(task.id)} 
                          disabled={isLocked}
                          className="absolute right-0 -top-1 bg-white border border-gray-200 rounded-full p-2 opacity-100 sm:opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 cursor-pointer shadow-sm transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Управление */}
              {activeTab === 'partner' && (
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  {/* Заглушка если нет партнера */}
                  {!partnerId ? (
                    <div className="bg-gray-50 border border-gray-200 border-dashed p-6 rounded-2xl flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                        <Heart className="w-5 h-5 text-gray-300" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Партнер еще в пути</h4>
                      <p className="text-xs text-gray-500 mb-4 max-w-[220px]">
                        Вы сможете назначать задачи, как только второй человек присоединится к пространству.
                      </p>
                      {inviteCode && (
                        <button 
                          onClick={() => { navigator.clipboard.writeText(inviteCode); alert('Код скопирован'); }} 
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-terra-300 hover:text-terra-600 rounded-xl text-sm font-medium transition-all text-gray-600 shadow-sm cursor-pointer"
                        >
                          Код: {inviteCode} <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {!isAddingTask && !isCreatingSet && (
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => setIsAddingTask(true)} className="py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 flex justify-center items-center gap-2 cursor-pointer hover:bg-gray-100 transition-colors"><Plus className="w-4 h-4 text-terra-500" /> Задача</button>
                          <button onClick={() => setIsCreatingSet(true)} className="py-3 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 flex justify-center items-center gap-2 cursor-pointer hover:bg-gray-100 transition-colors"><ListPlus className="w-4 h-4 text-gray-400" /> Набор</button>
                        </div>
                      )}

                      {isAddingTask && !isCreatingSet && (
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 space-y-4">
                          <form onSubmit={handleAddTask} className="flex gap-2">
                            <input type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder="Что нужно сделать?" className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-terra-500" autoFocus />
                            <input type="number" min="1" value={newTaskPoints} onChange={e => setNewTaskPoints(Number(e.target.value))} className="w-16 bg-white border border-gray-200 rounded-xl text-center text-sm font-semibold text-terra-600 outline-none" />
                          </form>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setIsAddingTask(false)} className="px-4 py-2 text-sm text-gray-500 cursor-pointer hover:bg-gray-200 rounded-lg transition-colors">Отмена</button>
                            <button onClick={handleAddTask} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg cursor-pointer hover:bg-black transition-colors">Добавить</button>
                          </div>
                        </div>
                      )}

                      {/* Секция создания набора */}
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
                                  <button onClick={() => setNewSetTasks(newSetTasks.filter((_, i) => i !== idx))} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"><Trash2 className="w-4 h-4" /></button>
                                )}
                              </div>
                            ))}
                            <button onClick={() => setNewSetTasks([...newSetTasks, { content: '', points: 1 }])} className="text-sm text-terra-600 font-medium flex items-center gap-1.5 py-2 hover:opacity-80 transition-opacity cursor-pointer"><Plus className="w-4 h-4" /> Добавить шаг</button>
                          </div>
                          <div className="flex gap-3 pt-2 border-t border-gray-100">
                            <button onClick={() => setIsCreatingSet(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">Отмена</button>
                            <button onClick={handleSaveSet} className="flex-1 py-2.5 text-sm font-medium bg-gray-900 text-white hover:bg-black rounded-xl transition-colors cursor-pointer">Сохранить набор</button>
                          </div>
                        </div>
                      )}

                      {/* Секция сохраненных шаблонов */}
                      {!isAddingTask && !isCreatingSet && templateSets.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm font-medium text-gray-500">Ваши наборы</p>
                          {templateSets.map(set => {
                            const isExpanded = expandedSets.has(set.id);
                            return (
                              <div key={set.id} className="border border-gray-200 rounded-2xl p-4 bg-white shadow-sm flex flex-col group relative">
                                <div 
                                  className="flex justify-between items-center mb-3 cursor-pointer select-none"
                                  onClick={() => toggleExpandedSet(set.id)}
                                >
                                  <h4 className="font-semibold text-gray-900">{set.title}</h4>
                                  <button className="text-gray-400 group-hover:text-gray-600 transition-colors">
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                </div>
                                
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden mb-3"
                                    >
                                      <div className="space-y-1.5 border-t border-gray-100 pt-3">
                                        {set.tasks.map((t, idx) => (
                                          <div key={idx} className="flex justify-between items-center text-sm px-3 py-2 bg-gray-50 rounded-lg">
                                            <span className="text-gray-600 truncate mr-2">{t.content}</span>
                                            <span className="font-semibold text-terra-600 shrink-0">+{t.points}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                <button onClick={() => handleUseTemplateSet(set)} className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-black transition-colors">
                                  <CheckCircle2 className="w-4 h-4" /> Добавить (+{set.totalPoints})
                                </button>
                                <button onClick={() => handleDeleteTemplate(set.id, true)} className="absolute -top-2 -right-2 bg-white border border-gray-200 p-1.5 rounded-full text-gray-400 opacity-100 sm:opacity-0 group-hover:opacity-100 hover:text-red-500 cursor-pointer shadow-sm transition-opacity">
                                  <X className="w-4 h-4"/>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
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