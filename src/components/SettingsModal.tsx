'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Archive, Eraser, Bomb, Loader2, User, Check } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, profile } = useSpaceAuth();

  // ── Состояние профиля ──
  const [displayName, setDisplayName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // ── Состояние выхода из пространства ──
  const [selectedMode, setSelectedMode] = useState<'archive' | 'wipe_mine' | 'destroy' | null>(null);
  const [isProcessingLeave, setIsProcessingLeave] = useState(false);

  // Подтягиваем текущее имя при открытии
  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [profile, isOpen]);

  // Функция сохранения имени
  const handleSaveName = async () => {
    if (!user?.id || !displayName.trim()) return;
    setIsSavingName(true);

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id);

    setIsSavingName(false);

    if (!error) {
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000); // Убираем галочку через 2 секунды
      // Внимание: чтобы имя обновилось в Хедере без перезагрузки страницы, 
      // тебе может потребоваться обновить страницу вручную разок, 
      // либо добавить подписку на изменение таблицы profiles в твой useSpaceAuth.
    } else {
      alert('Не удалось сохранить имя. Проверьте соединение.');
    }
  };

  // Функция выхода из пространства
  const handleLeaveSpace = async () => {
    if (!user?.id || !selectedMode) return;
    setIsProcessingLeave(true);

    try {
      const { error } = await supabase.rpc('leave_space', { 
        mode: selectedMode, 
        user_id: user.id 
      });

      if (error) throw error;
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Произошла ошибка при выходе из пространства.');
      setIsProcessingLeave(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
            <h2 className="text-xl font-semibold text-gray-900">Настройки</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-10">
            
            {/* ── Секция: Личный профиль ── */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Личный профиль</h3>
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 ml-1">Как вас называть?</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ваше имя"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-terra-400 outline-none transition-colors"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveName}
                  disabled={isSavingName || !displayName.trim() || displayName === profile?.display_name}
                  className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center min-w-[110px]"
                >
                  {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : nameSaved ? <><Check className="w-4 h-4 mr-1.5 text-green-400" /> Сохранено</> : 'Сохранить'}
                </button>
              </div>
            </section>

            {/* ── Секция: Опасная зона ── */}
            <section>
              <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-4">Управление пространством</h3>
              <p className="text-sm text-gray-500 mb-4">
                Выберите, что должно произойти с вашими общими данными, если вы решите уйти.
              </p>

              <div className="space-y-3">
                <button 
                  onClick={() => setSelectedMode('archive')}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 ${selectedMode === 'archive' ? 'border-terra-500 bg-terra-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                >
                  <div className={`mt-0.5 ${selectedMode === 'archive' ? 'text-terra-600' : 'text-gray-400'}`}><Archive className="w-5 h-5" /></div>
                  <div>
                    <div className={`font-semibold mb-1 ${selectedMode === 'archive' ? 'text-terra-700' : 'text-gray-900'}`}>Оставить на память</div>
                    <div className="text-xs text-gray-500 leading-relaxed">Вы отвяжетесь, но вся история, баллы и письма останутся доступны вашему партнеру.</div>
                  </div>
                </button>

                <button 
                  onClick={() => setSelectedMode('wipe_mine')}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 ${selectedMode === 'wipe_mine' ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                >
                  <div className={`mt-0.5 ${selectedMode === 'wipe_mine' ? 'text-orange-600' : 'text-gray-400'}`}><Eraser className="w-5 h-5" /></div>
                  <div>
                    <div className={`font-semibold mb-1 ${selectedMode === 'wipe_mine' ? 'text-orange-700' : 'text-gray-900'}`}>Забрать свое</div>
                    <div className="text-xs text-gray-500 leading-relaxed">Удалятся только созданные вами задачи, метрики и письма. Данные партнера не пострададут.</div>
                  </div>
                </button>

                <button 
                  onClick={() => setSelectedMode('destroy')}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 ${selectedMode === 'destroy' ? 'border-red-500 bg-red-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                >
                  <div className={`mt-0.5 ${selectedMode === 'destroy' ? 'text-red-600' : 'text-gray-400'}`}><Bomb className="w-5 h-5" /></div>
                  <div>
                    <div className={`font-semibold mb-1 ${selectedMode === 'destroy' ? 'text-red-700' : 'text-gray-900'}`}>Сжечь мосты</div>
                    <div className="text-xs text-gray-500 leading-relaxed">Пространство и абсолютно все данные внутри него будут навсегда удалены для вас обоих.</div>
                  </div>
                </button>
              </div>
            </section>

          </div>

          {/* ── Подвал с кнопками ── */}
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0">
            <button onClick={onClose} className="flex-1 py-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
              Закрыть
            </button>
            
            {selectedMode && (
              <button 
                onClick={handleLeaveSpace}
                disabled={isProcessingLeave}
                className="flex-1 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm shadow-red-600/20"
              >
                {isProcessingLeave ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Покинуть пространство'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}