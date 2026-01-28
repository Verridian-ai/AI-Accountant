import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, User, Loader2, Cpu, Activity, MessageCircle, X, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api';

export function FloatingChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Neural link established. I can analyze your financial matrix. Ask me about spending patterns or tax efficiency.' }
    ]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen && !isMinimized) {
            scrollToBottom();
            setUnreadCount(0);
        }
    }, [messages, isOpen, isMinimized]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const { answer } = await api.sendChatMessage(userMsg);
            setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
            if (!isOpen || isMinimized) {
                setUnreadCount(prev => prev + 1);
            }
        } catch (error) {
            console.error('Chat failed:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: "SYSTEM ERROR: Uplink interrupted. Please retry signal transmission." }]);
        } finally {
            setLoading(false);
        }
    };

    const toggleChat = () => {
        if (isMinimized) {
            setIsMinimized(false);
        } else {
            setIsOpen(!isOpen);
        }
        setUnreadCount(0);
    };

    const minimizeChat = () => {
        setIsMinimized(true);
    };

    const closeChat = () => {
        setIsOpen(false);
        setIsMinimized(false);
    };

    return (
        <>
            {/* Floating Chat Button - Positioned above bottom nav on mobile */}
            <button
                type="button"
                onClick={toggleChat}
                className={cn(
                    "fixed right-4 z-50 p-4 rounded-2xl shadow-2xl transition-all duration-300 btn-press group",
                    "bottom-20 md:bottom-6 md:right-6", // Above bottom nav on mobile
                    isOpen && !isMinimized
                        ? "scale-0 opacity-0 pointer-events-none"
                        : "scale-100 opacity-100 cba-gold-gradient cba-gold-glow"
                )}
                aria-label="Open chat"
            >
                <div className="relative">
                    <MessageCircle className="h-6 w-6 text-[#0a0a0f]" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-white animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </div>
                <span className="absolute -top-12 right-0 neu-raised px-3 py-1.5 rounded-xl text-[10px] font-black text-zinc-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    Neural Core
                </span>
            </button>

            {/* Chat Popup - Responsive positioning */}
            <div className={cn(
                "fixed z-50 transition-all duration-300 ease-out",
                "bottom-20 right-4 md:bottom-6 md:right-6", // Above bottom nav on mobile
                "w-[calc(100vw-2rem)] md:w-[380px] max-w-[380px]",
                isOpen && !isMinimized
                    ? "opacity-100 translate-y-0 scale-100"
                    : "opacity-0 translate-y-8 scale-95 pointer-events-none"
            )}>
                <div className="flex flex-col h-[calc(100vh-10rem)] md:h-[550px] max-h-[550px] neu-raised rounded-4xl overflow-hidden border border-white/10 shadow-2xl">
                    {/* Header */}
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="absolute -inset-1 cba-gold-gradient rounded-xl blur opacity-20" />
                                <div className="relative neu-inset p-2.5 rounded-xl text-[#FFCC00]">
                                    <Cpu className="h-5 w-5" />
                                </div>
                            </div>
                            <div>
                                <h3 className="font-black text-zinc-100 uppercase tracking-widest text-xs">Neural Core</h3>
                                <p className="text-[8px] text-zinc-500 uppercase tracking-[0.15em] flex items-center gap-1 font-bold">
                                    <Sparkles className="h-2.5 w-2.5 text-[#FFCC00]" /> Intelligence Engine v4
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="neu-inset px-2 py-1 rounded-full flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">Live</span>
                            </div>
                            <button
                                type="button"
                                onClick={minimizeChat}
                                className="neu-raised-sm p-2 rounded-xl text-zinc-500 hover:text-[#FFCC00] transition-colors"
                                aria-label="Minimize chat"
                            >
                                <Minimize2 className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={closeChat}
                                className="neu-raised-sm p-2 rounded-xl text-zinc-500 hover:text-red-400 transition-colors"
                                aria-label="Close chat"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-black/10">
                        {messages.map((m, i) => (
                            <div key={i} className={cn("flex items-end gap-2", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                                <div className={cn(
                                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-white/5",
                                    m.role === 'user' ? "neu-raised bg-zinc-800 text-[#FFCC00]" : "neu-inset bg-black/20 text-zinc-500"
                                )}>
                                    {m.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                                </div>
                                <div className={cn(
                                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm relative",
                                    m.role === 'user'
                                        ? "cba-gold-gradient text-[#0a0a0f] rounded-br-none font-bold shadow-lg"
                                        : "neu-raised rounded-bl-none text-zinc-200 border border-white/5"
                                )}>
                                    <p className="leading-relaxed font-medium text-xs">{m.content}</p>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex items-end gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center neu-inset bg-black/20 text-[#FFCC00]">
                                    <Bot className="h-3.5 w-3.5 animate-pulse" />
                                </div>
                                <div className="neu-raised rounded-2xl rounded-bl-none px-4 py-3 border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] animate-bounce animate-delay-0" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] animate-bounce animate-delay-150" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] animate-bounce animate-delay-300" />
                                        </div>
                                        <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Synthesizing</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-white/5 bg-white/2">
                        <div className="flex gap-2">
                            <input
                                className="flex-1 neu-inset rounded-xl px-4 py-3 text-xs focus-gold transition-all outline-none text-[#FFCC00] placeholder-zinc-700 font-bold bg-transparent"
                                placeholder="Input command query..."
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            />
                            <button
                                type="button"
                                onClick={handleSend}
                                disabled={loading || !input.trim()}
                                aria-label="Send message"
                                className="cba-gold-gradient text-[#0a0a0f] w-11 h-11 flex items-center justify-center rounded-xl btn-press disabled:opacity-30 shadow-lg"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </button>
                        </div>
                        <div className="flex items-center justify-between mt-2 px-1">
                            <div className="flex items-center gap-1.5">
                                <Activity className="h-2.5 w-2.5 text-zinc-700" />
                                <span className="text-[7px] font-black text-zinc-700 uppercase tracking-widest">Latency: 12ms</span>
                            </div>
                            <span className="text-[7px] font-black text-zinc-700 uppercase tracking-widest">Secure Channel</span>
                        </div>
                    </div>
                </div>
            </div >

            {/* Minimized Chat Indicator */}
            {
                isMinimized && (
                    <button
                        type="button"
                        onClick={() => setIsMinimized(false)}
                        className="fixed bottom-6 right-6 z-50 neu-raised rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl border border-white/10 hover:border-[#FFCC00]/30 transition-all btn-press group"
                        aria-label="Expand chat"
                    >
                        <div className="neu-inset p-2 rounded-xl text-[#FFCC00]">
                            <Cpu className="h-4 w-4" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">Neural Core</span>
                            <span className="text-[8px] text-zinc-600 block uppercase tracking-wider">Click to expand</span>
                        </div>
                        {unreadCount > 0 && (
                            <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-white animate-pulse">
                                {unreadCount}
                            </span>
                        )}
                    </button>
                )
            }
        </>
    );
}

