import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import SearchableSelect from '../components/ui/SearchableSelect';
import PolicyFormFields from '../components/ui/PolicyFormFields';
import TableSkeleton from '../components/ui/TableSkeleton';
import { formatDate, getStatusColor, scrollToFirstError, formatVehicleClass } from '../utils/format';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineSearch, HiOutlinePencil, HiOutlineTrash, HiOutlineUserAdd, HiOutlineTrendingUp } from 'react-icons/hi';
import { LEAD_STATUSES as statusOptions, VEHICLE_CLASSES } from '../utils/constants';
import Button from '../components/ui/Button';

const Leads: React.FC = () => {
    const [leads, setLeads] = useState<any[]>([]);
    const [companies, setCompanies] = useState<any[]>([]);
    const [dealers, setDealers] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [vehicleClassFilter, setVehicleClassFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [convertModalOpen, setConvertModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [convertingLead, setConvertingLead] = useState<any>(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [leadToDelete, setLeadToDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Initial State including Quote Fields
    const initialFormState = {
        name: '', phone: '', interestedProduct: '', status: 'new', nextFollowUpDate: '', notes: '',
        policyType: '', companyId: '', vehicleNumber: '', make: '', model: '', vehicleClass: '',
        idv: '', od: '', tp: '', tax: '', totalPremium: '', premiumAmount: '', startDate: '', expiryDate: '',
        dealerId: '', registrationDate: '', policyOrigin: 'fresh', ncbPercentage: '',
        tpStartDate: '', tpEndDate: ''
    };
    const [form, setForm] = useState(initialFormState);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [convertForm, setConvertForm] = useState({
        address: '',
        email: '',
        policyOrigin: 'fresh',
        ncbPercentage: '',
        policyNumber: '',
        policyType: '',
        companyId: '',
        premiumAmount: '',
        startDate: '',
        expiryDate: '',
        vehicleNumber: '',
        make: '',
        model: '',
        vehicleClass: '',
        tpStartDate: '',
        tpEndDate: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConverting, setIsConverting] = useState(false);
    const [convertDuplicateWarning, setConvertDuplicateWarning] = useState<string | null>(null);

    useEffect(() => {
        const checkDuplicateConvert = async () => {
            if (convertModalOpen && convertingLead?.name && convertingLead?.phone) {
                try {
                    const res = await api.get('/customers/check-duplicate', {
                        params: {
                            name: convertingLead.name,
                            phone: convertingLead.phone
                        }
                    });
                    if (res.data.data.exists) {
                        setConvertDuplicateWarning(`⚠️ Note: A customer named "${convertingLead.name}" with phone ${convertingLead.phone} already exists. Conversion is disabled.`);
                    } else {
                        setConvertDuplicateWarning(null);
                    }
                } catch {
                    setConvertDuplicateWarning(null);
                }
            } else {
                setConvertDuplicateWarning(null);
            }
        };
        checkDuplicateConvert();
    }, [convertModalOpen, convertingLead]);

    const fetchLeads = useCallback(async (page = 1, status = statusFilter, vehicleClass = vehicleClassFilter) => {
        setLoading(true);
        try {
            const res = await api.get('/leads', {
                params: {
                    page,
                    limit: meta.limit,
                    search: search || undefined,
                    status: status || undefined,
                    vehicleClass: vehicleClass || undefined
                }
            });
            setLeads(res.data.data);
            setMeta(res.data.meta);
        } catch { toast.error('Failed to fetch leads'); } finally { setLoading(false); }
    }, [search, statusFilter, vehicleClassFilter]);

    useEffect(() => {
        fetchLeads();
        const loadInitialData = async () => {
            try {
                const [compRes, dealerRes] = await Promise.all([
                    api.get('/companies'),
                    api.get('/dealers')
                ]);
                setCompanies(compRes.data.data);
                setDealers(dealerRes.data.data);
            } catch { }
        };
        loadInitialData();
    }, [fetchLeads]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.name.trim()) errs.name = 'Name is required';
        if (!form.phone) errs.phone = 'Phone number is required';
        else if (!/^[0-9]{10}$/.test(form.phone)) errs.phone = 'Enter a valid 10-digit phone number';
        if (!form.status) errs.status = 'Please select a status';
        return errs;
    };

    const openCreate = () => {
        setEditing(null);
        setForm(initialFormState);
        setErrors({});
        setModalOpen(true);
    };

    const openEdit = (lead: any) => {
        setEditing(lead);
        setErrors({});
        setForm({
            ...initialFormState,
            name: lead.name, phone: lead.phone || '', interestedProduct: lead.interestedProduct || '',
            status: lead.status, nextFollowUpDate: lead.nextFollowUpDate?.split('T')[0] || '', notes: lead.notes || '',
            policyType: lead.policyType || '', companyId: lead.companyId || '', vehicleNumber: lead.vehicleNumber || '',
            make: lead.make || '', model: lead.model || '', vehicleClass: lead.vehicleClass || '',
            idv: lead.idv?.toString() || '', od: lead.od?.toString() || '', tp: lead.tp?.toString() || '',
            tax: lead.tax?.toString() || '', totalPremium: lead.totalPremium?.toString() || '',
            premiumAmount: lead.premiumAmount?.toString() || '',
            startDate: lead.startDate?.split('T')[0] || '', expiryDate: lead.expiryDate?.split('T')[0] || '',
            dealerId: lead.dealerId || '', registrationDate: lead.registrationDate?.split('T')[0] || '',
            policyOrigin: lead.policyOrigin || 'fresh',
            ncbPercentage: lead.ncbPercentage !== null && lead.ncbPercentage !== undefined ? lead.ncbPercentage.toString() : '',
            tpStartDate: lead.tpStartDate?.split('T')[0] || '',
            tpEndDate: lead.tpEndDate?.split('T')[0] || ''
        });
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
        setIsSubmitting(true);
        try {
            // Parse numbers for payload
            const payload = {
                ...form,
                nextFollowUpDate: form.nextFollowUpDate || undefined,
                policyType: form.policyType || undefined,
                companyId: form.companyId || undefined,
                vehicleNumber: form.vehicleNumber || undefined,
                make: form.make || undefined,
                model: form.model || undefined,
                vehicleClass: form.vehicleClass || undefined,
                startDate: form.startDate || undefined,
                expiryDate: form.expiryDate || undefined,
                tpStartDate: (form.vehicleClass === 'SAOD_TW' || form.vehicleClass === 'SAOD_PVT') && form.tpStartDate ? form.tpStartDate : null,
                tpEndDate: (form.vehicleClass === 'SAOD_TW' || form.vehicleClass === 'SAOD_PVT') && form.tpEndDate ? form.tpEndDate : null,
                dealerId: form.dealerId || undefined,
                idv: form.idv ? parseFloat(form.idv) : undefined,
                od: form.od ? parseFloat(form.od) : undefined,
                tp: form.tp ? parseFloat(form.tp) : undefined,
                tax: form.tax ? parseFloat(form.tax) : undefined,
                totalPremium: form.totalPremium ? parseFloat(form.totalPremium) : (form.premiumAmount ? parseFloat(form.premiumAmount) : undefined),
                premiumAmount: form.premiumAmount ? parseFloat(form.premiumAmount) : undefined,
                registrationDate: form.registrationDate || undefined,
                policyOrigin: form.policyOrigin,
                ncbPercentage: form.ncbPercentage ? parseFloat(form.ncbPercentage as string) : undefined,
            };

            if (editing) {
                await api.put(`/leads/${editing.id}`, payload);
                toast.success('Lead updated');
            } else {
                await api.post('/leads', payload);
                toast.success('Lead created');
            }
            setModalOpen(false);
            fetchLeads(meta.page);
        } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); } finally { setIsSubmitting(false); }
    };

    const handleDeleteClick = (lead: any) => {
        setLeadToDelete(lead);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!leadToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/leads/${leadToDelete.id}`);
            toast.success('Lead deleted');
            setDeleteConfirmOpen(false);
            setLeadToDelete(null);
            fetchLeads(meta.page);
        } catch {
            toast.error('Failed to delete');
        } finally {
            setIsDeleting(false);
        }
    };

    const openConvert = (lead: any) => {
        setConvertingLead(lead);
        setConvertForm({
            address: '',
            email: '',
            policyOrigin: lead.policyOrigin || 'fresh',
            ncbPercentage: lead.ncbPercentage !== null && lead.ncbPercentage !== undefined ? lead.ncbPercentage.toString() : '',
            policyNumber: lead.policyNumber || '',
            policyType: lead.policyType || '',
            companyId: lead.companyId || '',
            premiumAmount: lead.premiumAmount?.toString() || '',
            startDate: lead.startDate?.split('T')[0] || '',
            expiryDate: lead.expiryDate?.split('T')[0] || '',
            vehicleNumber: lead.vehicleNumber || '',
            make: lead.make || '',
            model: lead.model || '',
            vehicleClass: lead.vehicleClass || '',
            tpStartDate: lead.tpStartDate?.split('T')[0] || '',
            tpEndDate: lead.tpEndDate?.split('T')[0] || '',
        });
        setErrors({});
        setConvertModalOpen(true);
    };

    const handleConvert = async (e: React.FormEvent) => {
        e.preventDefault();

        // Perform strict validation for Solution B mandatory fields
        const errs: Record<string, string> = {};
        const policyType = convertingLead?.policyType || convertForm.policyType;
        const companyId = convertingLead?.companyId || convertForm.companyId;
        const premiumAmount = (convertingLead?.premiumAmount !== null && convertingLead?.premiumAmount !== undefined) 
            ? convertingLead.premiumAmount 
            : convertForm.premiumAmount;
        const startDate = convertingLead?.startDate || convertForm.startDate;
        const expiryDate = convertingLead?.expiryDate || convertForm.expiryDate;
        const policyNumber = convertingLead?.policyNumber || convertForm.policyNumber;

        if (!policyType) errs.policyType = 'Policy type is required';
        if (!companyId) errs.companyId = 'Insurer is required';
        if (!policyNumber) errs.policyNumber = 'Policy number is required';
        if (premiumAmount === '' || premiumAmount === undefined || premiumAmount === null) errs.premiumAmount = 'Premium is required';
        if (!startDate) errs.startDate = 'Start date is required';
        if (!expiryDate) errs.expiryDate = 'Expiry date is required';
        else if (startDate && expiryDate <= startDate) errs.expiryDate = 'Expiry date must be after start date';

        // Motor-specific validation matching Policies.tsx direct creation
        if (policyType === 'motor') {
            const vehicleNumber = convertingLead?.vehicleNumber || convertForm.vehicleNumber;
            const make = convertingLead?.make || convertForm.make;
            const model = convertingLead?.model || convertForm.model;

            if (!vehicleNumber) errs.vehicleNumber = 'Vehicle number is required';
            if (!make) errs.make = 'Make is required';
            if (!model) errs.model = 'Model is required';
        }

        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        setIsConverting(true);
        try {
            const finalClass = convertingLead?.vehicleClass || convertForm.vehicleClass;
            const isSaod = finalClass === 'SAOD_TW' || finalClass === 'SAOD_PVT';
            const payload = {
                address: convertForm.address || undefined,
                email: convertForm.email || undefined,
                policyOrigin: convertForm.policyOrigin,
                ncbPercentage: convertForm.ncbPercentage ? parseFloat(convertForm.ncbPercentage) : undefined,
                tpStartDate: isSaod ? (convertingLead?.tpStartDate || convertForm.tpStartDate || null) : null,
                tpEndDate: isSaod ? (convertingLead?.tpEndDate || convertForm.tpEndDate || null) : null,
                
                // Dynamically append any missing details provided inline in the modal
                ...(!convertingLead?.policyType && { policyType: convertForm.policyType }),
                ...(!convertingLead?.companyId && { companyId: convertForm.companyId }),
                ...(!convertingLead?.policyNumber && { policyNumber: convertForm.policyNumber }),
                ...((convertingLead?.premiumAmount === null || convertingLead?.premiumAmount === undefined) && { premiumAmount: parseFloat(convertForm.premiumAmount) }),
                ...(!convertingLead?.startDate && { startDate: convertForm.startDate }),
                ...(!convertingLead?.expiryDate && { expiryDate: convertForm.expiryDate }),
                ...(!convertingLead?.vehicleNumber && { vehicleNumber: convertForm.vehicleNumber || undefined }),
                ...(!convertingLead?.make && { make: convertForm.make || undefined }),
                ...(!convertingLead?.model && { model: convertForm.model || undefined }),
                ...(!convertingLead?.vehicleClass && { vehicleClass: convertForm.vehicleClass || undefined }),
            };

            await api.post(`/leads/${convertingLead.id}/convert`, payload);
            toast.success('Lead converted to customer and policy generated!');
            setConvertModalOpen(false);
            fetchLeads(meta.page);
        } catch (err: any) { 
            toast.error(err.response?.data?.message || 'Error converting lead'); 
        } finally { 
            setIsConverting(false); 
        }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Leads</h1>
                <button onClick={openCreate} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> Add Lead</button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input className="input pl-10" placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <SearchableSelect
                    className="w-full sm:w-40"
                    options={statusOptions.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    allLabel="All Status"
                    placeholder="Search status..."
                />
                <SearchableSelect
                    className="w-full sm:w-40"
                    options={VEHICLE_CLASSES.map(v => ({ value: v, label: formatVehicleClass(v) }))}
                    value={vehicleClassFilter}
                    onChange={setVehicleClassFilter}
                    allLabel="All Classes"
                    placeholder="Search class..."
                />
            </div>

            {/* Table */}
            {loading ? (
                <TableSkeleton cols={6} rows={10} />
            ) : leads.length === 0 ? (
                <EmptyState message="No leads found" icon={<HiOutlineTrendingUp className="w-12 h-12" />} />
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="table-container hidden sm:block">
                        <table className="table">
                            <thead>
                                <tr><th>Name</th><th>Phone</th><th>Product</th><th>Status</th><th>Follow-up</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {leads.map((lead) => (
                                    <tr key={lead.id}>
                                        <td className="font-medium text-surface-900">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {lead.name}
                                                {lead.policyType === 'motor' && lead.vehicleClass && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-100 text-surface-700 border border-surface-200 uppercase">
                                                        {formatVehicleClass(lead.vehicleClass)}
                                                    </span>
                                                )}
                                                {lead.policyOrigin === 'new_vehicle' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">New Vehicle</span>}
                                                {lead.policyOrigin === 'external_renewal' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">External</span>}
                                                {lead.policyOrigin === 'in_system_renewal' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">Own Renewal</span>}
                                                {lead.policyOrigin === 'fresh' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-100 text-surface-600">Fresh</span>}
                                            </div>
                                        </td>
                                        <td>{lead.phone || '—'}</td>
                                        <td>{lead.interestedProduct || '—'}</td>
                                        <td><span className={getStatusColor(lead.status)}>{lead.status}</span></td>
                                        <td>{lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : '—'}</td>
                                        <td>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => openEdit(lead)} className="btn-ghost btn-sm"><HiOutlinePencil className="w-3.5 h-3.5" /></button>
                                                {lead.status !== 'converted' && <button onClick={() => openConvert(lead)} className="btn-ghost btn-sm text-emerald-600"><HiOutlineUserAdd className="w-3.5 h-3.5" /></button>}
                                                <button onClick={() => handleDeleteClick(lead)} className="btn-ghost btn-sm text-red-500"><HiOutlineTrash className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="sm:hidden space-y-3">
                        {leads.map((lead) => (
                            <div key={lead.id} className="card card-body">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-semibold text-surface-900 flex items-center gap-1.5">
                                            {lead.name}
                                            {lead.policyOrigin === 'new_vehicle' && <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-green-200 text-[10px] font-medium bg-green-50 text-green-800">New Vehicle</span>}
                                            {lead.policyOrigin === 'external_renewal' && <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-amber-200 text-[10px] font-medium bg-amber-50 text-amber-800">External</span>}
                                            {lead.policyOrigin === 'in_system_renewal' && <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-blue-200 text-[10px] font-medium bg-blue-50 text-blue-800">Own Renewal</span>}
                                            {lead.policyOrigin === 'fresh' && <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-surface-200 text-[10px] font-medium bg-surface-50 text-surface-600">Fresh</span>}
                                        </p>
                                        <p className="text-xs text-surface-500">{lead.phone || 'No phone'}</p>
                                    </div>
                                    <span className={getStatusColor(lead.status)}>{lead.status}</span>
                                </div>
                                {lead.interestedProduct && <p className="text-xs text-surface-500 mb-2">Product: {lead.interestedProduct}</p>}
                                <div className="flex gap-2 mt-2">
                                    <button onClick={() => openEdit(lead)} className="btn-secondary btn-sm flex-1">Edit</button>
                                    {lead.status !== 'converted' && <button onClick={() => openConvert(lead)} className="btn-primary btn-sm flex-1">Convert</button>}
                                    <button onClick={() => handleDeleteClick(lead)} className="btn-danger btn-sm">Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={(p) => fetchLeads(p)} />
                </>
            )}

            {/* Create/Edit Modal */}
            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Lead' : 'New Lead'}>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div>
                        <label className="label">Name *</label>
                        <input
                            className={`input ${errors.name ? 'border-red-500 focus:ring-red-400' : ''}`}
                            data-error-field={errors.name ? 'true' : undefined}
                            placeholder="Enter full name"
                            value={form.name}
                            onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors(prev => ({ ...prev, name: '' })); }}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                    </div>
                    <div>
                        <label className="label">Phone *</label>
                        <input
                            type="tel"
                            className={`input ${errors.phone ? 'border-red-500 focus:ring-red-400' : ''}`}
                            data-error-field={errors.phone ? 'true' : undefined}
                            placeholder="9876543210"
                            value={form.phone}
                            onChange={(e) => { setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }); setErrors(prev => ({ ...prev, phone: '' })); }}
                        />
                        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                    </div>
                    <div><label className="label">Interested Product</label><input className="input" value={form.interestedProduct} onChange={(e) => setForm({ ...form, interestedProduct: e.target.value })} /></div>
                    <div>
                        <label className="label">Status *</label>
                        <SearchableSelect
                            options={statusOptions.filter(s => s !== 'converted').map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                            value={form.status}
                            onChange={(val) => { setForm({ ...form, status: val }); setErrors(prev => ({ ...prev, status: '' })); }}
                            placeholder="Select Status"
                            hasError={!!errors.status}
                        />
                        {errors.status && <p className="text-xs text-red-500 mt-1">{errors.status}</p>}
                    </div>
                    <div><label className="label">Next Follow-up Date</label><input type="date" className="input" value={form.nextFollowUpDate} onChange={(e) => setForm({ ...form, nextFollowUpDate: e.target.value })} /></div>
                    <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
 
                    <PolicyFormFields form={form} setForm={setForm} companies={companies} dealers={dealers} showQuoteHeader />
 
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                        <Button type="submit" isLoading={isSubmitting} className="btn-primary flex-1">{editing ? 'Update' : 'Create'}</Button>
                    </div>
                </form>
            </Modal>
 
            {/* Convert Modal */}
            <Modal isOpen={convertModalOpen} onClose={() => setConvertModalOpen(false)} title="Convert Lead to Customer">
                <form onSubmit={handleConvert} className="space-y-4">
                    <p className="text-sm text-surface-500">Converting <strong>{convertingLead?.name}</strong> to a customer.</p>
 
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-surface-200 pb-4 mb-4">
                        <div>
                            <label className="label">Policy Origin *</label>
                            <SearchableSelect
                                options={[
                                    { value: 'new_vehicle', label: 'New Vehicle (First-time insurance)' },
                                    { value: 'fresh', label: 'Fresh (No prior policy / Port-in)' },
                                    { value: 'external_renewal', label: 'External Renewal (From another insurer)' },
                                    { value: 'in_system_renewal', label: 'Own Renewal (Manual re-entry)' },
                                ]}
                                value={convertForm.policyOrigin}
                                onChange={(val) => setConvertForm({
                                    ...convertForm,
                                    policyOrigin: val,
                                    // Clear NCB if switching to non-NCB origins
                                    ...(['new_vehicle', 'fresh'].includes(val) ? { ncbPercentage: '' } : {}),
                                })}
                                placeholder="Select Origin"
                            />
                            {convertForm.policyOrigin === 'new_vehicle' && (
                                <p className="text-xs text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                    ℹ️ New vehicles have no NCB history — NCB is automatically set to 0%.
                                </p>
                            )}
                        </div>
                        {convertingLead?.policyType === 'motor' && (convertForm.policyOrigin === 'external_renewal' || convertForm.policyOrigin === 'in_system_renewal') && (
                            <div>
                                <label className="label">
                                    {convertForm.policyOrigin === 'external_renewal' ? 'Prior NCB (from previous insurer) %' : 'NCB Applied %'}
                                </label>
                                <SearchableSelect
                                    options={[
                                        { value: '0', label: 'None (0%)' },
                                        { value: '20', label: '20%' },
                                        { value: '25', label: '25%' },
                                        { value: '35', label: '35%' },
                                        { value: '45', label: '45%' },
                                        { value: '50', label: '50%' },
                                    ]}
                                    value={convertForm.ncbPercentage}
                                    onChange={(val) => setConvertForm({ ...convertForm, ncbPercentage: val })}
                                    allLabel="Leave blank / N/A"
                                />
                            </div>
                        )}
                    </div>

                    {/* Solution B: Dynamically request missing mandatory policy details inline */}
                    {convertingLead && (
                        (!convertingLead.policyType ||
                         !convertingLead.companyId ||
                         !convertingLead.policyNumber ||
                         (convertingLead.premiumAmount === null || convertingLead.premiumAmount === undefined) ||
                         !convertingLead.startDate ||
                         !convertingLead.expiryDate ||
                         ((convertingLead.policyType || convertForm.policyType) === 'motor' && (
                             !convertingLead.vehicleNumber ||
                             !convertingLead.make ||
                             !convertingLead.model
                         )))
                    ) && (
                        <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-4 my-2">
                            <h4 className="text-xs font-bold text-surface-700 uppercase tracking-wider">Missing Policy Details</h4>
                            <p className="text-xs text-surface-500">Please provide the missing mandatory details below to auto-generate the policy record upon conversion:</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {!convertingLead?.policyType && (
                                    <div>
                                        <label className="label">Policy Type *</label>
                                        <SearchableSelect
                                            options={[
                                                { value: 'motor', label: 'Motor' },
                                                { value: 'health', label: 'Health' },
                                                { value: 'life', label: 'Life' },
                                                { value: 'non_motor', label: 'Non Motor' },
                                                { value: 'other', label: 'Other' }
                                            ]}
                                            value={convertForm.policyType}
                                            onChange={(val) => {
                                                setConvertForm(prev => ({
                                                    ...prev,
                                                    policyType: val,
                                                    companyId: '', // Reset insurer to re-filter
                                                }));
                                                setErrors(prev => ({ ...prev, policyType: '' }));
                                            }}
                                            placeholder="Select Type"
                                            hasError={!!errors.policyType}
                                        />
                                        {errors.policyType && <p className="text-xs text-red-500 mt-1">{errors.policyType}</p>}
                                    </div>
                                )}

                                {!convertingLead?.companyId && (
                                    <div>
                                        <label className="label">Insurer (Company) *</label>
                                        <SearchableSelect
                                            options={companies
                                                .filter(c => {
                                                    const currentType = convertingLead?.policyType || convertForm.policyType;
                                                    if (currentType === 'life') return c.name === 'LIC';
                                                    if (currentType === 'health') return ['Star Health Insurance', 'New India Assurance', 'Care Insurance'].includes(c.name);
                                                    if (currentType === 'motor') return !['Star Health Insurance', 'Care Insurance', 'LIC'].includes(c.name);
                                                    return true;
                                                })
                                                .map(c => ({ value: c.id, label: c.name }))
                                            }
                                            value={convertForm.companyId}
                                            onChange={(val) => {
                                                setConvertForm(prev => ({ ...prev, companyId: val }));
                                                setErrors(prev => ({ ...prev, companyId: '' }));
                                            }}
                                            placeholder="Select Insurer"
                                            hasError={!!errors.companyId}
                                        />
                                        {errors.companyId && <p className="text-xs text-red-500 mt-1">{errors.companyId}</p>}
                                    </div>
                                )}

                                {!convertingLead?.policyNumber && (
                                    <div>
                                        <label className="label">Policy Number *</label>
                                        <input
                                            className={`input ${errors.policyNumber ? 'border-red-500 focus:ring-red-400' : ''}`}
                                            placeholder="Enter Policy Number"
                                            value={convertForm.policyNumber}
                                            onChange={(e) => {
                                                setConvertForm(prev => ({ ...prev, policyNumber: e.target.value }));
                                                setErrors(prev => ({ ...prev, policyNumber: '' }));
                                            }}
                                        />
                                        {errors.policyNumber && <p className="text-xs text-red-500 mt-1">{errors.policyNumber}</p>}
                                    </div>
                                )}

                                {(convertingLead?.premiumAmount === null || convertingLead?.premiumAmount === undefined) && (
                                    <div>
                                        <label className="label">Net Premium Amount *</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className={`input ${errors.premiumAmount ? 'border-red-500 focus:ring-red-400' : ''}`}
                                            placeholder="e.g. 15000"
                                            value={convertForm.premiumAmount}
                                            onChange={(e) => {
                                                setConvertForm(prev => ({ ...prev, premiumAmount: e.target.value }));
                                                setErrors(prev => ({ ...prev, premiumAmount: '' }));
                                            }}
                                        />
                                        {errors.premiumAmount && <p className="text-xs text-red-500 mt-1">{errors.premiumAmount}</p>}
                                    </div>
                                )}

                                {(() => {
                                    const finalClass = convertingLead?.vehicleClass || convertForm.vehicleClass;
                                    const isSaod = finalClass === 'SAOD_TW' || finalClass === 'SAOD_PVT';
                                    return (
                                        <>
                                            {!convertingLead?.startDate && (
                                                <div>
                                                    <label className="label">{isSaod ? 'OD Start Date *' : 'Start Date *'}</label>
                                                    <input
                                                        type="date"
                                                        className={`input ${errors.startDate ? 'border-red-500 focus:ring-red-400' : ''}`}
                                                        value={convertForm.startDate}
                                                        onChange={(e) => {
                                                            setConvertForm(prev => ({ ...prev, startDate: e.target.value }));
                                                            setErrors(prev => ({ ...prev, startDate: '' }));
                                                        }}
                                                    />
                                                    {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
                                                </div>
                                            )}

                                            {!convertingLead?.expiryDate && (
                                                <div>
                                                    <label className="label">{isSaod ? 'OD End Date *' : 'Expiry Date *'}</label>
                                                    <input
                                                        type="date"
                                                        className={`input ${errors.expiryDate ? 'border-red-500 focus:ring-red-400' : ''}`}
                                                        value={convertForm.expiryDate}
                                                        onChange={(e) => {
                                                            setConvertForm(prev => ({ ...prev, expiryDate: e.target.value }));
                                                            setErrors(prev => ({ ...prev, expiryDate: '' }));
                                                        }}
                                                    />
                                                    {errors.expiryDate && <p className="text-xs text-red-500 mt-1">{errors.expiryDate}</p>}
                                                </div>
                                            )}

                                            {isSaod && !convertingLead?.tpStartDate && (
                                                <div>
                                                    <label className="label">TP Start Date</label>
                                                    <input
                                                        type="date"
                                                        className="input"
                                                        value={convertForm.tpStartDate}
                                                        onChange={(e) => {
                                                            setConvertForm(prev => ({ ...prev, tpStartDate: e.target.value }));
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            {isSaod && !convertingLead?.tpEndDate && (
                                                <div>
                                                    <label className="label">TP End Date</label>
                                                    <input
                                                        type="date"
                                                        className="input"
                                                        value={convertForm.tpEndDate}
                                                        onChange={(e) => {
                                                            setConvertForm(prev => ({ ...prev, tpEndDate: e.target.value }));
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

                                {((convertingLead?.policyType || convertForm.policyType) === 'motor') && (
                                    <>
                                        {!convertingLead?.vehicleNumber && (
                                            <div>
                                                <label className="label">Vehicle Number *</label>
                                                <input
                                                    className={`input uppercase ${errors.vehicleNumber ? 'border-red-500 focus:ring-red-400' : ''}`}
                                                    placeholder="e.g. TN01AB1234"
                                                    value={convertForm.vehicleNumber}
                                                    onChange={(e) => {
                                                        setConvertForm(prev => ({ ...prev, vehicleNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }));
                                                        setErrors(prev => ({ ...prev, vehicleNumber: '' }));
                                                    }}
                                                />
                                                {errors.vehicleNumber && <p className="text-xs text-red-500 mt-1">{errors.vehicleNumber}</p>}
                                            </div>
                                        )}
                                        {!convertingLead?.make && (
                                            <div>
                                                <label className="label">Make *</label>
                                                <input
                                                    className={`input ${errors.make ? 'border-red-500 focus:ring-red-400' : ''}`}
                                                    placeholder="e.g. Maruti"
                                                    value={convertForm.make}
                                                    onChange={(e) => {
                                                        setConvertForm(prev => ({ ...prev, make: e.target.value }));
                                                        setErrors(prev => ({ ...prev, make: '' }));
                                                    }}
                                                />
                                                {errors.make && <p className="text-xs text-red-500 mt-1">{errors.make}</p>}
                                            </div>
                                        )}
                                        {!convertingLead?.model && (
                                            <div>
                                                <label className="label">Model *</label>
                                                <input
                                                    className={`input ${errors.model ? 'border-red-500 focus:ring-red-400' : ''}`}
                                                    placeholder="e.g. Swift"
                                                    value={convertForm.model}
                                                    onChange={(e) => {
                                                        setConvertForm(prev => ({ ...prev, model: e.target.value }));
                                                        setErrors(prev => ({ ...prev, model: '' }));
                                                    }}
                                                />
                                                {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
 
                    <div><label className="label">Customer Email (Optional)</label><input type="email" className="input" value={convertForm.email} onChange={(e) => setConvertForm({ ...convertForm, email: e.target.value })} /></div>
                    <div><label className="label">Customer Address (Optional)</label><textarea className="input" rows={2} value={convertForm.address} onChange={(e) => setConvertForm({ ...convertForm, address: e.target.value })} /></div>
                    {convertDuplicateWarning && (
                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                            {convertDuplicateWarning}
                        </div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setConvertModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                        <Button type="submit" isLoading={isConverting} className="btn-primary flex-1" disabled={!!convertDuplicateWarning}>Convert</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Lead" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-surface-600">
                        Are you sure you want to delete the lead <strong>{leadToDelete?.name}</strong>? This action cannot be undone.
                    </p>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="btn-secondary flex-1" disabled={isDeleting}>
                            Cancel
                        </button>
                        <Button type="button" onClick={confirmDelete} isLoading={isDeleting} className="btn-danger flex-1">
                            Delete
                        </Button>
                    </div>
                </div>
            </Modal>

            <button onClick={openCreate} className="fab lg:hidden"><HiOutlinePlus className="w-6 h-6" /></button>
        </div>
    );
};

export default Leads;
