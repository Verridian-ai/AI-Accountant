import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Users,
    Activity,
    CreditCard,
    FileCheck,
    MessageSquare,
    Download,
    Shield,
    RefreshCw,
    Settings,
    LayoutDashboard,
} from 'lucide-react';

import { UserManagement, type User } from './components/UserManagement';
import { SystemMetrics } from './components/SystemMetrics';
import { SubscriptionOverview } from './components/SubscriptionOverview';
import { ParserHealth, type ParserError } from './components/ParserHealth';
import { FeedbackQueue } from './components/FeedbackQueue';

interface AdminDashboardProps {
    className?: string;
}

type ExportFormat = 'csv' | 'json';

export function AdminDashboard({ className }: AdminDashboardProps) {
    const [activeTab, setActiveTab] = useState('overview');
    const [isExporting, setIsExporting] = useState(false);

    // Export handlers
    const handleExportData = useCallback(async (dataType: string, format: ExportFormat) => {
        setIsExporting(true);
        try {
            // Simulate export operation
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // In production, this would trigger a download
            const blob = new Blob(
                [JSON.stringify({ dataType, exportedAt: new Date().toISOString() }, null, 2)],
                { type: format === 'json' ? 'application/json' : 'text/csv' }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${dataType}_export_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } finally {
            setIsExporting(false);
        }
    }, []);

    // User management handlers
    const handleViewUser = useCallback((userId: string) => {
        console.log('View user:', userId);
        // In production, navigate to user detail page or open modal
    }, []);

    const handleSuspendUser = useCallback(async (userId: string) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log('Suspend/unsuspend user:', userId);
    }, []);

    const handleDeleteUser = useCallback(async (userId: string) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log('Delete user:', userId);
    }, []);

    // Parser health handlers
    const handleRetryParsing = useCallback(async (statementId: string) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('Retry parsing:', statementId);
    }, []);

    const handleViewError = useCallback((error: ParserError) => {
        console.log('View error:', error);
        // In production, open error detail modal
    }, []);

    // Feedback handlers
    const handleApproveFeedback = useCallback(async (id: string) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log('Approve feedback:', id);
    }, []);

    const handleRejectFeedback = useCallback(async (id: string, reason?: string) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log('Reject feedback:', id, reason);
    }, []);

    const handleApplyCorrection = useCallback(async (id: string) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log('Apply correction:', id);
    }, []);

    const handleViewTransaction = useCallback((transactionId: string) => {
        console.log('View transaction:', transactionId);
        // In production, navigate to transaction or open modal
    }, []);

    return (
        <div className={cn('min-h-screen p-4 sm:p-6 lg:p-8', className)}>
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-4">
                        <div className="neu-raised p-4 rounded-2xl border border-white/5">
                            <Shield className="w-8 h-8 text-[#FFCC00]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gradient-gold">
                                    Admin Dashboard
                                </h1>
                                <Badge variant="default" className="hidden sm:flex">
                                    Super Admin
                                </Badge>
                            </div>
                            <p className="text-sm text-zinc-500">
                                System overview and management controls
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isExporting}
                            onClick={() => handleExportData('full_report', 'json')}
                        >
                            {isExporting ? (
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 mr-2" />
                            )}
                            Export All
                        </Button>
                        <Button variant="ghost" size="icon">
                            <Settings className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="flex flex-wrap h-auto gap-1 p-1.5">
                    <TabsTrigger value="overview" className="gap-2">
                        <LayoutDashboard className="w-4 h-4" />
                        <span className="hidden sm:inline">Overview</span>
                    </TabsTrigger>
                    <TabsTrigger value="users" className="gap-2">
                        <Users className="w-4 h-4" />
                        <span className="hidden sm:inline">Users</span>
                    </TabsTrigger>
                    <TabsTrigger value="metrics" className="gap-2">
                        <Activity className="w-4 h-4" />
                        <span className="hidden sm:inline">Metrics</span>
                    </TabsTrigger>
                    <TabsTrigger value="subscriptions" className="gap-2">
                        <CreditCard className="w-4 h-4" />
                        <span className="hidden sm:inline">Revenue</span>
                    </TabsTrigger>
                    <TabsTrigger value="parser" className="gap-2">
                        <FileCheck className="w-4 h-4" />
                        <span className="hidden sm:inline">Parser Health</span>
                    </TabsTrigger>
                    <TabsTrigger value="feedback" className="gap-2">
                        <MessageSquare className="w-4 h-4" />
                        <span className="hidden sm:inline">Feedback</span>
                    </TabsTrigger>
                </TabsList>

                {/* Overview Tab - Dashboard Summary */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Quick Stats */}
                        <SystemMetrics />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Parser Health Summary */}
                        <div className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5">
                            <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
                            <div className="relative">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="neu-inset p-3 rounded-xl border border-white/5">
                                            <FileCheck className="w-5 h-5 text-[#FFCC00]" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-zinc-100">
                                                Parser Status
                                            </h3>
                                            <p className="text-xs text-zinc-500">
                                                Quick health overview
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setActiveTab('parser')}
                                    >
                                        View All
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                        <p className="text-2xl font-bold text-emerald-400">96.1%</p>
                                        <p className="text-xs text-zinc-500">Success Rate</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                        <p className="text-2xl font-bold text-amber-400">8</p>
                                        <p className="text-xs text-zinc-500">Pending Review</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Feedback */}
                        <div className="neu-raised rounded-[2rem] p-6 relative overflow-hidden border border-white/5">
                            <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />
                            <div className="relative">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="neu-inset p-3 rounded-xl border border-white/5">
                                            <MessageSquare className="w-5 h-5 text-[#FFCC00]" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-zinc-100">
                                                Feedback Queue
                                            </h3>
                                            <p className="text-xs text-zinc-500">
                                                User corrections pending
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setActiveTab('feedback')}
                                    >
                                        View All
                                    </Button>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
                                        <p className="text-2xl font-bold text-amber-400">5</p>
                                        <p className="text-xs text-zinc-500">Pending</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                                        <p className="text-2xl font-bold text-emerald-400">12</p>
                                        <p className="text-xs text-zinc-500">Approved</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-center">
                                        <p className="text-2xl font-bold text-red-400">3</p>
                                        <p className="text-xs text-zinc-500">Rejected</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Users Tab */}
                <TabsContent value="users">
                    <UserManagement
                        onViewUser={handleViewUser}
                        onSuspendUser={handleSuspendUser}
                        onDeleteUser={handleDeleteUser}
                        onExportUsers={(format) => handleExportData('users', format)}
                    />
                </TabsContent>

                {/* Metrics Tab */}
                <TabsContent value="metrics">
                    <SystemMetrics />
                </TabsContent>

                {/* Subscriptions Tab */}
                <TabsContent value="subscriptions">
                    <SubscriptionOverview
                        onExportData={(format) => handleExportData('subscriptions', format)}
                    />
                </TabsContent>

                {/* Parser Health Tab */}
                <TabsContent value="parser">
                    <ParserHealth
                        onRetryParsing={handleRetryParsing}
                        onViewError={handleViewError}
                        onExportErrors={(format) => handleExportData('parser_errors', format)}
                    />
                </TabsContent>

                {/* Feedback Tab */}
                <TabsContent value="feedback">
                    <FeedbackQueue
                        onApproveFeedback={handleApproveFeedback}
                        onRejectFeedback={handleRejectFeedback}
                        onApplyCorrection={handleApplyCorrection}
                        onViewTransaction={handleViewTransaction}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default AdminDashboard;
