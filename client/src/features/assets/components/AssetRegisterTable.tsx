import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ChevronUp, ChevronDown, Trash2, Calculator, Edit } from 'lucide-react';
import type { FixedAssetData } from '@/api';

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  disposed: 'bg-red-500/20 text-red-400 border-red-500/30',
  fully_depreciated: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  written_off: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Motor Vehicles': 'bg-blue-500/20 text-blue-400',
  'Plant & Equipment': 'bg-purple-500/20 text-purple-400',
  'Office Equipment': 'bg-cyan-500/20 text-cyan-400',
  'Furniture & Fittings': 'bg-orange-500/20 text-orange-400',
  'Computer Equipment': 'bg-indigo-500/20 text-indigo-400',
  'Building Improvements': 'bg-teal-500/20 text-teal-400',
  'Low Value Pool': 'bg-pink-500/20 text-pink-400',
  Software: 'bg-violet-500/20 text-violet-400',
  Tooling: 'bg-yellow-500/20 text-yellow-400',
  Other: 'bg-zinc-500/20 text-zinc-400',
};

type SortKey =
  | 'assetNumber'
  | 'assetName'
  | 'category'
  | 'purchaseDate'
  | 'purchasePrice'
  | 'currentWrittenDownValue'
  | 'status';

interface AssetRegisterTableProps {
  assets: FixedAssetData[];
  onDispose?: (asset: FixedAssetData) => void;
  onEdit?: (asset: FixedAssetData) => void;
}

export function AssetRegisterTable({ assets, onDispose, onEdit }: AssetRegisterTableProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('assetNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const cats = new Set(assets.map((a) => a.category));
    return Array.from(cats).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    let result = [...assets];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.assetName.toLowerCase().includes(q) ||
          a.assetNumber.toLowerCase().includes(q) ||
          a.supplier?.toLowerCase().includes(q),
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter((a) => a.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [assets, search, categoryFilter, statusFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  return (
    <Card className="neu-raised border-white/5">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-zinc-100">Asset Register</CardTitle>
        <div className="flex flex-wrap gap-3 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disposed">Disposed</SelectItem>
              <SelectItem value="fully_depreciated">Fully Depreciated</SelectItem>
              <SelectItem value="written_off">Written Off</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No assets found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-zinc-500 text-xs uppercase tracking-wider">
                  <th
                    className="text-left py-3 px-2 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('assetNumber')}
                  >
                    Asset # <SortIcon col="assetNumber" />
                  </th>
                  <th
                    className="text-left py-3 px-2 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('assetName')}
                  >
                    Name <SortIcon col="assetName" />
                  </th>
                  <th
                    className="text-left py-3 px-2 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('category')}
                  >
                    Category <SortIcon col="category" />
                  </th>
                  <th
                    className="text-left py-3 px-2 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('purchaseDate')}
                  >
                    Purchase <SortIcon col="purchaseDate" />
                  </th>
                  <th
                    className="text-right py-3 px-2 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('purchasePrice')}
                  >
                    Cost <SortIcon col="purchasePrice" />
                  </th>
                  <th
                    className="text-right py-3 px-2 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('currentWrittenDownValue')}
                  >
                    WDV <SortIcon col="currentWrittenDownValue" />
                  </th>
                  <th
                    className="text-left py-3 px-2 cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('status')}
                  >
                    Status <SortIcon col="status" />
                  </th>
                  <th className="text-right py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset) => (
                  <>
                    <tr
                      key={asset.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === asset.id ? null : asset.id)}
                    >
                      <td className="py-3 px-2 font-mono text-zinc-400">{asset.assetNumber}</td>
                      <td className="py-3 px-2 font-medium text-zinc-100">{asset.assetName}</td>
                      <td className="py-3 px-2">
                        <Badge
                          variant="outline"
                          className={CATEGORY_COLORS[asset.category] ?? CATEGORY_COLORS['Other']}
                        >
                          {asset.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-zinc-400">{asset.purchaseDate}</td>
                      <td className="py-3 px-2 text-right font-mono text-zinc-200">
                        {formatCurrency(asset.purchasePrice)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-[#FFCC00]">
                        {formatCurrency(asset.currentWrittenDownValue)}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className={STATUS_COLORS[asset.status] ?? ''}>
                          {asset.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div
                          className="flex justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-zinc-500 hover:text-[#FFCC00]"
                              onClick={() => onEdit(asset)}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {onDispose && asset.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
                              onClick={() => onDispose(asset)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === asset.id && (
                      <tr key={`${asset.id}-detail`} className="bg-white/[0.01]">
                        <td colSpan={8} className="p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-zinc-500 text-xs">Method</p>
                              <p className="text-zinc-200 font-medium">
                                {asset.depreciationMethod}
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500 text-xs">Effective Life</p>
                              <p className="text-zinc-200 font-medium">
                                {asset.effectiveLifeYears} years
                              </p>
                            </div>
                            <div>
                              <p className="text-zinc-500 text-xs">Residual Value</p>
                              <p className="text-zinc-200 font-medium">
                                {formatCurrency(asset.residualValue)}
                              </p>
                            </div>
                            {asset.location && (
                              <div>
                                <p className="text-zinc-500 text-xs">Location</p>
                                <p className="text-zinc-200 font-medium">{asset.location}</p>
                              </div>
                            )}
                            {asset.serialNumber && (
                              <div>
                                <p className="text-zinc-500 text-xs">Serial Number</p>
                                <p className="text-zinc-200 font-medium">{asset.serialNumber}</p>
                              </div>
                            )}
                            {asset.supplier && (
                              <div>
                                <p className="text-zinc-500 text-xs">Supplier</p>
                                <p className="text-zinc-200 font-medium">{asset.supplier}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 text-xs text-zinc-600 text-right">
          {filtered.length} of {assets.length} assets shown
        </div>
      </CardContent>
    </Card>
  );
}
