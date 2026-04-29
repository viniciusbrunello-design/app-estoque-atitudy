import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  criado_em?: string;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('id, role, content, criado_em')
      .eq('canal', 'web')
      .order('criado_em', { ascending: true })
      .limit(100);
    setMessages((data as ChatMessage[]) ?? []);
    setIsLoadingHistory(false);
  };

  const sendMessage = async (content: string, imageUrl?: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content, imageUrl };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    await supabase.from('chat_messages').insert({ role: 'user', content, canal: 'web', chat_id: null });

    const historico = messages.slice(-14).map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ mensagem: content, historico, imagemUrl: imageUrl }),
        },
      );

      const json = await res.json();
      const resposta: string = json.resposta ?? 'Sem resposta do servidor.';
      const assistantMsg: ChatMessage = { role: 'assistant', content: resposta };

      setMessages((prev) => [...prev, assistantMsg]);
      await supabase.from('chat_messages').insert({ role: 'assistant', content: resposta, canal: 'web', chat_id: null });
    } catch {
      const errMsg = 'Erro de conexão. Verifique sua internet e tente novamente.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    await supabase.from('chat_messages').delete().eq('canal', 'web');
    setMessages([]);
  };

  return { messages, isLoading, isLoadingHistory, sendMessage, clearHistory };
}
