import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { Bot, Send, Mic, MicOff, Trash2, ImagePlus, X } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import './Assistente.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

async function uploadImagem(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(filename, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('product-images').getPublicUrl(filename);
  return data.publicUrl;
}

export default function Assistente() {
  const { messages, isLoading, isLoadingHistory, sendMessage, clearHistory } = useChat();
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<AnySpeechRecognition>(null);
  const accumulatedRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !imageFile) || isLoading || isUploading) return;

    let imageUrl: string | undefined;

    if (imageFile) {
      setIsUploading(true);
      try {
        imageUrl = await uploadImagem(imageFile);
      } catch {
        toast.error('Erro ao enviar a imagem. Tente novamente.');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    setInput('');
    clearImagePreview();
    sendMessage(text || 'Foto enviada', imageUrl);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const clearImagePreview = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  };

  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SR) {
      alert('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    accumulatedRef.current = '';

    recognition.onresult = (event: AnySpeechRecognition) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t + ' ';
        } else {
          interimText += t;
        }
      }
      accumulatedRef.current = finalText;
      setInput(finalText + interimText);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => {
      setInput(accumulatedRef.current.trim());
      setIsRecording(false);
    };

    recognition.start();
    setIsRecording(true);
  };

  const handleClear = async () => {
    if (window.confirm('Limpar todo o histórico de conversa?')) {
      await clearHistory();
    }
  };

  const isSendDisabled = (!input.trim() && !imageFile) || isLoading || isUploading;

  return (
    <div className="assistente-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assistente</h1>
          <p className="page-subtitle">Lucas — seu gerente de estoque inteligente</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleClear} type="button">
          <Trash2 size={14} />
          Limpar histórico
        </button>
      </div>

      <div className="chat-window">
        <div className="chat-messages">
          {isLoadingHistory ? (
            <div className="chat-center">
              <p className="chat-hint">Carregando histórico...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-center">
              <div className="chat-welcome">
                <div className="chat-welcome-icon">
                  <Bot size={28} />
                </div>
                <p className="chat-welcome-title">Olá! Sou o Lucas 👋</p>
                <p className="chat-welcome-desc">
                  Posso te ajudar a cadastrar produtos, registrar estoque e responder consultas.
                  Escreva, use o microfone ou envie uma foto de produto!
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={msg.id ?? i} className={`chat-bubble-row ${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <div className="chat-avatar">
                      <Bot size={15} />
                    </div>
                  )}
                  <div className={`chat-bubble ${msg.role}`}>
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Foto enviada"
                        className="chat-bubble-image"
                        onClick={() => window.open(msg.imageUrl, '_blank')}
                      />
                    )}
                    {msg.content !== 'Foto enviada' || !msg.imageUrl ? msg.content : null}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="chat-bubble-row assistant">
                  <div className="chat-avatar">
                    <Bot size={15} />
                  </div>
                  <div className="chat-bubble assistant chat-typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            {imagePreview && (
              <div className="chat-image-preview">
                <img src={imagePreview} alt="Preview" />
                <button
                  className="chat-image-preview-remove"
                  onClick={clearImagePreview}
                  type="button"
                  title="Remover imagem"
                >
                  <X size={10} />
                </button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              className="chat-input"
              placeholder={imageFile ? 'Diga de qual produto é essa foto (opcional)...' : 'Escreva uma mensagem...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading || isUploading}
            />
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />

          <button
            className="btn btn-icon chat-photo-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Enviar foto de produto"
            type="button"
            disabled={isLoading || isUploading}
          >
            <ImagePlus size={18} />
          </button>

          <button
            className={`btn btn-icon chat-voice-btn${isRecording ? ' recording' : ''}`}
            onClick={toggleVoice}
            title={isRecording ? 'Parar gravação' : 'Usar voz'}
            type="button"
            disabled={isUploading}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            className="btn btn-primary btn-icon"
            onClick={handleSend}
            disabled={isSendDisabled}
            type="button"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
