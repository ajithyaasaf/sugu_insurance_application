import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import TableSkeleton from '../components/ui/TableSkeleton';
import SearchableSelect from '../components/ui/SearchableSelect';
import { formatDate, formatCurrency, getStatusColor, scrollToFirstError, formatVehicleClass } from '../utils/format';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineSearch, HiOutlineShieldCheck, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';
import { CLAIM_STATUSES as claimStatusOptions, VEHICLE_CLASSES } from '../utils/constants';
import Button from '../components/ui/Button';

const initialForm = {
    customerId: '',
    policyId: '',
    claimNumber: '',
    claimAmount: '',
    estimatedAmount: '',
    billAmount: '',
    claimDate: '',
    status: 'filed',
    reason: '',
    surveyorName: '',
    surveyorPhone: '',
    workshopName: '',
};

const Claims: React.FC = () => {
    const [claims, setClaims] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [policies, setPolicies] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [vehicleClassFilter, setVehicleClassFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; customerName: string } | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchClaims = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const res = await api.get('/claims', {
                params: {
                    page,
                    limit: 10,
                    search: search || undefined,
                    status: statusFilter || undefined,
                    vehicleClass: vehicleClassFilter || undefined,
                },
            });
            setClaims(res.data.data);
            setMeta(res.data.meta);
        } catch { toast.error('Failed to fetch claims'); } finally { setLoading(false); }
    }, [search, statusFilter, vehicleClassFilter]);

    useEffect(() => { fetchClaims(); }, [fetchClaims]);

    useEffect(() => {
        const loadDropdowns = async () => {
            try {
                const [custRes, polRes] = await Promise.all([
                    api.get('/customers?limit=10000'),
                    api.get('/policies?limit=10000'),
                ]);
                setCustomers(custRes.data.data);
                setPolicies(polRes.data.data);
            } catch { }
        };
        loadDropdowns();
    }, []);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.customerId) errs.customerId = 'Please select a customer';
        if (!form.policyId) errs.policyId = 'Please select a policy';
        if (form.claimAmount && parseFloat(form.claimAmount) < 0) errs.claimAmount = 'Claim amount cannot be negative';
        if (form.estimatedAmount && parseFloat(form.estimatedAmount) < 0) errs.estimatedAmount = 'Estimated amount cannot be negative';
        if (form.billAmount && parseFloat(form.billAmount) < 0) errs.billAmount = 'Bill amount cannot be negative';
        if (!form.claimDate) errs.claimDate = 'Claim date is required';
        if (!form.status) errs.status = 'Please select a status';
        return errs;
    };

    const openCreate = () => {
        setEditing(null);
        setForm({ ...initialForm, claimDate: new Date().toISOString().split('T')[0] });
        setErrors({});
        setModalOpen(true);
    };

    const openEdit = (claim: any) => {
        setEditing(claim);
        setForm({
            customerId: claim.customerId,
            policyId: claim.policyId,
            claimNumber: claim.claimNumber || '',
            claimAmount: claim.claimAmount != null ? String(claim.claimAmount) : '',
            estimatedAmount: claim.estimatedAmount != null ? String(claim.estimatedAmount) : '',
            billAmount: claim.billAmount != null ? String(claim.billAmount) : '',
            claimDate: claim.claimDate?.split('T')[0] || '',
            status: claim.status,
            reason: claim.reason || '',
            surveyorName: claim.surveyorName || '',
            surveyorPhone: claim.surveyorPhone || '',
            workshopName: claim.workshopName || '',
        });
        setErrors({});
        setModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            scrollToFirstError();
            return;
        }
        setErrors({});

        const payload = {
            ...form,
            claimAmount: form.claimAmount ? parseFloat(form.claimAmount) : null,
            estimatedAmount: form.estimatedAmount ? parseFloat(form.estimatedAmount) : null,
            billAmount: form.billAmount ? parseFloat(form.billAmount) : null,
        };

        setIsSubmitting(true);
        try {
            if (editing) {
                await api.put(`/claims/${editing.id}`, payload);
                toast.success('Claim updated');
            } else {
                await api.post('/claims', payload);
                toast.success('Claim filed');
            }
            setModalOpen(false);
            fetchClaims(meta.page);
        } catch (err: any) { toast.error(err.response?.data?.message || 'Error saving claim'); } finally { setIsSubmitting(false); }
    };

    const handleDelete = (id: string, customerName: string) => {
        setDeleteConfirm({ id, customerName });
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        setDeleteLoading(true);
        try {
            await api.delete(`/claims/${deleteConfirm.id}`);
            toast.success('Claim deleted successfully');
            setDeleteConfirm(null);
            fetchClaims(meta.page);
        } catch {
            toast.error('Failed to delete claim');
        } finally {
            setDeleteLoading(false);
        }
    };

    const setField = (key: keyof typeof form, value: string) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setErrors(prev => ({ ...prev, [key]: '' }));
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Claims</h1>
                <button onClick={openCreate} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> File Claim</button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input className="input pl-10" placeholder="Search by customer, claim # or policy #..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <SearchableSelect
                    className="w-48"
                    options={VEHICLE_CLASSES.map(t => ({ value: t, label: formatVehicleClass(t) }))}
                    value={vehicleClassFilter}
                    onChange={setVehicleClassFilter}
                    allLabel="All Classes"
                    placeholder="Vehicle Class"
                />
                <SearchableSelect
                    className="w-40"
                    options={claimStatusOptions.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    allLabel="All Status"
                    placeholder="Status"
                />
                {(search || statusFilter || vehicleClassFilter) && (
                    <button onClick={() => { setSearch(''); setStatusFilter(''); setVehicleClassFilter(''); }} className="btn-ghost btn-sm self-start sm:self-auto">
                        Clear
                    </button>
                )}
            </div>

            {/* Table */}
            {loading ? (
                <TableSkeleton cols={9} rows={10} />
            ) : claims.length === 0 ? (
                <EmptyState message="No claims found" icon={<HiOutlineShieldCheck className="w-12 h-12" />} />
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="table-container hidden sm:block">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Customer</th>
                                    <th>Policy</th>
                                    <th>Claim # / Policy #</th>
                                    <th>Claim Settled Amount</th>
                                    <th>Estimated Amount</th>
                                    <th>Bill Amount</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {claims.map((c) => (
                                    <tr key={c.id}>
                                        <td className="font-medium text-surface-900">{c.customer?.name}</td>
                                        <td className="text-xs">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {c.policy?.policyType === 'motor'
                                                    ? `${c.policy.make || ''} ${c.policy.model || ''}`.trim() || 'Motor'
                                                    : c.policy?.productName || c.policy?.policyType}
                                                {c.policy?.vehicleNumber && ` (${c.policy.vehicleNumber})`}
                                                {c.policy?.vehicleClass && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-100 text-surface-700 border border-surface-200 uppercase">
                                                        {formatVehicleClass(c.policy.vehicleClass)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="text-xs">
                                            <p className="font-medium text-surface-900">{c.claimNumber || '—'}</p>
                                            {c.policy?.policyNumber && (
                                                <p className="text-surface-400 text-[10px] mt-0.5">Policy: {c.policy.policyNumber}</p>
                                            )}
                                            {(c.surveyorName || c.workshopName) && (
                                                <p className="text-[10px] text-surface-500 mt-1">
                                                    {c.surveyorName && `${c.policy?.policyType === 'health' ? 'TPA' : 'Srv'}: ${c.surveyorName}`}
                                                    {c.surveyorPhone && ` (${c.surveyorPhone})`}
                                                    {c.workshopName && ` | ${c.policy?.policyType === 'health' ? 'Hospital' : 'WS'}: ${c.workshopName}`}
                                                </p>
                                            )}
                                        </td>
                                        <td className="text-sm font-medium text-surface-900">
                                            {c.claimAmount != null
                                                ? formatCurrency(c.claimAmount)
                                                : <span className="text-surface-400 font-normal">—</span>}
                                        </td>
                                        <td className="text-sm">
                                            {c.estimatedAmount != null
                                                ? <span className="text-amber-700 font-medium">{formatCurrency(c.estimatedAmount)}</span>
                                                : <span className="text-surface-400">—</span>}
                                        </td>
                                        <td className="text-sm">
                                            {c.billAmount != null
                                                ? <span className="text-emerald-700 font-medium">{formatCurrency(c.billAmount)}</span>
                                                : <span className="text-surface-400">—</span>}
                                        </td>
                                        <td className="text-xs">{formatDate(c.claimDate)}</td>
                                        <td><span className={getStatusColor(c.status)}>{c.status}</span></td>
                                        <td>
                                            <div className="flex gap-1 justify-end">
                                                <button onClick={() => openEdit(c)} className="btn-ghost btn-sm p-1" title="Edit"><HiOutlinePencil className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(c.id, c.customer?.name)} className="btn-ghost btn-sm p-1 text-red-500 hover:text-red-700" title="Delete"><HiOutlineTrash className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="sm:hidden space-y-3">
                        {claims.map((c) => (
                            <div key={c.id} className="card card-body">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-semibold text-surface-900">{c.customer?.name}</p>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                            <p className="text-xs text-surface-500">
                                                {c.policy?.policyType === 'motor'
                                                    ? `${c.policy.make || ''} ${c.policy.model || ''}`.trim() || 'Motor'
                                                    : c.policy?.productName || c.policy?.policyType}
                                                {c.policy?.vehicleNumber && ` (${c.policy.vehicleNumber})`}
                                            </p>
                                            {c.policy?.vehicleClass && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-50 text-surface-500 border border-surface-100 uppercase">
                                                    {formatVehicleClass(c.policy.vehicleClass)}
                                                </span>
                                            )}
                                        </div>
                                        {c.claimNumber && <p className="text-[10px] text-surface-400 mt-0.5">Claim #: {c.claimNumber}</p>}
                                        {c.policy?.policyNumber && <p className="text-[10px] text-surface-400">Policy #: {c.policy.policyNumber}</p>}
                                    </div>
                                    <span className={getStatusColor(c.status)}>{c.status}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                                    <div className="bg-surface-50 rounded-lg p-2">
                                        <p className="text-[10px] text-surface-400 uppercase font-bold mb-0.5">Settled</p>
                                        <p className="font-semibold text-surface-900">{c.claimAmount != null ? formatCurrency(c.claimAmount) : '—'}</p>
                                    </div>
                                    <div className="bg-amber-50 rounded-lg p-2">
                                        <p className="text-[10px] text-amber-600 uppercase font-bold mb-0.5">Estimated</p>
                                        <p className="font-semibold text-amber-700">{c.estimatedAmount != null ? formatCurrency(c.estimatedAmount) : '—'}</p>
                                    </div>
                                    <div className="bg-emerald-50 rounded-lg p-2">
                                        <p className="text-[10px] text-emerald-600 uppercase font-bold mb-0.5">Bill</p>
                                        <p className="font-semibold text-emerald-700">{c.billAmount != null ? formatCurrency(c.billAmount) : '—'}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-surface-400 mt-2">{formatDate(c.claimDate)}</p>
                                {c.reason && <p className="text-xs text-surface-500 mt-1">{c.reason}</p>}
                                {(c.surveyorName || c.workshopName) && (
                                    <div className="text-[11px] text-surface-500 mt-1.5 bg-surface-50 p-2 rounded-lg border border-surface-100/50">
                                        {c.surveyorName && <p><strong>{c.policy?.policyType === 'health' ? 'TPA / Officer:' : 'Surveyor:'}</strong> {c.surveyorName} {c.surveyorPhone && `(${c.surveyorPhone})`}</p>}
                                        {c.workshopName && <p className="mt-0.5"><strong>{c.policy?.policyType === 'health' ? 'Hospital:' : 'Workshop:'}</strong> {c.workshopName}</p>}
                                    </div>
                                )}
                                <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100">
                                    <button onClick={() => openEdit(c)} className="btn-secondary btn-sm flex-1">Edit</button>
                                    <button onClick={() => handleDelete(c.id, c.customer?.name)} className="btn-sm flex-1 text-red-500 border border-red-200 rounded-lg hover:bg-red-50">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={(p) => fetchClaims(p)} />
                </>
            )}

            {/* Create / Edit Modal */}
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Claim' : 'File New Claim'}>
                {(() => {
                    const selectedPolicy = policies.find(p => p.id === form.policyId) || editing?.policy;
                    const isHealth = selectedPolicy?.policyType === 'health';

                    return (
                        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                            {/* Customer */}
                            <div>
                                <label className="label">Customer *</label>
                                <SearchableSelect
                                    disabled={!!editing}
                                    options={customers.map(c => ({ value: c.id, label: c.name }))}
                                    value={form.customerId}
                                    onChange={(val) => setField('customerId', val)}
                                    placeholder="Select Customer"
                                    hasError={!!errors.customerId}
                                />
                                {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>}
                            </div>

                            {/* Policy */}
                            <div>
                                <label className="label">Policy *</label>
                                <SearchableSelect
                                    disabled={!!editing}
                                    options={policies
                                        .filter(p => !form.customerId || p.customerId === form.customerId)
                                        .map(p => ({
                                            value: p.id,
                                            label: `${p.policyNumber ? `${p.policyNumber} — ` : ''}${p.productName || p.policyType}${p.vehicleNumber ? ` (${p.vehicleNumber})` : ''}`,
                                        }))}
                                    value={form.policyId}
                                    onChange={(val) => {
                                        const pol = policies.find(p => p.id === val);
                                        const resolvedCustomerId = pol?.customerId || pol?.customer?.id || '';

                                        if (pol?.customer) {
                                            const customerExists = customers.some(c => c.id === resolvedCustomerId);
                                            if (!customerExists) {
                                                setCustomers(prev => [...prev, pol.customer]);
                                            }
                                        }

                                        setForm(prev => ({
                                            ...prev,
                                            policyId: val,
                                            customerId: resolvedCustomerId || prev.customerId
                                        }));
                                        setErrors(prev => ({ ...prev, policyId: '', customerId: '' }));
                                    }}
                                    placeholder="Select Policy"
                                    hasError={!!errors.policyId}
                                />
                                {errors.policyId && <p className="text-xs text-red-500 mt-1">{errors.policyId}</p>}
                            </div>

                            {/* Claim Number / Policy Number label */}
                            <div>
                                <label className="label">Claim Number / Policy Number</label>
                                <input
                                    className="input"
                                    placeholder="e.g. CLM-2024-001 or Policy No."
                                    value={form.claimNumber}
                                    onChange={(e) => setField('claimNumber', e.target.value)}
                                />
                            </div>

                            {/* Amounts row */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="label">Claim Settled Amount</label>
                                    <input
                                        type="number" min="0" step="0.01"
                                        className={`input ${errors.claimAmount ? 'border-red-500 focus:ring-red-400' : ''}`}
                                        data-error-field={errors.claimAmount ? 'true' : undefined}
                                        placeholder="0.00 (optional)"
                                        value={form.claimAmount}
                                        onChange={(e) => setField('claimAmount', e.target.value)}
                                    />
                                    {errors.claimAmount && <p className="text-xs text-red-500 mt-1">{errors.claimAmount}</p>}
                                </div>
                                <div>
                                    <label className="label">Estimated Amount</label>
                                    <input
                                        type="number" min="0" step="0.01"
                                        className={`input ${errors.estimatedAmount ? 'border-red-500 focus:ring-red-400' : ''}`}
                                        placeholder="0.00 (optional)"
                                        value={form.estimatedAmount}
                                        onChange={(e) => setField('estimatedAmount', e.target.value)}
                                    />
                                    {errors.estimatedAmount && <p className="text-xs text-red-500 mt-1">{errors.estimatedAmount}</p>}
                                </div>
                                <div>
                                    <label className="label">Bill Amount</label>
                                    <input
                                        type="number" min="0" step="0.01"
                                        className={`input ${errors.billAmount ? 'border-red-500 focus:ring-red-400' : ''}`}
                                        placeholder="0.00 (optional)"
                                        value={form.billAmount}
                                        onChange={(e) => setField('billAmount', e.target.value)}
                                    />
                                    {errors.billAmount && <p className="text-xs text-red-500 mt-1">{errors.billAmount}</p>}
                                </div>
                            </div>

                            {/* Date */}
                            <div>
                                <label className="label">Claim Date *</label>
                                <input
                                    type="date"
                                    className={`input ${errors.claimDate ? 'border-red-500 focus:ring-red-400' : ''}`}
                                    data-error-field={errors.claimDate ? 'true' : undefined}
                                    value={form.claimDate}
                                    onChange={(e) => setField('claimDate', e.target.value)}
                                />
                                {errors.claimDate && <p className="text-xs text-red-500 mt-1">{errors.claimDate}</p>}
                            </div>

                            {/* Status */}
                            <div>
                                <label className="label">Status *</label>
                                <SearchableSelect
                                    options={claimStatusOptions.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                                    value={form.status}
                                    onChange={(val) => setField('status', val)}
                                    placeholder="Select Status"
                                    hasError={!!errors.status}
                                />
                                {errors.status && <p className="text-xs text-red-500 mt-1">{errors.status}</p>}
                            </div>

                            {/* Surveyor / TPA Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="label">{isHealth ? 'TPA / Claim Officer Name' : 'Surveyor Name'}</label>
                                    <input
                                        className="input"
                                        placeholder={isHealth ? "e.g. Medi Assist / Star Health Desk" : "Enter name"}
                                        value={form.surveyorName}
                                        onChange={(e) => setField('surveyorName', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="label">{isHealth ? 'TPA / Contact Number' : 'Surveyor Number'}</label>
                                    <input
                                        className="input"
                                        placeholder="e.g. 9876543210"
                                        value={form.surveyorPhone}
                                        onChange={(e) => setField('surveyorPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    />
                                </div>
                            </div>

                            {/* Facility: Hospital / Workshop Name */}
                            <div>
                                <label className="label">{isHealth ? 'Hospital Name' : 'Workshop Name'}</label>
                                <input
                                    className="input"
                                    placeholder={isHealth ? "e.g. Apollo Hospital, MIOT" : "e.g. Maruti Service Center"}
                                    value={form.workshopName}
                                    onChange={(e) => setField('workshopName', e.target.value)}
                                />
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="label">Reason / Notes</label>
                                <textarea
                                    className="input"
                                    rows={2}
                                    placeholder="Describe the reason for the claim..."
                                    value={form.reason}
                                    onChange={(e) => setField('reason', e.target.value)}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                                <Button type="submit" isLoading={isSubmitting} className="btn-primary flex-1">{editing ? 'Save Changes' : 'File Claim'}</Button>
                            </div>
                        </form>
                    );
                })()}
            </Modal>

            {/* Delete Confirm Modal */}
            <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete this claim?">
                {deleteConfirm && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                            <HiOutlineTrash className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-red-700">This action is permanent and cannot be undone.</p>
                                <p className="text-sm text-red-600 mt-1">Are you sure you want to delete the claim for <strong>{deleteConfirm.customerName}</strong>?</p>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4 mt-2 border-t border-surface-100">
                            <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 font-bold">Cancel</button>
                            <Button
                                type="button"
                                onClick={confirmDelete}
                                isLoading={deleteLoading}
                                loadingText="Deleting..."
                                className="btn-danger flex-1 font-bold"
                            >
                                Yes, Delete Claim
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <button onClick={openCreate} className="fab lg:hidden"><HiOutlinePlus className="w-6 h-6" /></button>
        </div>
    );
};

export default Claims;
