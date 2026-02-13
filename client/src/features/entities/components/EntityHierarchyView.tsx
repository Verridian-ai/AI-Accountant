import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, ChevronDown, ChevronRight, Plus, Link, Users } from 'lucide-react';
import type { EntityHierarchyResponse, EntityWithDetails, EntityData } from '@/api';
import { CreateEntityForm } from './CreateEntityForm';

const ENTITY_TYPE_COLORS: Record<string, string> = {
    company: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    trust: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    sole_trader: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    partnership: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    smsf: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    individual: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
    company: 'Company',
    trust: 'Trust',
    sole_trader: 'Sole Trader',
    partnership: 'Partnership',
    smsf: 'SMSF',
    individual: 'Individual',
};

const STATUS_COLORS: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400',
    inactive: 'bg-zinc-500/20 text-zinc-400',
    dormant: 'bg-amber-500/20 text-amber-400',
};

interface EntityHierarchyViewProps {
    hierarchy: EntityHierarchyResponse | null;
    loading: boolean;
    onRefresh: () => void;
}

export function EntityHierarchyView({ hierarchy, loading, onRefresh }: EntityHierarchyViewProps) {
    const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
    const [showCreateForm, setShowCreateForm] = useState(false);

    const toggleExpand = (id: string) => {
        setExpandedEntities(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <Card key={i} className="neu-raised border-0">
                        <CardContent className="p-4">
                            <Skeleton className="h-6 w-48 mb-2" />
                            <Skeleton className="h-4 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    const rootEntities = hierarchy?.rootEntities ?? [];
    const entitiesMap = new Map(
        (hierarchy?.entities ?? []).map(e => [e.id, e])
    );

    const handleEntityCreated = () => {
        setShowCreateForm(false);
        onRefresh();
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">
                    {rootEntities.length} root {rootEntities.length === 1 ? 'entity' : 'entities'}
                </p>
                <Button
                    onClick={() => setShowCreateForm(true)}
                    className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90 font-bold"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Entity
                </Button>
            </div>

            {rootEntities.length === 0 ? (
                <Card className="neu-raised border-0">
                    <CardContent className="p-8 text-center">
                        <Building2 className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                        <h3 className="text-lg font-bold text-zinc-300 mb-1">No Entities Yet</h3>
                        <p className="text-sm text-zinc-500 mb-4">
                            Create your first entity to start managing multi-entity structures
                        </p>
                        <Button
                            onClick={() => setShowCreateForm(true)}
                            className="bg-[#FFCC00] text-[#0a0a0f] hover:bg-[#FFCC00]/90 font-bold"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Entity
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {rootEntities.map(entity => (
                        <EntityNode
                            key={entity.id}
                            entity={entity}
                            details={entitiesMap.get(entity.id)}
                            entitiesMap={entitiesMap}
                            depth={0}
                            expandedEntities={expandedEntities}
                            onToggle={toggleExpand}
                        />
                    ))}
                </div>
            )}

            {/* Create Entity Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateForm(false)} />
                    <div className="relative w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto neu-raised rounded-2xl p-6">
                        <CreateEntityForm
                            existingEntities={hierarchy?.entities ?? []}
                            onSuccess={handleEntityCreated}
                            onCancel={() => setShowCreateForm(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

interface EntityNodeProps {
    entity: EntityData;
    details?: EntityWithDetails;
    entitiesMap: Map<string, EntityWithDetails>;
    depth: number;
    expandedEntities: Set<string>;
    onToggle: (id: string) => void;
}

function EntityNode({ entity, details, entitiesMap, depth, expandedEntities, onToggle }: EntityNodeProps) {
    const isExpanded = expandedEntities.has(entity.id);
    const children = details?.children ?? [];
    const hasChildren = children.length > 0;
    const accounts = details?.accounts ?? [];

    return (
        <div style={{ marginLeft: depth * 24 }}>
            <Card className="neu-raised border-0 hover:border-[#FFCC00]/20 border border-transparent transition-colors">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        {/* Expand/Collapse */}
                        <button
                            type="button"
                            onClick={() => onToggle(entity.id)}
                            className="p-1 rounded hover:bg-white/5 text-zinc-500 transition-colors"
                        >
                            {hasChildren ? (
                                isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                            ) : (
                                <div className="w-4 h-4" />
                            )}
                        </button>

                        {/* Entity Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-zinc-100 truncate">{entity.name}</h4>
                                <Badge variant="outline" className={ENTITY_TYPE_COLORS[entity.entityType] ?? ENTITY_TYPE_COLORS.individual}>
                                    {ENTITY_TYPE_LABELS[entity.entityType] ?? entity.entityType}
                                </Badge>
                                <Badge variant="outline" className={STATUS_COLORS[entity.status] ?? STATUS_COLORS.active}>
                                    {entity.status}
                                </Badge>
                                {entity.isConsolidatedParent && (
                                    <Badge variant="outline" className="bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/30">
                                        Consolidated Parent
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
                                {entity.abn && <span>ABN: {entity.abn}</span>}
                                <span className="flex items-center gap-1">
                                    <Link className="w-3 h-3" />
                                    {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                                </span>
                                {hasChildren && (
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3 h-3" />
                                        {children.length} child{children.length !== 1 ? 'ren' : ''}
                                    </span>
                                )}
                                <span>FY End: {entity.financialYearEnd}</span>
                            </div>
                        </div>
                    </div>

                    {/* Expanded accounts */}
                    {isExpanded && accounts.length > 0 && (
                        <div className="mt-3 ml-8 space-y-1">
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-1">Linked Accounts</p>
                            {accounts.map(acc => (
                                <div key={acc.id} className="flex items-center gap-2 text-xs text-zinc-400 neu-inset px-3 py-1.5 rounded-lg">
                                    <Link className="w-3 h-3 text-[#FFCC00]" />
                                    <span>Account {acc.accountId}</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{acc.role}</Badge>
                                    <span className="text-zinc-600">{acc.ownershipPercentage}% ownership</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Child Entities */}
            {isExpanded && children.map(child => (
                <EntityNode
                    key={child.id}
                    entity={child}
                    details={entitiesMap.get(child.id)}
                    entitiesMap={entitiesMap}
                    depth={depth + 1}
                    expandedEntities={expandedEntities}
                    onToggle={onToggle}
                />
            ))}
        </div>
    );
}
