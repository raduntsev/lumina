'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Send, Mail, Mic, Square, Loader2, CheckCheck, 
  ArrowLeft, Paperclip, FileText, Plus, Bold, Italic, Underline, Check, Star
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

// ── Интерфейсы ──────────────────────────────────────────────────────────

interface Letter {
  id: string;
  sender_id: string;
  title?: string;
  content: string | null;
  attachments?: string[];
  type?: 'text' | 'audio' | 'video' | 'image' | 'file';
  file_url?: string | null;
  is_read: boolean;
  is_favorite: boolean; // Новое поле для избранного
  created_at: string;
}

const PAGE_SIZE = 20;

// ── Встроенный компонент Диктофона ──────────────────────────────────────

function VoiceRecorder({ onSave, onDiscard }: { onSave: (blob: Blob) => void, onDiscard: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(audioBlob));
        onSave(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (error) {
      alert('Нет доступа к микрофону. Проверьте разрешения браузера.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleDiscard = () => {
    setAudioUrl(null);
    setRecordingTime(0);
    audioChunksRef.current = [];
    onDiscard();
  };

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
      {!audioUrl ? (
        <>
          <button 
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-gray-300'}`} />
            <span className={`text-sm font-medium ${isRecording ? 'text-red-600' : 'text-gray-500'}`}>
              {isRecording ? formatTime(recordingTime) : 'Записать аудио'}
            </span>
          </div>
        </>
      ) : (
        <>
          <audio src={audioUrl} controls className="h-10 flex-1 max-w-[250px]" />
          <button type="button" onClick={handleDiscard} className="p-2 text-gray-400 hover:text-red-500"><X className="w-5 h-5" /></button>
        </>
      )}
    </div>
  );
}

// ── Основной Компонент ──────────────────────────────────────────────────

export function LettersModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { spaceId, user } = useSpaceAuth();
  const currentUserId = user?.id || null;

  const [view, setView] = useState<'inbox' | 'compose' | 'read'>('inbox');
  const [filterTab, setFilterTab] = useState<'inbox' | 'sent' | 'favorites'>('inbox');
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);

  const [letters, setLetters] = useState<Letter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const [composeTitle, setComposeTitle] = useState('');
  const [composeFiles, setComposeFiles] = useState<File[]>([]);
  const [composeVoice, setComposeVoice] = useState<Blob | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 1. Загрузка писем (с фильтрацией) ──
  const fetchLetters = useCallback(async (pageNum: number, isInitial = false) => {
    if (!spaceId || !currentUserId) return;
    if (isInitial) setIsLoading(true);

    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('letters')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .range(from, to);

    // Фильтруем запрос в зависимости от выбранной вкладки
    if (filterTab === 'inbox') query = query.neq('sender_id', currentUserId);
    if (filterTab === 'sent') query = query.eq('sender_id', currentUserId);
    if (filterTab === 'favorites') query = query.eq('is_favorite', true);

    const { data, error } = await query;

    if (!error && data) {
      const fetched = data as Letter[];
      if (isInitial) setLetters(fetched);
      else setLetters(prev => [...prev, ...fetched]);
      if (fetched.length < PAGE_SIZE) setHasMore(false);
    }
    if (isInitial) setIsLoading(false);
  }, [spaceId, currentUserId, filterTab]);

  useEffect(() => {
    if (isOpen && view === 'inbox') {
      setPage(0);
      setHasMore(true);
      fetchLetters(0, true);
    }
  }, [isOpen, filterTab, view, fetchLetters]);

  // Подписка на новые письма
  useEffect(() => {
    if (!spaceId || !isOpen) return;
    const channel = supabase.channel('realtime_letters')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'letters', filter: `space_id=eq.${spaceId}` }, (payload) => {
        const newL = payload.new as Letter;
        // Добавляем письмо в список только если оно подходит под текущую вкладку
        if (filterTab === 'inbox' && newL.sender_id !== currentUserId) setLetters(prev => [newL, ...prev]);
        if (filterTab === 'sent' && newL.sender_id === currentUserId) setLetters(prev => [newL, ...prev]);
        if (filterTab === 'favorites' && newL.is_favorite) setLetters(prev => [newL, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'letters', filter: `space_id=eq.${spaceId}` }, (payload) => {
        const updated = payload.new as Letter;
        setLetters(prev => prev.map(l => l.id === updated.id ? updated : l));
        if (selectedLetter?.id === updated.id) setSelectedLetter(updated);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [spaceId, isOpen, currentUserId, selectedLetter, filterTab]);

  // ── 2. Действия с письмом ──
  const handleOpenLetter = async (letter: Letter) => {
    setSelectedLetter(letter);
    setView('read');
    if (!letter.is_read && letter.sender_id !== currentUserId) {
      setLetters(prev => prev.map(l => l.id === letter.id ? { ...l, is_read: true } : l));
      await supabase.from('letters').update({ is_read: true }).eq('id', letter.id);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, letterId: string, currentStatus: boolean) => {
    e.stopPropagation(); // Чтобы письмо не открывалось при клике на звездочку
    
    // Оптимистичное обновление UI
    setLetters(prev => prev.map(l => l.id === letterId ? { ...l, is_favorite: !currentStatus } : l));
    if (selectedLetter?.id === letterId) setSelectedLetter(prev => prev ? { ...prev, is_favorite: !currentStatus } : null);

    // Если мы на вкладке избранного и убрали звезду — письмо должно исчезнуть из списка
    if (filterTab === 'favorites' && currentStatus) {
      setLetters(prev => prev.filter(l => l.id !== letterId));
    }

    await supabase.from('letters').update({ is_favorite: !currentStatus }).eq('id', letterId);
  };

  // ── 3. Отправка письма ──
  const formatText = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
  };

  const handleSendLetter = async () => {
    const contentHtml = editorRef.current?.innerHTML || '';
    if (!spaceId || !currentUserId) return;
    if (!contentHtml.trim() && !composeVoice && composeFiles.length === 0) return alert('Письмо не может быть пустым');

    setIsSending(true);
    try {
      const uploadedUrls: string[] = [];
      const uploadFile = async (file: File | Blob, ext: string) => {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = `${spaceId}/${fileName}`;
        const { error } = await supabase.storage.from('letters_media').upload(filePath, file);
        if (error) throw error;
        const { data } = supabase.storage.from('letters_media').getPublicUrl(filePath);
        return data.publicUrl;
      };

      for (const file of composeFiles) {
        const ext = file.name.split('.').pop() || 'file';
        uploadedUrls.push(await uploadFile(file, ext));
      }

      if (composeVoice) uploadedUrls.push(await uploadFile(composeVoice, 'webm'));

      const { data, error } = await supabase.from('letters').insert({
        space_id: spaceId,
        sender_id: currentUserId,
        title: composeTitle.trim() || 'Послание',
        content: contentHtml,
        attachments: uploadedUrls,
        is_read: false,
        is_favorite: false,
        type: 'text' 
      }).select('*').single();

      if (error) throw error;
      
      setComposeTitle('');
      setComposeFiles([]);
      setComposeVoice(null);
      setFilterTab('sent'); // Перекидываем на отправленные, чтобы увидеть письмо
      setView('inbox');
    } catch (err: any) {
      alert(`Ошибка при отправке: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // ── Рендер медиа ──
  const renderAttachment = (url: string, index: number) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.webm') || lowerUrl.includes('.mp3') || lowerUrl.includes('.wav')) {
      return <audio key={index} src={url} controls className="w-full max-w-sm mt-3" />;
    }
    if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mov')) {
      return <video key={index} src={url} controls className="max-w-full rounded-xl mt-3 shadow-sm border border-gray-100" />;
    }
    if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || lowerUrl.includes('.png') || lowerUrl.includes('.gif')) {
      return <img key={index} src={url} alt="Attachment" className="max-w-full rounded-xl mt-3 shadow-sm border border-gray-100 object-cover" />;
    }
    return (
      <a key={index} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium text-terra-600 bg-terra-50 p-3 rounded-lg mt-3 w-max hover:bg-terra-100 transition-colors">
        <FileText className="w-4 h-4" /> Скачать файл
      </a>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6">
          <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} transition={{ type: "spring", duration: 0.5, bounce: 0 }} className="bg-gray-50 w-full max-w-4xl h-full sm:h-[90vh] flex flex-col shadow-2xl relative sm:rounded-3xl overflow-hidden">
            
            {/* ── Шапка ── */}
            <div className="flex flex-col p-4 sm:px-8 sm:py-5 border-b border-gray-200 bg-white sticky top-0 z-20 shrink-0 gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {view !== 'inbox' ? (
                    <button onClick={() => setView('inbox')} className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
                      <ArrowLeft className="w-6 h-6" />
                    </button>
                  ) : (
                    <div className="p-2.5 bg-terra-50 rounded-xl"><Mail className="w-5 h-5 text-terra-600" /></div>
                  )}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {view === 'inbox' && 'Почтовый ящик'}
                      {view === 'compose' && 'Новое письмо'}
                      {view === 'read' && 'Письмо'}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {view === 'inbox' && (
                    <button onClick={() => setView('compose')} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-black transition-colors cursor-pointer">
                      Написать
                    </button>
                  )}
                  <button onClick={onClose} className="p-2 bg-white border border-gray-200 rounded-full hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Вкладки (только для ящика) */}
              {view === 'inbox' && (
                <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-max">
                  <button onClick={() => setFilterTab('inbox')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${filterTab === 'inbox' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Входящие</button>
                  <button onClick={() => setFilterTab('sent')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${filterTab === 'sent' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Отправленные</button>
                  <button onClick={() => setFilterTab('favorites')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${filterTab === 'favorites' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Избранное</button>
                </div>
              )}
            </div>

            {/* ── Содержимое ── */}
            <div className="flex-grow overflow-y-auto bg-gray-50 relative">
              
              {/* ВИД 1: ПОЧТОВЫЯ ЯЩИК (СЕТКА) */}
              {view === 'inbox' && (
                <div className="p-4 sm:p-8">
                  {isLoading && letters.length === 0 ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
                  ) : letters.length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                      {filterTab === 'inbox' && 'Входящих писем пока нет.'}
                      {filterTab === 'sent' && 'Вы еще не отправляли писем.'}
                      {filterTab === 'favorites' && 'Тут будут письма, отмеченные звездочкой.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {letters.map((letter) => {
                        const isMe = letter.sender_id === currentUserId;
                        const isNew = !isMe && !letter.is_read;
                        
                        return (
                          <div 
                            key={letter.id} 
                            onClick={() => handleOpenLetter(letter)}
                            className={`group p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col h-40 justify-between ${isNew ? 'bg-white border-terra-200 shadow-md hover:border-terra-300' : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'}`}
                          >
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${isMe ? 'bg-gray-100 text-gray-600' : 'bg-terra-50 text-terra-600'}`}>
                                  {isMe ? 'Отправлено' : 'Входящее'}
                                </span>
                                <div className="flex items-center gap-2">
                                  {isNew && <span className="w-2.5 h-2.5 bg-terra-500 rounded-full animate-pulse" />}
                                  <button 
                                    onClick={(e) => toggleFavorite(e, letter.id, letter.is_favorite)}
                                    className={`p-1.5 rounded-full transition-colors hover:bg-gray-100 ${letter.is_favorite ? 'text-yellow-400' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}
                                  >
                                    <Star className={`w-4 h-4 ${letter.is_favorite ? 'fill-current' : ''}`} />
                                  </button>
                                </div>
                              </div>
                              <h3 className="font-semibold text-gray-900 line-clamp-1 mt-2">
                                {letter.title || 'Послание'}
                              </h3>
                            </div>
                            <div className="flex items-center justify-between text-xs font-medium text-gray-400">
                              <span>{new Date(letter.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                              <div className="flex gap-2">
                                {letter.attachments && letter.attachments.length > 0 && <Paperclip className="w-3.5 h-3.5" />}
                                {letter.file_url && <Paperclip className="w-3.5 h-3.5" />} 
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {hasMore && letters.length > 0 && (
                    <button onClick={() => { setPage(p => p + 1); fetchLetters(page + 1); }} className="mx-auto mt-8 block px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer">
                      Загрузить еще
                    </button>
                  )}
                </div>
              )}

              {/* ВИД 2: ЧТЕНИЕ ПИСЬМА */}
              {view === 'read' && selectedLetter && (
                <div className="max-w-2xl mx-auto p-6 sm:p-12 bg-white min-h-full shadow-sm relative">
                  <div className="absolute top-6 right-6 sm:top-10 sm:right-10">
                    <button 
                      onClick={(e) => toggleFavorite(e, selectedLetter.id, selectedLetter.is_favorite)}
                      className={`p-2 rounded-full transition-colors border ${selectedLetter.is_favorite ? 'border-yellow-200 bg-yellow-50 text-yellow-500 hover:bg-yellow-100' : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'}`}
                      title={selectedLetter.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                    >
                      <Star className={`w-5 h-5 ${selectedLetter.is_favorite ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <div className="text-center mb-10 pb-10 border-b border-gray-100 pt-8 sm:pt-0">
                    <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">
                      {new Date(selectedLetter.created_at).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 leading-tight pr-12 sm:pr-0">
                      {selectedLetter.title || 'Без заголовка'}
                    </h1>
                    <p className="text-sm font-medium text-terra-600 mt-4">
                      От: {selectedLetter.sender_id === currentUserId ? 'Вас' : 'Партнера'}
                    </p>
                  </div>

                  {selectedLetter.content && (
                    <div className="prose prose-gray prose-p:leading-relaxed prose-p:text-gray-700 text-lg custom-html-content" dangerouslySetInnerHTML={{ __html: selectedLetter.content }} />
                  )}

                  {selectedLetter.attachments && selectedLetter.attachments.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-dashed border-gray-200 space-y-4">
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Вложения</h4>
                      {selectedLetter.attachments.map((url, idx) => renderAttachment(url, idx))}
                    </div>
                  )}

                  {selectedLetter.file_url && (!selectedLetter.attachments || selectedLetter.attachments.length === 0) && (
                    <div className="mt-12 pt-8 border-t border-dashed border-gray-200">
                      {renderAttachment(selectedLetter.file_url, 0)}
                    </div>
                  )}
                </div>
              )}

              {/* ВИД 3: НАПИСАТЬ ПИСЬМО */}
              {view === 'compose' && (
                <div className="max-w-3xl mx-auto p-4 sm:p-8">
                  <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100">
                    
                    <input 
                      type="text" 
                      placeholder="Заголовок письма..." 
                      value={composeTitle}
                      onChange={e => setComposeTitle(e.target.value)}
                      className="w-full text-3xl font-semibold text-gray-900 placeholder:text-gray-300 outline-none mb-6 bg-transparent"
                    />

                    {/* Тулбар форматирования */}
                    <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity mb-4 pb-4 border-b border-gray-50">
                      <button onClick={() => formatText('bold')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"><Bold className="w-4 h-4"/></button>
                      <button onClick={() => formatText('italic')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"><Italic className="w-4 h-4"/></button>
                      <button onClick={() => formatText('underline')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"><Underline className="w-4 h-4"/></button>
                    </div>

                    <div 
                      ref={editorRef}
                      contentEditable
                      className="w-full min-h-[250px] outline-none text-lg text-gray-700 leading-relaxed empty:before:content-['Начните_писать_здесь...'] empty:before:text-gray-400 cursor-text"
                    />

                    {composeFiles.length > 0 && (
                      <div className="mt-8 flex flex-wrap gap-3">
                        {composeFiles.map((file, i) => (
                          <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-sm text-gray-600">
                            <Paperclip className="w-4 h-4" />
                            <span className="truncate max-w-[150px]">{file.name}</span>
                            <button onClick={() => setComposeFiles(prev => prev.filter((_, idx) => idx !== i))} className="ml-2 hover:text-red-500 cursor-pointer"><X className="w-4 h-4"/></button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-10 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <VoiceRecorder 
                          onSave={(blob) => setComposeVoice(blob)} 
                          onDiscard={() => setComposeVoice(null)} 
                        />
                        
                        <input type="file" ref={fileInputRef} onChange={(e) => { if(e.target.files) setComposeFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} className="hidden" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx" />
                        <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors tooltip flex-shrink-0 cursor-pointer" title="Прикрепить файл">
                          <Paperclip className="w-5 h-5" />
                        </button>
                      </div>

                      <button 
                        onClick={handleSendLetter}
                        disabled={isSending}
                        className="w-full sm:w-auto px-8 py-3.5 bg-gray-900 text-white rounded-xl hover:bg-black font-medium transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
                      >
                        {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Отправить</>}
                      </button>
                    </div>

                  </div>
                </div>
              )}
            </div>

            {view === 'inbox' && (
              <button 
                onClick={() => setView('compose')} 
                className="sm:hidden absolute bottom-6 right-6 p-4 bg-gray-900 text-white rounded-full shadow-xl hover:bg-black z-20 cursor-pointer"
              >
                <Plus className="w-6 h-6" />
              </button>
            )}

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}