import { useState, useEffect } from 'react';
import { invoicingApi } from '@/api';
import {
    ArrowLeft, Edit2, Archive, Loader2, Building2, Mail, Phone, MapPin,
    FileText, Plus, UserPlus, DollarSign, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerDetailProps {
    customerId: string;
    onBack: () => void;
    onEdit: (customer: any) => void;
}

const formatABN = (abn: string | null | undefined): string => {
    if (!abn) return '—';
    const digits = abn.replace(/\D/g, '');
    if (digits.length !== 11) return abn;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
};

const formatAUD = (cents: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(cents / 100);

export function CustomerDetail({ customerId, onBack, onEdit }: CustomerDetailProps) {
    const [customer, setCustomer] = useState<any>(null);
    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [archiving, setArchiving] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [showAddContact, setShowAddContact] = useState(false);
    const [newContact, setNewContact] = useState({ name: '', email: '', phone: '', role: '' });
    const [addingContact, setAddingContact] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [cust, contactsRes] = await Promise.all([
                    invoicingApi.getCustomer(customerId),
                    invoicingApi.listContacts(customerId).catch(() => []),
                ]);
                setCustomer(cust);
                setContacts(Array.isArray(contactsRes) ? contactsRes : contactsRes?.contacts ?? []);
            } catch (err) {
                console.error('Failed to load customer:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [customerId]);

    const handleArchive = async () => {
        setArchiving(true);
        try {
            await invoicingApi.archiveCustomer(customerId);
            onBack();
        } catch (err) {
            console.error('Failed to archive customer:', err);
        } finally {
            setArchiving(false);
            setShowArchiveConfirm(false);
        }
    };

    const handleAddContact = async () => {
        if (!newContact.name.trim()) return;
        setAddingContact(true);
        try {
            await invoicingApi.addContact(customerId, newContact);
            const res = await invoicingApi.listContacts(customerId).catch(() => []);
            setContacts(Array.isArray(res) ? res : res?.contacts ?? []);
            setNewContact({ name: '', email: '', phone: '', role: '' });
            setShowAddContact(false);
        } catch (err) {
            console.error('Failed to add contact:', err);
        } finally {
            setAddingContact(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="neu-raised rounded-2xl p-8 text-center">
                <p className="text-zinc-400">Customer not found.</p>
                <button onClick={onBack} className="mt-4 text-[#FFCC00] text-sm hover:underline">Go back</button>
            </div>
        );
    }

    const outstanding = customer.outstandingBalance ?? 0;
    const overdue = customer.overdueAmount ?? 0;
    const invoices = customer.invoices ?? [];

    return (
        <div className="space-y-6">
            {/* Back + Actions */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 text-sm transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Customers
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onEdit(customer)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg neu-raised text-zinc-300 hover:text-zinc-100 text-sm transition-colors"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                    </button>
                    <button
                        onClick={() => setShowArchiveConfirm(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg neu-raised text-red-400 hover:text-red-300 text-sm transition-colors"
                    >
                        <Archive className="w-3.5 h-3.5" />
                        Archive
                    </button>
                </div>
            </div>

            {/* Archive Confirmation */}
            {showArchiveConfirm && (
                <div className="neu-raised rounded-xl p-4 border border-red-500/20">
                    <p className="text-sm text-zinc-300 mb-3">
                        Are you sure you want to archive <strong>{customer.businessName}</strong>? This will hide them from the active list.
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleArchive}
                            disabled={archiving}
                            className="px-4 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 disabled:opacity-50"
                        >
                            {archiving ? 'Archiving...' : 'Confirm Archive'}
                        </button>
                        <button
                            onClick={() => setShowArchiveConfirm(false)}
                            className="px-4 py-1.5 rounded-lg neu-raised text-zinc-400 text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Customer Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 neu-raised rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="neu-inset p-3 rounded-xl text-[#FFCC00]">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-zinc-100">{customer.businessName}</h3>
                            {customer.abn && (
                                <p className="text-xs text-zinc-500 font-mono">ABN: {formatABN(customer.abn)}</p>
                            )}
                        </div>
                        <span className={cn(
                            "ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            customer.isActive !== false
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-zinc-700/50 text-zinc-500"
                        )}>
                            {customer.isActive !== false ? 'Active' : 'Archived'}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {customer.contactName && (
                            <div className="flex items-center gap-2 text-zinc-400">
                                <UserPlus className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                {customer.contactName}
                            </div>
                        )}
                        {customer.email && (
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Mail className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                {customer.email}
                            </div>
                        )}
                        {customer.phone && (
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Phone className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                {customer.phone}
                            </div>
                        )}
                        {(customer.address || customer.city) && (
                            <div className="flex items-center gap-2 text-zinc-400">
                                <MapPin className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                                {[customer.address, customer.city, customer.state, customer.postcode].filter(Boolean).join(', ')}
                            </div>
                        )}
                    </div>

                    {customer.notes && (
                        <div className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">
                            <span className="text-zinc-600 uppercase tracking-wider font-semibold text-[10px]">Notes: </span>
                            {customer.notes}
                        </div>
                    )}

                    {customer.paymentTermsDays && (
                        <p className="text-xs text-zinc-500">
                            Payment terms: <span className="text-zinc-300">{customer.paymentTermsDays} days</span>
                        </p>
                    )}
                </div>

                {/* Balance Summary */}
                <div className="space-y-4">
                    <div className="neu-raised rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-[#FFCC00]" />
                            <span className="text-[10px] text-zinc-600 uppercase font-semibold tracking-wider">Outstanding</span>
                        </div>
                        <p className={cn(
                            "text-2xl font-bold",
                            outstanding > 0 ? "text-[#FFCC00]" : "text-zinc-500"
                        )}>
                            {formatAUD(outstanding)}
                        </p>
                    </div>
                    <div className="neu-raised rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="text-[10px] text-zinc-600 uppercase font-semibold tracking-wider">Overdue</span>
                        </div>
                        <p className={cn(
                            "text-2xl font-bold",
                            overdue > 0 ? "text-red-400" : "text-zinc-500"
                        )}>
                            {formatAUD(overdue)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Contacts */}
            <div className="neu-raised rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Contacts</h4>
                    <button
                        onClick={() => setShowAddContact(!showAddContact)}
                        className="flex items-center gap-1.5 text-[#FFCC00] text-xs font-semibold hover:underline"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Contact
                    </button>
                </div>

                {showAddContact && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 neu-inset rounded-xl">
                        <input
                            type="text"
                            placeholder="Name *"
                            value={newContact.name}
                            onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                            className="px-3 py-1.5 rounded-lg neu-inset bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={newContact.email}
                            onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                            className="px-3 py-1.5 rounded-lg neu-inset bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
                        />
                        <input
                            type="text"
                            placeholder="Phone"
                            value={newContact.phone}
                            onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                            className="px-3 py-1.5 rounded-lg neu-inset bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
                        />
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Role"
                                value={newContact.role}
                                onChange={e => setNewContact(p => ({ ...p, role: e.target.value }))}
                                className="flex-1 px-3 py-1.5 rounded-lg neu-inset bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
                            />
                            <button
                                onClick={handleAddContact}
                                disabled={addingContact || !newContact.name.trim()}
                                className="px-3 py-1.5 rounded-lg bg-[#FFCC00] text-[#0a0a0f] text-xs font-bold disabled:opacity-40"
                            >
                                {addingContact ? '...' : 'Add'}
                            </button>
                        </div>
                    </div>
                )}

                {contacts.length === 0 ? (
                    <p className="text-xs text-zinc-600">No additional contacts.</p>
                ) : (
                    <div className="space-y-2">
                        {contacts.map((c: any, i: number) => (
                            <div key={c.id ?? i} className="flex items-center gap-4 px-3 py-2 rounded-lg hover:bg-zinc-800/30 text-sm">
                                <span className="font-medium text-zinc-200">{c.name}</span>
                                {c.role && <span className="text-zinc-600 text-xs">({c.role})</span>}
                                {c.email && <span className="text-zinc-500">{c.email}</span>}
                                {c.phone && <span className="text-zinc-500">{c.phone}</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Invoice History */}
            <div className="neu-raised rounded-2xl p-5 space-y-3">
                <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Invoice History</h4>
                {invoices.length === 0 ? (
                    <p className="text-xs text-zinc-600">No invoices for this customer yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-800">
                                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Invoice #</th>
                                    <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Date</th>
                                    <th className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Amount</th>
                                    <th className="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv: any) => (
                                    <tr key={inv.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                                        <td className="px-3 py-2 text-zinc-200 font-mono">{inv.invoiceNumber ?? inv.id}</td>
                                        <td className="px-3 py-2 text-zinc-400">{inv.issueDate ?? inv.date ?? '—'}</td>
                                        <td className="px-3 py-2 text-right font-semibold text-[#FFCC00]">{formatAUD(inv.totalCents ?? inv.total ?? 0)}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                inv.status === 'paid' ? "bg-emerald-500/20 text-emerald-400" :
                                                inv.status === 'overdue' ? "bg-red-500/20 text-red-400" :
                                                inv.status === 'sent' ? "bg-blue-500/20 text-blue-400" :
                                                "bg-zinc-700/50 text-zinc-500"
                                            )}>
                                                {inv.status ?? 'draft'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
