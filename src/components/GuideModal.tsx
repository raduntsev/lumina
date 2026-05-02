'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Heart, Target, Store, Mail, Users, Copy, Check } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GuideModal({ isOpen, onClose }: GuideModalProps) {
  const { spaceId } = useSpaceAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isOpen && spaceId && !inviteCode) {
      supabase.from('spaces').select('invite_code').eq('id', spaceId).single()
        .then(({ data }) => {
          if (data) setInviteCode(data.invite_code);
        });
    }
  }, [isOpen, spaceId, inviteCode]);

  const handleCopyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const slides = [
    {
      icon: Heart,
      title: 'Добро пожаловать',
      content: (
        <div className="space-y-4 text-gray-600 text-sm leading-relaxed">
          <p>LuminaPulse — это ваше личное пространство для двоих. Мы создали это приложение, чтобы помочь вам легко организовывать общие дела, чаще замечать заботу друг друга и просто быть на связи в своем уютном уголке, вдали от шумных мессенджеров.</p>
          <p>Здесь вы можете вместе планировать день, радовать друг друга наградами за выполненные задачи и оставлять теплые послания.</p>
        </div>
      )
    },
    {
      icon: Target,
      title: 'Вы получаете баллы',
      content: (
        <div className="space-y-4 text-gray-600 text-sm leading-relaxed">
          <p>Вы можете создавать друг для друга списки дел. Выполнение каждой задачи приносит баллы. Это превращает обычные дела в легкую игру и помогает видеть, сколько сил каждый вкладывает в ваш общий быт.</p>
          
          <div className="bg-terra-50 p-4 sm:p-5 rounded-2xl border border-terra-100 space-y-3">
            <p className="font-semibold text-terra-800 text-xs mb-1">Как ставить задачи:</p>
            <p>🎯 <strong>Ясные просьбы:</strong> Вместо абстрактного «помоги по дому», лучше написать «Завари мне кофе утром».</p>
            <p>⚖️ <strong>Ценность усилий:</strong> Вынести мусор — 10 баллов. Разобраться с документами — 50 баллов.</p>
            <p>📦 <strong>Удобные наборы:</strong> Объединяйте мелкие дела. Например, «Уборка перед сном» (проветрить, расстелить кровать) — 30 баллов.</p>
          </div>
        </div>
      )
    },
    {
      icon: Store,
      title: 'Магазин наград',
      content: (
        <div className="space-y-4 text-gray-600 text-sm leading-relaxed">
          <p>Заработанные баллы можно тратить в Магазине. Вы добавляете приятные награды, а партнер покупает их за свои баллы. Это отличный способ порадовать друг друга и легализовать право на отдых.</p>
          
          <div className="bg-terra-50 p-4 sm:p-5 rounded-2xl border border-terra-100 space-y-3">
            <p className="font-semibold text-terra-800 text-xs mb-1">Идеи для наград:</p>
            <p>💆‍♂️ <strong>Услуги:</strong> Массаж спины на 15 минут (100 баллов)</p>
            <p>🛡️ <strong>Отдых:</strong> Освобождение от мытья посуды на день (200 баллов)</p>
            <p>🍿 <strong>Досуг:</strong> Право выбрать фильм на вечер (50 баллов)</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">Старайтесь добавлять в магазин то, что действительно приносит радость и удовольствие.</p>
        </div>
      )
    },
    {
      icon: Mail,
      title: 'Письма',
      content: (
        <div className="space-y-4 text-gray-600 text-sm leading-relaxed">
          <p><strong>Настроение:</strong> Вы можете отмечать свой уровень энергии каждый день. Это поможет партнеру понять ваше состояние — когда нужна поддержка, а когда лучше дать время на отдых.</p>
          <p><strong>Письма:</strong> Вместо привычных быстрых сообщений мы сделали полноценную почту. Вы можете прикрепить фото, записать голосовое или написать длинный текст. Письмо никуда не убежит в ленте, и партнер прочитает его, когда ему будет удобно. Это спокойный и красивый способ делиться важным.</p>
        </div>
      )
    },
    {
      icon: Users,
      title: 'Следующий шаг',
      content: (
        <div className="space-y-6 text-gray-600 text-sm leading-relaxed flex flex-col items-center text-center mt-4">
          <p>Пространство работает только для двоих. Прямо сейчас система ждет вашего партнера. Отправьте ему код приглашения.</p>
          
          {inviteCode ? (
            <button 
              onClick={handleCopyCode}
              className="group flex flex-col items-center gap-2 p-6 w-full max-w-sm bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-200 hover:border-terra-300 rounded-2xl transition-all cursor-pointer"
            >
              <span className="text-xs font-semibold text-gray-500">Ваш код</span>
              <span className="text-3xl font-bold text-gray-900 tracking-widest">{inviteCode}</span>
              <div className={`flex items-center gap-1.5 mt-2 text-sm font-medium ${isCopied ? 'text-green-500' : 'text-terra-600 group-hover:text-terra-700'}`}>
                {isCopied ? <><Check className="w-4 h-4" /> Скопировано</> : <><Copy className="w-4 h-4" /> Нажмите, чтобы скопировать</>}
              </div>
            </button>
          ) : (
            <div className="animate-pulse w-full max-w-sm h-32 bg-gray-100 rounded-2xl" />
          )}

          <p className="text-xs text-gray-400">Как только код будет активирован, ваши профили соединятся, и вы сможете начать.</p>
        </div>
      )
    }
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-gray-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-0">
            <div className="flex gap-1.5">
              {slides.map((_, idx) => (
                <div key={idx} className={`h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? 'w-8 bg-gray-900' : 'w-2 bg-gray-200'}`} />
              ))}
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Слайдер контента */}
          <div className="p-6 sm:p-10 relative overflow-hidden min-h-[400px] flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                {React.createElement(slides[currentSlide].icon, { className: "w-10 h-10 text-terra-500 mb-6" })}
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{slides[currentSlide].title}</h2>
                <div className="flex-1">
                  {slides[currentSlide].content}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer (Навигация) */}
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
            {currentSlide > 0 ? (
              <button 
                onClick={() => setCurrentSlide(prev => prev - 1)}
                className="px-6 py-3.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
              >
                Назад
              </button>
            ) : (
              <div className="flex-1" />
            )}

            {currentSlide < slides.length - 1 ? (
              <button 
                onClick={() => setCurrentSlide(prev => prev + 1)}
                className="flex-1 py-3.5 text-sm font-medium text-white bg-gray-900 hover:bg-black rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                Продолжить <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                onClick={onClose}
                className="flex-1 py-3.5 text-sm font-medium text-white bg-terra-600 hover:bg-terra-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-terra-600/20"
              >
                Понятно, начать <Check className="w-4 h-4" />
              </button>
            )}
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}