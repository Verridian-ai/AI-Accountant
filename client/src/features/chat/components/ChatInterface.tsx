import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, User, Loader2, Cpu, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api';

export function ChatInterface() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Neural link established. I can analyze your financial matrix. Ask me about spending patterns or tax efficiency.' }
    ]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const { answer } = await api.sendChatMessage(userMsg);
            setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
        } catch (error) {
            console.error('Chat failed:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: "SYSTEM ERROR: Uplink interrupted. Please retry signal transmission." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[550px] neu-raised rounded-[2.5rem] overflow-hidden border border-white/5 group">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute -inset-1 cba-gold-gradient rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="relative neu-inset p-3 rounded-xl text-[#FFCC00]">
                            <Cpu className="h-6 w-6" />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-black text-zinc-100 uppercase tracking-widest text-sm">Neural Core</h3>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-1.5 font-bold mt-0.5">
                            <Sparkles className="h-3 w-3 text-[#FFCC00]" /> Intelligence Engine v4
                        </p>
                    </div>
                </div>
                <div className="neu-inset px-3 py-1.5 rounded-full flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest italic">Uplink</span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-black/10">
                {messages.map((m, i) => (
                    <div key={i} className={cn("flex items-end gap-3", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                        <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-white/5 shadow-inner",
                            m.role === 'user' ? "neu-raised bg-zinc-800 text-[#FFCC00]" : "neu-inset bg-black/20 text-zinc-500"
                        )}>
                            {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>
                        <div className={cn(
                            "max-w-[85%] rounded-[1.5rem] px-5 py-4 text-sm relative group/msg",
                            m.role === 'user'
                                ? "cba-gold-gradient text-[#0a0a0f] rounded-br-none font-bold shadow-lg cba-gold-glow"
                                : "neu-raised rounded-bl-none text-zinc-200 border border-white/5"
                        )}>
                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/msg:opacity-100 transition-opacity rounded-[1.5rem]" />
                            <p className="relative z-10 leading-relaxed font-medium">{m.content}</p>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex items-end gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center neu-inset bg-black/20 text-[#FFCC00]">
                            <Bot className="h-4 w-4 animate-pulse" />
                        </div>
                        <div className="neu-raised rounded-2xl rounded-bl-none px-5 py-4 border border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] animate-bounce animate-delay-0" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] animate-bounce animate-delay-150" />
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] animate-bounce animate-delay-300" />
                                </div>
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Synthesizing</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Buffer */}
            <div className="p-6 border-t border-white/5 bg-white/[0.01] flex flex-col gap-4">
                <div className="flex gap-3">
                    <div className="flex-1 relative group">
                        <input
                            className="w-full neu-inset rounded-2xl px-5 py-4 text-sm focus-gold transition-all outline-none text-[#FFCC00] placeholder-zinc-700 font-bold bg-transparent pr-12"
                            placeholder="Input command query..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-700 uppercase tracking-widest group-focus-within:text-[#FFCC00]/50 transition-colors">
                            LN_PRT
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        aria-label="Transmit Signal"
                        className="cba-gold-gradient text-[#0a0a0f] min-w-[56px] flex items-center justify-center rounded-2xl btn-press disabled:opacity-30 shadow-lg cba-gold-glow border border-white/10"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                </div>
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3 text-zinc-700" />
                        <span className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.3em]">Latency: 12ms</span>
                    </div>
                    <span className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.3em]">Secure Channel 01</span>
                </div>
            </div>
        </div>
    );
}
