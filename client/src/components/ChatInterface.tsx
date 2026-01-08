import { useState } from 'react';
import { Send, Bot } from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../api';

export function ChatInterface() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
        { role: 'assistant', content: 'Hello! I can analyze your statement data. Ask me anything like "How much did I spend on groceries?"' }
    ]);
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const { answer } = await api.sendChatMessage(userMsg);
            setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't reach the AI service." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-gray-800">AI Financial Assistant</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m, i) => (
                    <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                        <div className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                            m.role === 'user' ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-800"
                        )}>
                            {m.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-2xl px-4 py-2 text-gray-500 text-xs animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t flex gap-2">
                <input
                    className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Ask a question..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <button
                    onClick={handleSend}
                    disabled={loading}
                    aria-label="Send message"
                    className="bg-purple-600 text-white p-2 rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                    <Send className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
