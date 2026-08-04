import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/client';
import Modal from '../components/ui/Modal';
import TableSkeleton from '../components/ui/TableSkeleton';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { formatCurrency, formatDate, scrollToFirstError } from '../utils/format';
import toast from 'react-hot-toast';
import {
    HiOutlinePlus,
    HiOutlineSearch,
    HiOutlineTrash,
    HiOutlineTag,
    HiOutlineInformationCircle,
    HiOutlinePencil,
    HiOutlineEye,
} from 'react-icons/hi';

interface PolicyOption {
    id: string;
    policyNumber: string | null;
    vehicleNumber: string | null;
    totalPremium: number | null;
    premiumAmount: number;
    customer: { name: string };
    company: { name: string };
    offer: { id: string } | null;
}

interface Offer {
    id: string;
    grossPremium: number;
    offerAmount: number;
    customerPayable: number;
    notes: string | null;
    createdAt: string;
    policy: {
        id: string;
        policyNumber: string | null;
        vehicleNumber: string | null;
        vehicleClass?: string | null;
        make?: string | null;
        model?: string | null;
        policyType?: string | null;
        startDate?: string | null;
        expiryDate?: string | null;
        status?: string | null;
        customer: { name: string; phone?: string; email?: string };
        dealer?: { name: string } | null;
        payments?: { id: string; status: string; amount: number; paidAmount: number | null }[];
    };
    company: { name: string };
    user?: { name: string; role: string } | null;
}

interface Summary {
    totalOffers: number;
    totalOfferAmount: number;
    totalGrossPremium: number;
    totalCustomerPayable: number;
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
const MetricCard: React.FC<{
    label: string;
    value: string;
    sub?: string;
    color?: string;
}> = ({ label, value, sub, color = 'text-primary-600' }) => (
    <div className="card card-body">
        <p className="text-xs text-surface-500 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Offers: React.FC = () => {
    const [offers, setOffers] = useState<Offer[]>([]);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
    const [summary, setSummary] = useState<Summary | null>(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [summaryLoading, setSummaryLoading] = useState(true);

    // Attach offer modal
    const [attachOpen, setAttachOpen] = useState(false);
    const [policies, setPolicies] = useState<PolicyOption[]>([]);
    const [policiesLoading, setPoliciesLoading] = useState(false);
    const [attachForm, setAttachForm] = useState({ policyId: '', offerAmount: '', notes: '' });
    const [attachErrors, setAttachErrors] = useState<Record<string, string>>({});
    const [isAttaching, setIsAttaching] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState<PolicyOption | null>(null);

    // Edit offer modal
    const [editOpen, setEditOpen] = useState(false);
    const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
    const [editForm, setEditForm] = useState({ offerAmount: '', notes: '' });
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});
    const [isUpdating, setIsUpdating] = useState(false);

    // Delete confirm modal
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [offerToDelete, setOfferToDelete] = useState<Offer | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // View offer details modal
    const [viewOpen, setViewOpen] = useState(false);
    const [viewingOffer, setViewingOffer] = useState<Offer | null>(null);

    const openViewModal = (offer: Offer) => {
        setViewingOffer(offer);
        setViewOpen(true);
    };

