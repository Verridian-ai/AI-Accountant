import { useState, useMemo } from 'react';
import { Check, Plus, X, Tag, Sparkles, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { OnboardingStepProps } from '../types';
import { DEFAULT_CATEGORIES } from '../types';

// Category groupings for better UX
const CATEGORY_GROUPS = {
    'Income': ['Income - Sales', 'Income - Services'],
    'Operating Expenses': [
        'Advertising & Marketing',
        'Bank Fees',
        'Communication (Phone/Internet)',
        'Office Supplies',
        'Software & Subscriptions',
    ],
    'Professional Services': [
        'Legal & Accounting',
        'Education & Training',
        'Consulting',
    ],
    'Facilities': [
        'Rent & Lease',
        'Utilities',
        'Repairs & Maintenance',
    ],
    'Travel & Vehicle': [
        'Motor Vehicle',
        'Travel - Domestic',
        'Travel - International',
    ],
    'Staff & Insurance': [
        'Wages & Salaries',
        'Superannuation',
        'Business Insurance',
    ],
    'Assets & Finance': [
        'Equipment & Tools',
        'Depreciation',
        'Interest Expense',
    ],
    'Other': ['Client Entertainment'],
};

export function CategorySetupStep({ data, updateData }: OnboardingStepProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [showAddInput, setShowAddInput] = useState(false);

    // Combine default and custom categories
    const allCategories = useMemo(() => {
        return [...DEFAULT_CATEGORIES, ...data.customCategories];
    }, [data.customCategories]);

    // Filter categories based on search
    const filteredCategories = useMemo(() => {
        if (!searchTerm) return allCategories;
        const term = searchTerm.toLowerCase();
        return allCategories.filter(cat => cat.toLowerCase().includes(term));
    }, [allCategories, searchTerm]);

    // Get suggested categories based on entity type and industry
    const suggestedCategories = useMemo(() => {
        const suggestions = new Set<string>();

        // Base suggestions for all
        suggestions.add('Bank Fees');
        suggestions.add('Software & Subscriptions');

        if (data.entityType === 'individual') {
            // Personal finance categories
            return ['Bank Fees', 'Software & Subscriptions', 'Communication (Phone/Internet)', 'Travel - Domestic'];
        }

        // Business suggestions
        suggestions.add('Advertising & Marketing');
        suggestions.add('Office Supplies');

        // Industry-specific
        if (data.industry === 'Professional Services' || data.industry === 'Consulting') {
            suggestions.add('Legal & Accounting');
            suggestions.add('Education & Training');
            suggestions.add('Client Entertainment');
        }
        if (data.industry === 'E-commerce' || data.industry === 'Retail') {
            suggestions.add('Income - Sales');
            suggestions.add('Advertising & Marketing');
        }
        if (data.industry === 'Transport & Logistics') {
            suggestions.add('Motor Vehicle');
            suggestions.add('Business Insurance');
        }
        if (data.industry === 'Information Technology') {
            suggestions.add('Software & Subscriptions');
            suggestions.add('Equipment & Tools');
        }

        return Array.from(suggestions).slice(0, 6);
    }, [data.entityType, data.industry]);

    const handleAddCategory = () => {
        if (newCategory.trim() && !allCategories.includes(newCategory.trim())) {
            updateData({
                customCategories: [...data.customCategories, newCategory.trim()],
            });
            setNewCategory('');
            setShowAddInput(false);
        }
    };

    const handleRemoveCustomCategory = (category: string) => {
        updateData({
            customCategories: data.customCategories.filter(c => c !== category),
        });
    };

    return (
        <div className="p-6 sm:p-10 space-y-8">
            {/* Header */}
            <div className="text-center sm:text-left">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
                    <span className="text-gradient-gold">Customize your categories</span>
                </h2>
                <p className="text-sm text-zinc-500">
                    We've pre-selected categories based on your profile. Add or modify as needed.
                </p>
            </div>

            {/* AI Suggestions */}
            <div className="neu-inset rounded-2xl p-5 border border-[#FFCC00]/10 bg-[#FFCC00]/[0.02]">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-[#FFCC00]" />
                    <span className="text-[10px] font-black uppercase text-[#FFCC00] tracking-widest">
                        AI Suggestions for {data.industry || 'Your Profile'}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {suggestedCategories.map((cat) => (
                        <span
                            key={cat}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFCC00]/10 border border-[#FFCC00]/20 text-xs font-medium text-[#FFCC00]"
                        >
                            <Check className="w-3 h-3" />
                            {cat}
                        </span>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search categories..."
                    className="w-full pl-11 pr-4 py-3 neu-inset rounded-xl text-sm placeholder-zinc-600 border-white/10"
                />
            </div>

            {/* Categories Grid */}
            <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2">
                {Object.entries(CATEGORY_GROUPS).map(([group, categories]) => {
                    const filteredGroup = categories.filter(cat =>
                        filteredCategories.includes(cat)
                    );
                    if (filteredGroup.length === 0) return null;

                    return (
                        <div key={group}>
                            <h4 className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mb-3">
                                {group}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {filteredGroup.map((category) => (
                                    <CategoryTag
                                        key={category}
                                        label={category}
                                        isSelected={true}
                                        isSuggested={suggestedCategories.includes(category)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}

                {/* Custom Categories */}
                {data.customCategories.length > 0 && (
                    <div>
                        <h4 className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mb-3">
                            Your Custom Categories
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {data.customCategories.map((category) => (
                                <CategoryTag
                                    key={category}
                                    label={category}
                                    isSelected={true}
                                    isCustom={true}
                                    onRemove={() => handleRemoveCustomCategory(category)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Add Custom Category */}
            <div className="space-y-3">
                {showAddInput ? (
                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
                        <Input
                            type="text"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="Enter category name..."
                            className="flex-1 px-4 py-3 neu-inset rounded-xl text-sm border-white/10"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddCategory();
                                if (e.key === 'Escape') {
                                    setShowAddInput(false);
                                    setNewCategory('');
                                }
                            }}
                        />
                        <button
                            onClick={handleAddCategory}
                            disabled={!newCategory.trim()}
                            className="px-4 py-3 cba-gold-gradient text-[#0a0a0f] font-bold text-xs uppercase rounded-xl btn-press disabled:opacity-50"
                        >
                            Add
                        </button>
                        <button
                            onClick={() => {
                                setShowAddInput(false);
                                setNewCategory('');
                            }}
                            className="p-3 neu-raised-sm rounded-xl text-zinc-400 hover:text-red-400"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAddInput(true)}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-white/10 text-zinc-500 hover:text-[#FFCC00] hover:border-[#FFCC00]/30 transition-colors w-full justify-center"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">Add Custom Category</span>
                    </button>
                )}
            </div>

            {/* Info */}
            <p className="text-xs text-zinc-600 text-center">
                Categories help organize your transactions for better insights and tax reporting.
                You can always add or modify categories later in Settings.
            </p>
        </div>
    );
}

interface CategoryTagProps {
    label: string;
    isSelected?: boolean;
    isSuggested?: boolean;
    isCustom?: boolean;
    onRemove?: () => void;
}

function CategoryTag({ label, isSelected, isSuggested, isCustom, onRemove }: CategoryTagProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                isSelected
                    ? "bg-white/5 border border-white/10 text-zinc-300"
                    : "bg-transparent border border-white/5 text-zinc-500",
                isSuggested && "border-[#FFCC00]/20 bg-[#FFCC00]/5"
            )}
        >
            {isSuggested && <Sparkles className="w-3 h-3 text-[#FFCC00]" />}
            {!isSuggested && <Tag className="w-3 h-3 text-zinc-500" />}
            {label}
            {isCustom && onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="ml-1 p-0.5 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </span>
    );
}

export default CategorySetupStep;
