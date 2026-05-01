'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Archive, Eraser, Bomb, Loader2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user } = useSpaceAuth();
  const [selectedMode, setSelectedMode] = useState<'archive' | 'wipe_mine' | 'destroy' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLeaveSpace = async () => {
    if (!user?.id || !selectedMode) return;
    setIsProcessing(true);

    try {
      // Вызываем нашу новую SQL-функцию
      const { error } = await supabase.rpc('leave_space', { 
        mode: selectedMode, 
        user_id: user.id 
      });

      if (error) throw error;
      
      // Перезагружаем страницу, чтобы очистить кэш и выкинуть юзера на экран создания/входа
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Произошла ошибка при выходе из пространства.');
      setIsProcessing(false);
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
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900">Покинуть пространство</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <p className="text-sm text-gray-500 mb-6">
              Выберите, что должно произойти с вашими общими данными, метриками и историей после того, как вы уйдете.
            </p>

            {/* Вариант 1: Архив */}
            <button 
              onClick={() => setSelectedMode('archive')}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 ${selectedMode === 'archive' ? 'border-terra-500 bg-terra-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
            >
              <div className={`mt-0.5 ${selectedMode === 'archive' ? 'text-terra-600' : 'text-gray-400'}`}><Archive className="w-5 h-5" /></div>
              <div>
                <div className={`font-semibold mb-1 ${selectedMode === 'archive' ? 'text-terra-700' : 'text-gray-900'}`}>Оставить на память</div>
                <div className="text-xs text-gray-500 leading-relaxed">Вы отвяжетесь от пространства, но вся история, баллы и письма останутся доступны вашему партнеру.</div>
              </div>
            </button>

            {/* Вариант 2: Стереть свое */}
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

            {/* Вариант 3: Уничтожить всё */}
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

          <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
              Отмена
            </button>
            <button 
              onClick={handleLeaveSpace}
              disabled={!selectedMode || isProcessing}
              className="flex-1 py-3 text-sm font-medium text-white bg-gray-900 hover:bg-black disabled:bg-gray-300 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Подтвердить'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}