    // ── Fetch Offers ───────────────────────────────────────────────────────────
    const fetchOffers = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const res = await api.get('/offers', {
                params: { page, limit: 10, search: search || undefined },
            });
            setOffers(res.data.data);
            setMeta(res.data.meta);
        } catch {
            toast.error('Failed to fetch offers');
        } finally {
            setLoading(false);
        }
    }, [search]);

    // ── Fetch Summary ──────────────────────────────────────────────────────────
    const fetchSummary = useCallback(async () => {
        setSummaryLoading(true);
        try {
            const res = await api.get('/offers/summary');
            setSummary(res.data.data);
        } catch {
            // non-critical
        } finally {
            setSummaryLoading(false);
        }
    }, []);

    useEffect(() => { fetchOffers(); }, [fetchOffers]);
    useEffect(() => { fetchSummary(); }, [fetchSummary]);

    // Policy search filter state in attach modal
    const [policySearch, setPolicySearch] = useState('');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const comboboxRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ── Load policies for "Attach Offer" dropdown ──────────────────────────────
    const loadPoliciesForAttach = async () => {
        setPoliciesLoading(true);
        try {
            const res = await api.get('/policies', {
                params: { limit: 5000, status: 'active' },
            });
            // Include all policies regardless of existing offer — service handles duplicate guard
            setPolicies(res.data.data ?? []);
        } catch {
            toast.error('Failed to load policies');
        } finally {
            setPoliciesLoading(false);
        }
    };

    const openAttachModal = () => {
        setAttachForm({ policyId: '', offerAmount: '', notes: '' });
        setPolicySearch('');
        setAttachErrors({});
        setSelectedPolicy(null);
        setAttachOpen(true);
        loadPoliciesForAttach();
    };

    // Update selected policy preview when user picks a policy
    const handlePolicySelect = (policyId: string) => {
        const p = policies.find((p) => p.id === policyId) ?? null;
        setSelectedPolicy(p);
        setAttachForm((prev) => ({ ...prev, policyId }));
        setAttachErrors((prev) => ({ ...prev, policyId: '' }));
    };

    // Derived net customer payable preview
    const netPreview = selectedPolicy && attachForm.offerAmount
        ? (selectedPolicy.totalPremium ?? selectedPolicy.premiumAmount) - parseFloat(attachForm.offerAmount || '0')
        : null;

    // ── Validate Attach Form ───────────────────────────────────────────────────
    const validateAttach = () => {
        const errs: Record<string, string> = {};
        if (!attachForm.policyId) errs.policyId = 'Please select a policy';
        const amt = parseFloat(attachForm.offerAmount);
        if (!attachForm.offerAmount || isNaN(amt) || amt <= 0) {
            errs.offerAmount = 'Enter a valid offer amount greater than 0';
        } else if (selectedPolicy) {
            const gross = selectedPolicy.totalPremium ?? selectedPolicy.premiumAmount;
            if (amt >= gross) errs.offerAmount = `Offer cannot be equal to or exceed gross premium (${formatCurrency(gross)})`;
        }
        return errs;
    };

    const handleAttachSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validateAttach();
        if (Object.keys(errs).length > 0) {
            setAttachErrors(errs);
            scrollToFirstError();
            return;
        }
        setAttachErrors({});
        setIsAttaching(true);
        try {
            await api.post('/offers', {
                policyId: attachForm.policyId,
                offerAmount: parseFloat(attachForm.offerAmount),
                notes: attachForm.notes || undefined,
            });
            toast.success('Offer attached successfully');
            setAttachOpen(false);
            fetchOffers(meta.page);
            fetchSummary();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to attach offer');
        } finally {
            setIsAttaching(false);
        }
    };

    // ── Edit Offer ─────────────────────────────────────────────────────────────
    const openEditModal = (offer: Offer) => {
        setEditingOffer(offer);
        setEditForm({ offerAmount: String(offer.offerAmount), notes: offer.notes ?? '' });
        setEditErrors({});
        setEditOpen(true);
    };

    const validateEdit = () => {
        const errs: Record<string, string> = {};
        const amt = parseFloat(editForm.offerAmount);
        if (!editForm.offerAmount || isNaN(amt) || amt <= 0) {
            errs.offerAmount = 'Enter a valid offer amount greater than 0';
        } else if (editingOffer) {
            if (amt >= editingOffer.grossPremium) {
                errs.offerAmount = `Offer cannot be equal to or exceed gross premium (${formatCurrency(editingOffer.grossPremium)})`;
            }
        }
        return errs;
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validateEdit();
        if (Object.keys(errs).length > 0) {
            setEditErrors(errs);
            scrollToFirstError();
            return;
        }
        setEditErrors({});
        setIsUpdating(true);
        try {
            await api.put(`/offers/${editingOffer!.id}`, {
                offerAmount: parseFloat(editForm.offerAmount),
                notes: editForm.notes || undefined,
            });
            toast.success('Offer updated successfully');
            setEditOpen(false);
            fetchOffers(meta.page);
            fetchSummary();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update offer');
        } finally {
            setIsUpdating(false);
        }
    };

    // ── Delete Offer ───────────────────────────────────────────────────────────
    const handleDeleteClick = (offer: Offer) => {
        setOfferToDelete(offer);
        setDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!offerToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/offers/${offerToDelete.id}`);
            toast.success('Offer removed successfully');
            setDeleteOpen(false);
            setOfferToDelete(null);
            fetchOffers(meta.page);
            fetchSummary();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to remove offer');
        } finally {
            setIsDeleting(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4 animate-fade-in">
            {/* ── Header ── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Offers & Discounts</h1>
                    <p className="text-sm text-surface-500 mt-1">
                        Manage company promotional offers applied to Motor policies
                    </p>
                </div>
                <button onClick={openAttachModal} className="btn-primary">
                    <HiOutlinePlus className="w-4 h-4" />
                    Attach Offer
                </button>
            </div>

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {summaryLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="card card-body animate-pulse h-20" />
                    ))
                ) : summary ? (
                    <>
                        <MetricCard
                            label="Total Offers"
                            value={String(summary.totalOffers)}
                            sub="Policies with discounts"
                        />
                        <MetricCard
                            label="Total Offer Value"
                            value={formatCurrency(summary.totalOfferAmount)}
                            sub="Discounts applied by agency"
                            color="text-amber-600"
                        />
                        <MetricCard
                            label="Total Gross Premium"
                            value={formatCurrency(summary.totalGrossPremium)}
                            sub="Before discounts"
                            color="text-surface-700"
                        />
                        <MetricCard
                            label="Net Customer Payable"
                            value={formatCurrency(summary.totalCustomerPayable)}
                            sub="Customer collection target"
                            color="text-emerald-600"
                        />
                    </>
                ) : null}
            </div>

            {/* ── Search ── */}
            <div className="relative">
                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                    className="input pl-10"
                    placeholder="Search by customer, policy number or vehicle number..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* ── Table ── */}
            {loading ? (
                <TableSkeleton cols={7} rows={10} />
            ) : offers.length === 0 ? (
                <EmptyState
                    message="No offers found"
                    icon={<HiOutlineTag className="w-12 h-12" />}
                />
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="table-container hidden sm:block">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Customer</th>
                                    <th>Policy No.</th>
                                    <th>Company</th>
                                    <th>Gross Premium</th>
                                    <th>Offer Discount</th>
                                    <th>Net Customer Payable</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {offers.map((o) => (
                                    <tr key={o.id}>
                                        <td className="font-medium text-surface-900">
                                            {o.policy.customer?.name || '—'}
                                        </td>
                                        <td className="text-xs text-surface-500">
                                            {o.policy.policyNumber || o.policy.vehicleNumber || '—'}
                                        </td>
                                        <td>{o.company.name}</td>
                                        <td className="font-medium">{formatCurrency(o.grossPremium)}</td>
                                        <td>
                                            <span className="badge-warning">
                                                -{formatCurrency(o.offerAmount)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge-success font-semibold">
                                                {formatCurrency(o.customerPayable)}
                                            </span>
                                        </td>
                                        <td className="text-surface-500 text-xs">{formatDate(o.createdAt)}</td>
                                        <td>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openViewModal(o)}
                                                    className="btn-ghost btn-sm text-primary-600 hover:text-primary-700"
                                                    title="View offer & policy details"
                                                >
                                                    <HiOutlineEye className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(o)}
                                                    className="btn-ghost btn-sm"
                                                    title="Edit offer"
                                                >
                                                    <HiOutlinePencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(o)}
                                                    className="btn-ghost btn-sm text-red-500"
                                                    title="Remove offer"
                                                >
                                                    <HiOutlineTrash className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="sm:hidden space-y-3">
                        {offers.map((o) => (
                            <div key={o.id} className="card card-body space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-surface-900">
                                            {o.policy.customer?.name || '—'}
                                        </p>
                                        <p className="text-xs text-surface-500">
                                            {o.policy.policyNumber || o.policy.vehicleNumber || 'No policy no.'}
                                        </p>
                                        <p className="text-xs text-surface-400">{o.company.name}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => openViewModal(o)} className="btn-ghost btn-sm text-primary-600" title="View details">
                                            <HiOutlineEye className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => openEditModal(o)} className="btn-ghost btn-sm">
                                            <HiOutlinePencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDeleteClick(o)} className="btn-ghost btn-sm text-red-500">
                                            <HiOutlineTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-surface-100">
                                    <div>
                                        <p className="text-[10px] text-surface-400 uppercase">Gross</p>
                                        <p className="text-xs font-semibold">{formatCurrency(o.grossPremium)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-surface-400 uppercase">Offer</p>
                                        <p className="text-xs font-semibold text-amber-600">-{formatCurrency(o.offerAmount)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-surface-400 uppercase">Net</p>
                                        <p className="text-xs font-semibold text-emerald-600">{formatCurrency(o.customerPayable)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Pagination
                        page={meta.page}
                        totalPages={meta.totalPages}
                        onPageChange={(p) => fetchOffers(p)}
                    />
                </>
            )}

            {/* ── Attach Offer Modal ── */}
            <Modal isOpen={attachOpen} onClose={() => setAttachOpen(false)} title="Attach Company Offer" size="md">
                <form onSubmit={handleAttachSubmit} className="space-y-4" noValidate>
                    {/* Search & Select Policy Combobox */}
                    <div>
                        <label className="label">Search Policy *</label>
                        {selectedPolicy ? (
                            /* Selected Policy Card */
                            <div className="bg-primary-50/60 border border-primary-200 rounded-xl p-3 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-surface-900 text-sm">{selectedPolicy.customer?.name}</p>
                                    <p className="text-xs text-surface-500">
                                        Policy No: <span className="font-medium text-surface-700">{selectedPolicy.policyNumber || selectedPolicy.vehicleNumber || '—'}</span> · {selectedPolicy.company?.name}
                                    </p>
                                    <p className="text-xs text-emerald-600 font-medium mt-0.5">
                                        Gross Premium: {formatCurrency(selectedPolicy.totalPremium ?? selectedPolicy.premiumAmount)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPolicy(null);
                                        setAttachForm(prev => ({ ...prev, policyId: '' }));
                                        setPolicySearch('');
                                        setDropdownOpen(true);
                                    }}
                                    className="btn-secondary btn-sm text-xs"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            /* Search Input + Interactive Dropdown Panel */
                            <div className="relative" ref={comboboxRef}>
                                <div className="relative">
                                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                                    <input
                                        type="text"
                                        className={`input pl-9 text-sm ${attachErrors.policyId ? 'border-red-500 focus:ring-red-400' : ''}`}
                                        data-error-field={attachErrors.policyId ? 'true' : undefined}
                                        placeholder="Type customer name, policy number, or vehicle number..."
                                        value={policySearch}
                                        onFocus={() => setDropdownOpen(true)}
                                        onChange={(e) => {
                                            setPolicySearch(e.target.value);
                                            setDropdownOpen(true);
                                        }}
                                    />
                                </div>

                                {/* Autocomplete Dropdown List */}
                                {dropdownOpen && !policiesLoading && (
                                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-surface-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-surface-100">
                                        <div className="px-3 py-1.5 bg-surface-50 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">
                                            {policySearch.trim() ? 'Search Results' : 'Latest 5 Policies'}
                                        </div>
                                        {policies
                                            .filter((p) => !p.offer)
                                            .filter((p) => {
                                                if (!policySearch.trim()) return true;
                                                const term = policySearch.toLowerCase();
                                                return (
                                                    p.customer?.name?.toLowerCase().includes(term) ||
                                                    p.policyNumber?.toLowerCase().includes(term) ||
                                                    p.vehicleNumber?.toLowerCase().includes(term) ||
                                                    p.company?.name?.toLowerCase().includes(term)
                                                );
                                            })
                                            .slice(0, policySearch.trim() ? 15 : 5)
                                            .map((p) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        handlePolicySelect(p.id);
                                                        setDropdownOpen(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 hover:bg-primary-50 transition-colors flex justify-between items-center group"
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-surface-900 group-hover:text-primary-700">
                                                            {p.customer?.name}
                                                        </p>
                                                        <p className="text-xs text-surface-400">
                                                            {p.policyNumber || p.vehicleNumber || 'No Policy No.'} · {p.company?.name}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                                                        {formatCurrency(p.totalPremium ?? p.premiumAmount)}
                                                    </span>
                                                </button>
                                            ))}
                                        {policies
                                            .filter((p) => !p.offer)
                                            .filter((p) => {
                                                if (!policySearch.trim()) return true;
                                                const term = policySearch.toLowerCase();
                                                return (
                                                    p.customer?.name?.toLowerCase().includes(term) ||
                                                    p.policyNumber?.toLowerCase().includes(term) ||
                                                    p.vehicleNumber?.toLowerCase().includes(term) ||
                                                    p.company?.name?.toLowerCase().includes(term)
                                                );
                                            }).length === 0 && (
                                            <div className="p-3 text-xs text-surface-400 text-center">
                                                No policies match "{policySearch}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        {attachErrors.policyId && (
                            <p className="text-xs text-red-500 mt-1">{attachErrors.policyId}</p>
                        )}
                    </div>

                    {/* Gross Premium Preview */}
                    {selectedPolicy && (
                        <div className="bg-surface-50 rounded-xl p-3 text-sm space-y-1 border border-surface-200">
                            <div className="flex justify-between">
                                <span className="text-surface-500">Gross Premium</span>
                                <span className="font-semibold">
                                    {formatCurrency(selectedPolicy.totalPremium ?? selectedPolicy.premiumAmount)}
                                </span>
                            </div>
                            {netPreview !== null && netPreview > 0 && (
                                <>
                                    <div className="flex justify-between text-amber-600">
                                        <span>Company Offer</span>
                                        <span className="font-semibold">
                                            -{formatCurrency(parseFloat(attachForm.offerAmount || '0'))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-emerald-600 pt-1 border-t border-surface-200">
                                        <span className="font-medium">Net Customer Payable</span>
                                        <span className="font-bold">{formatCurrency(netPreview)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Offer Amount */}
                    <div>
                        <label className="label">Offer Amount (₹) *</label>
                        <input
                            type="number"
                            className={`input ${attachErrors.offerAmount ? 'border-red-500 focus:ring-red-400' : ''}`}
                            data-error-field={attachErrors.offerAmount ? 'true' : undefined}
                            placeholder="e.g. 20000"
                            value={attachForm.offerAmount}
                            onChange={(e) => {
                                setAttachForm((prev) => ({ ...prev, offerAmount: e.target.value }));
                                setAttachErrors((prev) => ({ ...prev, offerAmount: '' }));
                            }}
                        />
                        {attachErrors.offerAmount && (
                            <p className="text-xs text-red-500 mt-1">{attachErrors.offerAmount}</p>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="label">Notes (Optional)</label>
                        <textarea
                            className="input"
                            rows={2}
                            placeholder="e.g. Diwali offer by XYZ Insurance"
                            value={attachForm.notes}
                            onChange={(e) => setAttachForm((prev) => ({ ...prev, notes: e.target.value }))}
                        />
                    </div>

                    {/* Info note */}
                    <div className="flex gap-2 text-xs text-surface-500 bg-blue-50 rounded-xl p-3 border border-blue-100">
                        <HiOutlineInformationCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <span>
                            The customer's pending payment will be automatically updated to the Net Customer Payable amount.
                        </span>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setAttachOpen(false)} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <Button type="submit" isLoading={isAttaching} className="btn-primary flex-1">
                            Attach Offer
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ── Edit Offer Modal ── */}
            <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Offer" size="md">
                {editingOffer && (
                    <form onSubmit={handleEditSubmit} className="space-y-4" noValidate>
                        {/* Read-only summary */}
                        <div className="bg-surface-50 rounded-xl p-3 text-sm space-y-1 border border-surface-200">
                            <p className="font-medium text-surface-700">{editingOffer.policy.customer?.name}</p>
                            <p className="text-xs text-surface-500">
                                {editingOffer.policy.policyNumber || editingOffer.policy.vehicleNumber || '—'} ·{' '}
                                {editingOffer.company.name}
                            </p>
                            <div className="flex justify-between pt-1 border-t border-surface-200">
                                <span className="text-surface-500">Gross Premium</span>
                                <span className="font-semibold">{formatCurrency(editingOffer.grossPremium)}</span>
                            </div>
                        </div>

                        <div>
                            <label className="label">Offer Amount (₹) *</label>
                            <input
                                type="number"
                                className={`input ${editErrors.offerAmount ? 'border-red-500 focus:ring-red-400' : ''}`}
                                data-error-field={editErrors.offerAmount ? 'true' : undefined}
                                value={editForm.offerAmount}
                                onChange={(e) => {
                                    setEditForm((prev) => ({ ...prev, offerAmount: e.target.value }));
                                    setEditErrors((prev) => ({ ...prev, offerAmount: '' }));
                                }}
                            />
                            {editErrors.offerAmount && (
                                <p className="text-xs text-red-500 mt-1">{editErrors.offerAmount}</p>
                            )}
                            {editForm.offerAmount && parseFloat(editForm.offerAmount) > 0 && (
                                <p className="text-xs text-emerald-600 mt-1">
                                    Net customer payable:{' '}
                                    {formatCurrency(editingOffer.grossPremium - parseFloat(editForm.offerAmount || '0'))}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="label">Notes (Optional)</label>
                            <textarea
                                className="input"
                                rows={2}
                                value={editForm.notes}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setEditOpen(false)} className="btn-secondary flex-1">
                                Cancel
                            </button>
                            <Button type="submit" isLoading={isUpdating} className="btn-primary flex-1">
                                Update Offer
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* ── Delete Confirm Modal ── */}
            <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} title="Remove Offer" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        Are you sure you want to remove the offer for{' '}
                        <strong>{offerToDelete?.policy.customer?.name}</strong>?
                        <br />
                        <span className="text-xs text-surface-400 mt-1 block">
                            The customer's pending payment will be restored to the gross premium of{' '}
                            <strong>{offerToDelete ? formatCurrency(offerToDelete.grossPremium) : ''}</strong>.
                        </span>
                    </p>
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setDeleteOpen(false)}
                            className="btn-secondary flex-1"
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <Button
                            type="button"
                            onClick={confirmDelete}
                            isLoading={isDeleting}
                            className="btn-danger flex-1"
                        >
                            Remove Offer
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── View Offer Details Modal ── */}
            <Modal isOpen={viewOpen} onClose={() => setViewOpen(false)} title="Offer & Policy Details" size="lg">
                {viewingOffer && (
                    <div className="space-y-5 animate-fade-in">
                        {/* Offer Financial Banner */}
                        <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-900 text-white rounded-2xl p-4 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                                <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30">
                                    Promotional Discount Applied
                                </span>
                                <h3 className="text-lg font-bold text-white mt-1.5">{viewingOffer.policy.customer?.name}</h3>
                                <p className="text-xs text-primary-200">
                                    {viewingOffer.company.name} · {viewingOffer.policy.policyNumber || viewingOffer.policy.vehicleNumber || 'No Policy No.'}
                                </p>
                            </div>
                            <div className="flex gap-4 sm:gap-6 bg-white/10 backdrop-blur-md rounded-xl px-4 py-2.5 text-right w-full sm:w-auto justify-between sm:justify-end border border-white/10">
                                <div>
                                    <p className="text-[10px] text-primary-200 uppercase font-medium">Gross</p>
                                    <p className="text-sm font-semibold">{formatCurrency(viewingOffer.grossPremium)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-amber-300 uppercase font-medium">Offer</p>
                                    <p className="text-sm font-bold text-amber-300">-{formatCurrency(viewingOffer.offerAmount)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-emerald-300 uppercase font-medium">Net Payable</p>
                                    <p className="text-base font-bold text-emerald-300">{formatCurrency(viewingOffer.customerPayable)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Grid details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Customer & Contact Info */}
                            <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-2.5">
                                <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider">Customer Contact Information</h4>
                                <div>
                                    <p className="text-[11px] text-surface-400 font-medium">Customer Name</p>
                                    <p className="text-sm font-semibold text-surface-900">{viewingOffer.policy.customer?.name || '—'}</p>
                                </div>
                                {viewingOffer.policy.customer?.phone && (
                                    <div>
                                        <p className="text-[11px] text-surface-400 font-medium">Phone Number</p>
                                        <p className="text-xs font-medium text-surface-800">{viewingOffer.policy.customer.phone}</p>
                                    </div>
                                )}
                                {viewingOffer.policy.customer?.email && (
                                    <div>
                                        <p className="text-[11px] text-surface-400 font-medium">Email Address</p>
                                        <p className="text-xs font-medium text-surface-800">{viewingOffer.policy.customer.email}</p>
                                    </div>
                                )}
                            </div>

                            {/* Policy & Vehicle Info */}
                            <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-2.5">
                                <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider">Policy & Vehicle Specs</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-[11px] text-surface-400 font-medium">Policy Number</p>
                                        <p className="text-xs font-semibold text-surface-900">{viewingOffer.policy.policyNumber || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-surface-400 font-medium">Vehicle Number</p>
                                        <p className="text-xs font-semibold text-surface-900">{viewingOffer.policy.vehicleNumber || '—'}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-200">
                                    <div>
                                        <p className="text-[11px] text-surface-400 font-medium">Insurance Company</p>
                                        <p className="text-xs font-medium text-surface-800">{viewingOffer.company.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-surface-400 font-medium">Vehicle Class / Specs</p>
                                        <p className="text-xs font-medium text-surface-800">
                                            {viewingOffer.policy.vehicleClass?.replace(/_/g, ' ') || `${viewingOffer.policy.make || ''} ${viewingOffer.policy.model || ''}`.trim() || 'Motor'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Inception Dates & Payment Status */}
                        <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-3">
                            <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider">Policy Inception & Payment Sync</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                <div>
                                    <p className="text-surface-400 font-medium">Start Date</p>
                                    <p className="font-semibold text-surface-800">{viewingOffer.policy.startDate ? formatDate(viewingOffer.policy.startDate) : '—'}</p>
                                </div>
                                <div>
                                    <p className="text-surface-400 font-medium">Expiry Date</p>
                                    <p className="font-semibold text-surface-800">{viewingOffer.policy.expiryDate ? formatDate(viewingOffer.policy.expiryDate) : '—'}</p>
                                </div>
                                <div>
                                    <p className="text-surface-400 font-medium">Dealer</p>
                                    <p className="font-semibold text-surface-800">{viewingOffer.policy.dealer?.name || 'Direct'}</p>
                                </div>
                            </div>

                            {viewingOffer.policy.payments && viewingOffer.policy.payments.length > 0 && (
                                <div className="pt-2 border-t border-surface-200 flex flex-wrap justify-between items-center text-xs gap-2">
                                    <span className="text-surface-500 font-medium">Associated Payment Record Status:</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-0.5 rounded-full font-semibold capitalize text-[11px] ${
                                            viewingOffer.policy.payments[0].status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                            viewingOffer.policy.payments[0].status === 'partial' ? 'bg-amber-100 text-amber-700' :
                                            'bg-rose-100 text-rose-700'
                                        }`}>
                                            {viewingOffer.policy.payments[0].status}
                                        </span>
                                        <span className="text-surface-700 font-semibold">
                                            (Paid: {formatCurrency(viewingOffer.policy.payments[0].paidAmount || 0)} / Target: {formatCurrency(viewingOffer.policy.payments[0].amount)})
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Offer Metadata & Notes */}
                        <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-surface-400 font-medium">Offer Created On</span>
                                <span className="font-semibold text-surface-800">{formatDate(viewingOffer.createdAt)}</span>
                            </div>
                            {viewingOffer.user?.name && (
                                <div className="flex justify-between items-center">
                                    <span className="text-surface-400 font-medium">Created By</span>
                                    <span className="font-semibold text-surface-800">{viewingOffer.user.name} ({viewingOffer.user.role})</span>
                                </div>
                            )}
                            {viewingOffer.notes && (
                                <div className="pt-2 border-t border-surface-200">
                                    <p className="text-surface-400 font-medium mb-1">Offer Notes / Remarks:</p>
                                    <p className="bg-white p-2.5 rounded-lg border border-surface-200 text-surface-700 italic text-xs">"{viewingOffer.notes}"</p>
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-end pt-2">
                            <button type="button" onClick={() => setViewOpen(false)} className="btn-secondary">
                                Close Details
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Offers;
