import { useEffect, useState } from 'react';
import { Statement, api } from '../api';
import { FileText, CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function StatementList() {
    const [statements, setStatements] = useState<Statement[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshStatements = async () => {
        try {
            const data = await api.fetchStatements();
            setStatements(data);
        } catch (e) {
            console.error('Failed to fetch statements', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshStatements();
        const interval = setInterval(refreshStatements, 5000);
        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = (status: Statement['parsingStatus']) => {
        switch (status) {
            case 'COMPLETED':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'PROCESSING':
                return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
            case 'FAILED':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return <Clock className="h-4 w-4 text-gray-400" />;
        }
    };

    const getStatusColor = (status: Statement['parsingStatus']) => {
        switch (status) {
            case 'COMPLETED': return 'bg-green-100 text-green-700';
            case 'PROCESSING': return 'bg-blue-100 text-blue-700';
            case 'FAILED': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl border p-6 shadow-sm">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-800">Uploaded Statements</h3>
                </div>
                <span className="text-xs text-gray-500">{statements.length} files</span>
            </div>
            
            {statements.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No statements uploaded yet</p>
                    <p className="text-xs mt-1">Drop PDF files in the statements folder</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                    {statements.map((stmt) => (
                        <div key={stmt.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    {getStatusIcon(stmt.parsingStatus)}
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm text-gray-900 truncate">
                                            {stmt.filename}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {new Date(stmt.uploadDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <span className={cn(
                                    "px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                                    getStatusColor(stmt.parsingStatus)
                                )}>
                                    {stmt.parsingStatus}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

