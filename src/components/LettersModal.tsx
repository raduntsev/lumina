'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Mail, Mic, Video, Image as ImageIcon, FileText, Loader2, Check, CheckCheck, Bold, Italic, Underline, Plus, Paperclip } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

interface Letter {
  id: string;
  sender_id: string;
  type: 'text' | 'audio' | 'video' | 'image' | 'file';
  content: string | null;
  file_url: string | null;
  is_read: boolean;
  created_at: string;
}

const PAGE_SIZE = 10;

export function LettersModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { spaceId, user } = useSpaceAuth();
  const currentUserId = user?.id || null;

  const [letters, setLetters] = useState<Letter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchLetters = useCallback(async (pageNum: number, isInitial = false) => {
    if (!spaceId || !currentUserId) return;
    if (isInitial) setIsLoading(true);

    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('letters')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      const fetched = data as Letter[];
      
      if (isInitial) {
        setLetters(fetched.reverse());
      } else {
        setLetters(prev => [...fetched.reverse(), ...prev]);
      }
      
      if (fetched.length < PAGE_SIZE) setHasMore(false);
    }
    if (isInitial) setIsLoading(false);
  }, [spaceId, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      setPage(0);
      setHasMore(true);
      fetchLetters(0, true);
    }
  }, [isOpen, fetchLetters]);

  useEffect(() => {
    if (page === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [letters, page]);

  useEffect(() => {
    const unreadPartnerLetters = letters.filter(l => !l.is_read && l.sender_id !== currentUserId);
    
    if (isOpen && unreadPartnerLetters.length > 0) {
      const markAsRead = async () => {
        const ids = unreadPartnerLetters.map(l => l.id);
        setLetters(prev => prev.map(l => ids.includes(l.id) ? { ...l, is_read: true } : l));
        await supabase.from('letters').update({ is_read: true }).in('id', ids);
      };
      markAsRead();
    }
  }, [isOpen, letters, currentUserId]);

  useEffect(() => {
    if (!spaceId || !isOpen) return;

    const channel = supabase.channel('realtime_chat')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'letters', 
        filter: `space_id=eq.${spaceId}` 
      }, (payload) => {
        const newMessage = payload.new as Letter;
        if (newMessage.sender_id !== currentUserId) {
          setLetters(prev => [...prev, newMessage]);
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'letters', 
        filter: `space_id=eq.${spaceId}` 
      }, (payload) => {
        const updated = payload.new as Letter;
        setLetters(prev => prev.map(l => l.id === updated.id ? updated : l));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [spaceId, isOpen, currentUserId]);

  const formatText = (command: string) => {
    document.execCommand(command, false);
    editorRef.current?.focus();
  };

  const handleSendText = async () => {
    const contentHtml = editorRef.current?.innerHTML;
    if (!contentHtml || contentHtml === '<br>' || !spaceId || !currentUserId) return;

    const { data, error } = await supabase.from('letters').insert({
      space_id: spaceId,
      sender_id: currentUserId,
      type: 'text',
      content: contentHtml,
      is_read: false
    }).select('*').single();

    if (!error && data) {
      setLetters(prev => [...prev, data as Letter]);
      if (editorRef.current) editorRef.current.innerHTML = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !spaceId || !currentUserId) return;

    setIsUploading(true);
    try {
      let fileType: 'audio' | 'video' | 'image' | 'file' = 'file';
      if (file.type.startsWith('audio/')) fileType = 'audio';
      else if (file.type.startsWith('video/')) fileType = 'video';
      else if (file.type.startsWith('image/')) fileType = 'image';

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${spaceId}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('letters_media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('letters_media').getPublicUrl(filePath);

      const { data: dbData } = await supabase.from('letters').insert({
        space_id: spaceId,
        sender_id: currentUserId,
        type: fileType,
        file_url: publicUrlData.publicUrl,
        content: file.name,
        is_read: false
      }).select('*').single();

      if (dbData) setLetters(prev => [...prev, dbData as Letter]);
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };

  const renderContent = (letter: Letter, isMe: boolean) => {
    switch (letter.type) {
      case 'text':
        return <div className={`text-[15px] leading-relaxed ${isMe ? 'text-white' : 'text-gray-900'} custom-html-content`} dangerouslySetInnerHTML={{ __html: letter.content || '' }} />;
      case 'audio':
        return (
          <div className="flex flex-col gap-2 min-w-[200px] sm:min-w-[280px]">
            <div className={`flex items-center gap-2 text-xs font-medium ${isMe ? 'text-white/60' : 'text-gray-500'}`}>
              <Mic className="w-3.5 h-3.5" /> Голосовое сообщение
            </div>
            <audio controls className={`w-full h-10 rounded-lg ${isMe ? 'filter invert brightness-110 contrast-75' : ''}`}>
              <source src={letter.file_url || ''} />
            </audio>
          </div>
        );
      case 'video':
        return <video controls className="max-w-full rounded-lg border border-gray-100 mt-1 bg-black shadow-sm"><source src={letter.file_url || ''} /></video>;
      case 'image':
        return <img src={letter.file_url || ''} alt="Media" className="max-w-full rounded-lg border border-gray-100 mt-1 shadow-sm" />;
      default:
        return <a href={letter.file_url || '#'} target="_blank" rel="noreferrer" className={`flex items-center gap-2 text-sm font-medium mt-1 hover:underline ${isMe ? 'text-white' : 'text-gray-900'}`}><Paperclip className="w-4 h-4"/> {letter.content}</a>;
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
            initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0 }}
            className="bg-white w-full max-w-4xl h-full sm:h-[85vh] flex flex-col shadow-2xl relative sm:rounded-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 sm:px-8 border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-terra-50 rounded-xl"><Mail className="w-5 h-5 text-terra-600" /></div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Письма</h2>
                  <p className="text-sm font-medium text-gray-500">Наше личное пространство</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 bg-white border border-gray-100 rounded-full hover:bg-gray-50 hover:text-gray-900 text-gray-400 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Лента сообщений */}
            <div ref={scrollContainerRef} className="flex-grow overflow-y-auto p-4 sm:p-8 space-y-6 bg-gray-50/50">
              {hasMore && (
                <div className="flex justify-center pt-2 pb-6">
                  <button 
                    onClick={() => { setPage(p => p + 1); fetchLetters(page + 1); }}
                    className="text-xs font-medium px-4 py-2 bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
                  >
                    Показать ранние письма
                  </button>
                </div>
              )}

              {isLoading ? (
                <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
              ) : (
                letters.map((letter, idx) => {
                  const isMe = letter.sender_id === currentUserId;
                  const showDate = idx === 0 || 
                    new Date(letters[idx-1].created_at).toDateString() !== new Date(letter.created_at).toDateString();

                  return (
                    <React.Fragment key={letter.id}>
                      {showDate && (
                        <div className="flex justify-center my-8">
                          <span className="text-xs font-medium text-gray-500 bg-gray-100/80 px-3 py-1 rounded-full">
                            {new Date(letter.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-[70%] p-4 shadow-sm relative group ${
                          isMe 
                            ? 'bg-gray-900 text-white rounded-2xl rounded-tr-sm' 
                            : 'bg-white text-gray-900 border border-gray-100 rounded-2xl rounded-tl-sm'
                        }`}>
                          {renderContent(letter, isMe)}
                          <div className={`flex items-center justify-end gap-1.5 mt-2 text-[10px] font-medium ${isMe ? 'text-white/40' : 'text-gray-400'}`}>
                            {new Date(letter.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            {isMe && (
                              letter.is_read ? <CheckCheck className="w-3.5 h-3.5 text-terra-400" /> : <Check className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 sm:px-8 sm:py-6 bg-white border-t border-gray-100 shrink-0">
              <div className="max-w-4xl mx-auto space-y-3">
                
                {/* Тулбар форматирования */}
                <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity pl-14">
                  <button onClick={() => formatText('bold')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"><Bold className="w-4 h-4"/></button>
                  <button onClick={() => formatText('italic')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"><Italic className="w-4 h-4"/></button>
                  <button onClick={() => formatText('underline')} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md cursor-pointer transition-colors"><Underline className="w-4 h-4"/></button>
                  <div className="w-px h-4 bg-gray-200 mx-2" />
                  <span className="text-xs font-medium text-gray-400">Ctrl + Enter для отправки</span>
                </div>

                <div className="flex items-end gap-3">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-3.5 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-gray-500 hover:text-gray-900 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    title="Прикрепить файл"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  </button>
                  
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="audio/*,video/*,image/*,.pdf" />

                  <div 
                    ref={editorRef}
                    contentEditable
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleSendText();
                      }
                    }}
                    className="flex-grow min-h-[52px] max-h-[150px] overflow-y-auto p-3.5 text-base text-gray-900 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-terra-400 focus:bg-white transition-all empty:before:content-['Написать_письмо...'] empty:before:text-gray-400 empty:before:pointer-events-none"
                  />

                  <button 
                    onClick={handleSendText}
                    className="p-3.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-sm shadow-gray-900/10 cursor-pointer group shrink-0"
                  >
                    <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}