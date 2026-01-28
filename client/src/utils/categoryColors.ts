const CATEGORY_PALETTE = [
    // Reds & Pinks
    {
        name: 'red',
        bg: 'bg-red-500',
        text: 'text-red-600',
        border: 'border-red-500',
        gradient: 'from-red-500 to-red-400',
        dot: 'bg-red-500',
        badge: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/20', shadow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]' }
    },
    {
        name: 'rose',
        bg: 'bg-rose-500',
        text: 'text-rose-600',
        border: 'border-rose-500',
        gradient: 'from-rose-500 to-rose-400',
        dot: 'bg-rose-500',
        badge: { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-500/20', shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]' }
    },
    {
        name: 'pink',
        bg: 'bg-pink-500',
        text: 'text-pink-600',
        border: 'border-pink-500',
        gradient: 'from-pink-500 to-pink-400',
        dot: 'bg-pink-500',
        badge: { bg: 'bg-pink-500/10', text: 'text-pink-600', border: 'border-pink-500/20', shadow: 'shadow-[0_0_15px_rgba(236,72,153,0.15)]' }
    },
    {
        name: 'fuchsia',
        bg: 'bg-fuchsia-500',
        text: 'text-fuchsia-600',
        border: 'border-fuchsia-500',
        gradient: 'from-fuchsia-500 to-fuchsia-400',
        dot: 'bg-fuchsia-500',
        badge: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-600', border: 'border-fuchsia-500/20', shadow: 'shadow-[0_0_15px_rgba(217,70,239,0.15)]' }
    },
    // Purples
    {
        name: 'purple',
        bg: 'bg-purple-500',
        text: 'text-purple-600',
        border: 'border-purple-500',
        gradient: 'from-purple-500 to-purple-400',
        dot: 'bg-purple-500',
        badge: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20', shadow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]' }
    },
    {
        name: 'violet',
        bg: 'bg-violet-500',
        text: 'text-violet-600',
        border: 'border-violet-500',
        gradient: 'from-violet-500 to-violet-400',
        dot: 'bg-violet-500',
        badge: { bg: 'bg-violet-500/10', text: 'text-violet-600', border: 'border-violet-500/20', shadow: 'shadow-[0_0_15px_rgba(139,92,246,0.15)]' }
    },
    {
        name: 'indigo',
        bg: 'bg-indigo-500',
        text: 'text-indigo-600',
        border: 'border-indigo-500',
        gradient: 'from-indigo-500 to-indigo-400',
        dot: 'bg-indigo-500',
        badge: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', border: 'border-indigo-500/20', shadow: 'shadow-[0_0_15px_rgba(99,102,241,0.15)]' }
    },
    // Blues
    {
        name: 'blue',
        bg: 'bg-blue-500',
        text: 'text-blue-600',
        border: 'border-blue-500',
        gradient: 'from-blue-500 to-blue-400',
        dot: 'bg-blue-500',
        badge: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20', shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]' }
    },
    {
        name: 'sky',
        bg: 'bg-sky-500',
        text: 'text-sky-600',
        border: 'border-sky-500',
        gradient: 'from-sky-500 to-sky-400',
        dot: 'bg-sky-500',
        badge: { bg: 'bg-sky-500/10', text: 'text-sky-600', border: 'border-sky-500/20', shadow: 'shadow-[0_0_15px_rgba(14,165,233,0.15)]' }
    },
    {
        name: 'cyan',
        bg: 'bg-cyan-500',
        text: 'text-cyan-600',
        border: 'border-cyan-500',
        gradient: 'from-cyan-500 to-cyan-400',
        dot: 'bg-cyan-500',
        badge: { bg: 'bg-cyan-500/10', text: 'text-cyan-600', border: 'border-cyan-500/20', shadow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]' }
    },
    // Greens/Teals
    {
        name: 'teal',
        bg: 'bg-teal-500',
        text: 'text-teal-600',
        border: 'border-teal-500',
        gradient: 'from-teal-500 to-teal-400',
        dot: 'bg-teal-500',
        badge: { bg: 'bg-teal-500/10', text: 'text-teal-600', border: 'border-teal-500/20', shadow: 'shadow-[0_0_15px_rgba(20,184,166,0.15)]' }
    },
    {
        name: 'emerald',
        bg: 'bg-emerald-500',
        text: 'text-emerald-600',
        border: 'border-emerald-500',
        gradient: 'from-emerald-500 to-emerald-400',
        dot: 'bg-emerald-500',
        badge: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]' }
    },
    {
        name: 'green',
        bg: 'bg-green-500',
        text: 'text-green-600',
        border: 'border-green-500',
        gradient: 'from-green-500 to-green-400',
        dot: 'bg-green-500',
        badge: { bg: 'bg-green-500/10', text: 'text-green-600', border: 'border-green-500/20', shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.15)]' }
    },
    {
        name: 'lime',
        bg: 'bg-lime-500',
        text: 'text-lime-600',
        border: 'border-lime-500',
        gradient: 'from-lime-500 to-lime-400',
        dot: 'bg-lime-500',
        badge: { bg: 'bg-lime-500/10', text: 'text-lime-600', border: 'border-lime-500/20', shadow: 'shadow-[0_0_15px_rgba(132,204,22,0.15)]' }
    },
    // Yellows/Oranges
    {
        name: 'yellow',
        bg: 'bg-yellow-500',
        text: 'text-yellow-600',
        border: 'border-yellow-500',
        gradient: 'from-yellow-500 to-yellow-400',
        dot: 'bg-yellow-500',
        badge: { bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-500/20', shadow: 'shadow-[0_0_15px_rgba(234,179,8,0.15)]' }
    },
    {
        name: 'amber',
        bg: 'bg-amber-500',
        text: 'text-amber-600',
        border: 'border-amber-500',
        gradient: 'from-amber-500 to-amber-400',
        dot: 'bg-amber-500',
        badge: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)]' }
    },
    {
        name: 'orange',
        bg: 'bg-orange-500',
        text: 'text-orange-600',
        border: 'border-orange-500',
        gradient: 'from-orange-500 to-orange-400',
        dot: 'bg-orange-500',
        badge: { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-500/20', shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]' }
    },
    // Neutrals / unique
    {
        name: 'slate',
        bg: 'bg-slate-500',
        text: 'text-slate-600',
        border: 'border-slate-500',
        gradient: 'from-slate-500 to-slate-400',
        dot: 'bg-slate-500',
        badge: { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-500/20', shadow: 'shadow-[0_0_15px_rgba(100,116,139,0.15)]' }
    },
    {
        name: 'zinc',
        bg: 'bg-zinc-500',
        text: 'text-zinc-600',
        border: 'border-zinc-500',
        gradient: 'from-zinc-500 to-zinc-400',
        dot: 'bg-zinc-500',
        badge: { bg: 'bg-zinc-500/10', text: 'text-zinc-600', border: 'border-zinc-500/20', shadow: 'shadow-[0_0_15px_rgba(113,113,122,0.15)]' }
    },
    {
        name: 'stone',
        bg: 'bg-stone-500',
        text: 'text-stone-600',
        border: 'border-stone-500',
        gradient: 'from-stone-500 to-stone-400',
        dot: 'bg-stone-500',
        badge: { bg: 'bg-stone-500/10', text: 'text-stone-600', border: 'border-stone-500/20', shadow: 'shadow-[0_0_15px_rgba(120,113,108,0.15)]' }
    },
];

// Consistent mapping for known categories to ensure they always get the same color
const PREDEFINED_MAPPING: Record<string, number> = {
    'Office Supplies': 15, // Amber
    'Travel': 9,           // Cyan
    'Meals': 4,            // Purple
    'Utilities': 16,       // Orange
    'Professional Fees': 2,// Pink
    'Rent': 7,             // Blue
    'Software': 6,         // Indigo
    'Groceries': 11,       // Emerald
    'Transport': 18,       // Zinc
    'Entertainment': 3,    // Fuchsia
    'Health': 10,          // Teal
    'Insurance': 13,       // Lime
    'Uncategorized': 0,    // Red
};

export function getCategoryColor(category: string) {
    if (!category) return CATEGORY_PALETTE[0]; // Default/Red

    // Check predefined
    const predefinedIndex = PREDEFINED_MAPPING[category];
    if (predefinedIndex !== undefined) {
        return CATEGORY_PALETTE[predefinedIndex];
    }

    // Hash string to pick a color deterministically
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = category.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % CATEGORY_PALETTE.length;
    return CATEGORY_PALETTE[index]!;
}
