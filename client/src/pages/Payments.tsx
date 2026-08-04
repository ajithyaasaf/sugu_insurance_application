import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import TableSkeleton from '../components/ui/TableSkeleton';
import SearchableSelect from '../components/ui/SearchableSelect';
import { formatDate, formatCurrency, getStatusColor, scrollToFirstError, formatVehicleClass } from '../utils/format';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineSearch, HiOutlinePencil, HiOutlineCreditCard, HiOutlineDocumentDownload } from 'react-icons/hi';
import { PAYMENT_STATUSES as statusOptions, VEHICLE_CLASSES } from '../utils/constants';
import Button from '../components/ui/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';




const Payments: React.FC = () => {
    const { user } = useAuth();
    const isStaff = user?.role === 'staff';
    const [payments, setPayments] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [policies, setPolicies] = useState<any[]>([]);
    const [dealers, setDealers] = useState<any[]>([]);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dealerFilter, setDealerFilter] = useState('');
    const [vehicleClassFilter, setVehicleClassFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [form, setForm] = useState({
        customerId: '', policyId: '', amount: '', dueDate: '', paidDate: '', paidAmount: '', status: 'pending', notes: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);

    const fetchPayments = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const res = await api.get('/payments', {
                params: {
                    page,
                    limit: 10,
                    status: statusFilter || undefined,
                    search: search || undefined,
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                    dealerId: dealerFilter || undefined,
                    vehicleClass: vehicleClassFilter || undefined,
                },
            });
            setPayments(res.data.data);
            setMeta(res.data.meta);
        } catch { toast.error('Failed to fetch payments'); } finally { setLoading(false); }
    }, [search, statusFilter, dateFrom, dateTo, dealerFilter, vehicleClassFilter]);

    useEffect(() => { fetchPayments(); }, [fetchPayments]);

    useEffect(() => {
        const loadDropdowns = async () => {
            try {
                const [custRes, polRes, dlrRes] = await Promise.all([
                    api.get('/customers?limit=10000'),
                    api.get('/policies?limit=10000'),
                    api.get('/dealers?limit=10000')
                ]);
                setCustomers(custRes.data.data);
                setPolicies(polRes.data.data);
                setDealers(dlrRes.data.data || []);
            } catch { }
        };
        loadDropdowns();
    }, []);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.customerId) errs.customerId = 'Please select a customer';
        if (!form.policyId) errs.policyId = 'Please select a policy';
        if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = 'Valid amount is required';
        if (!form.dueDate) errs.dueDate = 'Due date is required';
        if (!form.status) errs.status = 'Please select a status';
        return errs;
    };

    const openCreate = () => {
        setEditing(null);
        setForm({ customerId: '', policyId: '', amount: '', dueDate: '', paidDate: '', paidAmount: '', status: 'pending', notes: '' });
        setErrors({});
        setModalOpen(true);
    };

    const openEdit = (p: any) => {
        setEditing(p);
        setForm({
            customerId: p.customerId, policyId: p.policyId, amount: p.amount.toString(), dueDate: p.dueDate.split('T')[0],
            paidDate: p.paidDate?.split('T')[0] || '', paidAmount: p.paidAmount?.toString() || '', status: p.status, notes: p.notes || '',
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
        setIsSubmitting(true);
        try {
            const payload = {
                ...form, amount: parseFloat(form.amount), paidAmount: form.paidAmount ? parseFloat(form.paidAmount) : undefined,
                paidDate: form.paidDate || undefined, notes: form.notes || undefined,
            };
            if (editing) {
                const res = await api.put(`/payments/${editing.id}`, payload);
                toast.success(res.data.message || 'Payment updated');
            }
            else {
                const res = await api.post('/payments', payload);
                toast.success(res.data.message || 'Payment created');
            }
            setModalOpen(false); fetchPayments(meta.page);
        } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); } finally { setIsSubmitting(false); }
    };

    const handleDetectOverdue = async () => {
        setIsDetecting(true);
        try {
            const res = await api.post('/payments/detect-overdue');
            toast.success(res.data.message);
            fetchPayments(meta.page);
        } catch { toast.error('Failed'); } finally { setIsDetecting(false); }
    };

    const exportPDF = async () => {
        if (payments.length === 0) {
            toast.error('No payments to export');
            return;
        }

        toast.loading('Generating PDF...', { id: 'export-pdf' });
        try {
            const res = await api.get('/payments', {
                params: {
                    limit: 10000,
                    status: statusFilter || undefined,
                    search: search || undefined,
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                    dealerId: dealerFilter || undefined,
                    vehicleClass: vehicleClassFilter || undefined,
                },
            });
            const dataToPrint = res.data.data || [];

            const doc = new jsPDF();

            // Branding Header
            doc.setFontSize(22);
            doc.setTextColor(30, 58, 138); // Royal Blue
            doc.text('ROYAL INSURANCE', 14, 22);

            doc.setFontSize(10);
            doc.setTextColor(107, 114, 128); // Gray
            doc.text('Proprietor: Senthil Kumar', 14, 28);
            doc.text('Madurai, Tamil Nadu', 14, 33);

            // Divider Line
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.5);
            doc.line(14, 38, doc.internal.pageSize.width - 14, 38);

            // Report Info
            doc.setTextColor(17, 24, 39); // Almost Black
            doc.setFontSize(14);
            doc.text('Payment Report', 14, 48);

            doc.setFontSize(10);
            let filterText = `Filter: ${statusFilter ? statusFilter.toUpperCase() : 'ALL STATUS'}`;
            if (dealerFilter) {
                const selectedDealer = dealers.find(d => d.id === dealerFilter);
                filterText += ` | Dealer: ${dealerFilter === 'direct' ? 'Direct' : (selectedDealer?.name || 'Selected')}`;
            }
            if (vehicleClassFilter) {
                filterText += ` | Class: ${formatVehicleClass(vehicleClassFilter)}`;
            }
            if (dateFrom || dateTo) {
                filterText += ` | Period: ${dateFrom ? formatDate(dateFrom) : 'Start'} to ${dateTo ? formatDate(dateTo) : 'End'}`;
            }
            doc.text(filterText, 14, 56);

            const rightX = doc.internal.pageSize.width - 14;
            doc.text(`Generated On: ${new Date().toLocaleDateString('en-IN')}`, rightX, 56, { align: 'right' });

            const totalAmount = dataToPrint.reduce((sum: number, p: any) => sum + p.amount, 0);
            const totalPaid = dataToPrint.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0);
            const totalOutstanding = totalAmount - totalPaid;

            // Table with optimized columns to fit exactly in A4 width (182mm print area with 14mm margins)
            autoTable(doc, {
                startY: 65,
                margin: { left: 14, right: 14 },
                head: [['S.No.', 'Customer', 'Policy Details', 'Due Date', 'Amount', 'Paid', 'Outstanding', 'Status']],
                body: dataToPrint.map((p: any, i: number) => {
                    const outstanding = p.amount - (p.paidAmount || 0);
                    return [
                        i + 1,
                        p.customer?.name || '-',
                        `${p.policy?.productName || p.policy?.policyType || '—'}${p.policy?.vehicleNumber ? ` (${p.policy.vehicleNumber})` : ''}`,
                        formatDate(p.dueDate),
                        p.amount.toLocaleString('en-IN'),
                        p.paidAmount ? p.paidAmount.toLocaleString('en-IN') : '—',
                        outstanding.toLocaleString('en-IN'),
                        p.status.toUpperCase(),
                    ];
                }),
                foot: [[
                    { content: 'Total Outstanding:', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', textColor: [31, 41, 55], fillColor: [249, 250, 251] } },
                    { content: totalOutstanding.toLocaleString('en-IN'), styles: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38], fillColor: [249, 250, 251] } },
                    { content: '', styles: { fillColor: [249, 250, 251] } }
                ]],
                showFoot: 'lastPage',
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                    valign: 'middle',
                    overflow: 'linebreak',
                    lineWidth: 0.2,
                    lineColor: [209, 213, 219]
                },
                headStyles: {
                    fillColor: [30, 58, 138],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                },
                columnStyles: {
                    0: { cellWidth: 10, halign: 'center' },
                    1: { cellWidth: 35, halign: 'left' },
                    2: { cellWidth: 40, halign: 'left' },
                    3: { cellWidth: 20, halign: 'center' },
                    4: { cellWidth: 18, halign: 'right' },
                    5: { cellWidth: 18, halign: 'right' },
                    6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
                    7: { cellWidth: 19, halign: 'center' }
                }
            });

            doc.save(`payments_${statusFilter || 'report'}_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success('PDF Downloaded!', { id: 'export-pdf' });
        } catch (err) {
            toast.error('Failed to generate PDF', { id: 'export-pdf' });
        }
    };


    return (
        <div className="space-y-4 animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Payments</h1>
                <div className="flex gap-2">
                    {!isStaff && (
                        <Button onClick={exportPDF} className="btn-secondary flex items-center gap-1">
                            <HiOutlineDocumentDownload className="w-4 h-4" /> Export PDF
                        </Button>
                    )}
                    <Button onClick={handleDetectOverdue} isLoading={isDetecting} className="btn-secondary text-amber-600">Detect Overdue</Button>
                    <button onClick={openCreate} className="btn-primary"><HiOutlinePlus className="w-4 h-4" /> Add Payment</button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[160px]">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input className="input pl-10" placeholder="Search by customer, policy or vehicle..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <SearchableSelect
                    className="w-full sm:w-40"
                    options={[
                        ...statusOptions.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
                        { value: 'overdue', label: 'Overdue' }
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    allLabel="All Status"
                    placeholder="Search status..."
                />
                <SearchableSelect
                    className="w-full sm:w-48"
                    options={[
                        { value: 'direct', label: '⭐ Direct' },
                        ...dealers.map(d => ({ value: d.id, label: d.name }))
                    ]}
                    value={dealerFilter}
                    onChange={setDealerFilter}
                    allLabel="All Dealers"
                    placeholder="Search dealer..."
                />
                <SearchableSelect
                    className="w-full sm:w-48"
                    options={VEHICLE_CLASSES.map(t => ({ value: t, label: formatVehicleClass(t) }))}
                    value={vehicleClassFilter}
                    onChange={setVehicleClassFilter}
                    allLabel="All Classes"
                    placeholder="Vehicle Class"
                />
                <div className="flex items-center gap-2">
                    <label className="text-xs text-surface-500 whitespace-nowrap">Due From</label>
                    <input type="date" className="input sm:w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-xs text-surface-500 whitespace-nowrap">To</label>
                    <input type="date" className="input sm:w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                {(search || statusFilter || dealerFilter || dateFrom || dateTo || vehicleClassFilter) && (
                    <button onClick={() => { setSearch(''); setStatusFilter(''); setDealerFilter(''); setDateFrom(''); setDateTo(''); setVehicleClassFilter(''); }} className="btn-ghost btn-sm self-start sm:self-auto">
                        Clear
                    </button>
                )}
            </div>

            {loading ? (
                <TableSkeleton cols={6} rows={10} />
            ) : payments.length === 0 ? (
                <EmptyState message="No payments found" icon={<HiOutlineCreditCard className="w-12 h-12" />} />
            ) : (
                <>
                    <div className="table-container hidden sm:block">
                        <table className="table">
                            <thead><tr><th>Customer</th><th>Policy</th><th>Amount</th><th>Due Date</th><th>Paid</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {payments.map((p) => {
                                    const outstanding = p.amount - (p.paidAmount || 0);
                                    return (
                                        <tr key={p.id}>
                                            <td className="font-medium text-surface-900">{p.customer?.name}</td>
                                            <td className="text-xs">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {p.policy?.productName || p.policy?.policyType || '—'} {p.policy?.vehicleNumber && `(${p.policy.vehicleNumber})`}
                                                    {p.policy?.vehicleClass && (
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-100 text-surface-700 border border-surface-200 uppercase">
                                                            {formatVehicleClass(p.policy.vehicleClass)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="font-medium">{formatCurrency(p.amount)}</td>
                                            <td className="text-xs">{formatDate(p.dueDate)}</td>
                                            <td className="text-xs">{p.paidAmount ? formatCurrency(p.paidAmount) : '—'}</td>
                                            <td className={`font-bold ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {formatCurrency(outstanding)}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <span className={getStatusColor(p.status)}>{p.status}</span>
                                                    {p.isOverdue && (
                                                        <span className="badge-danger">overdue</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td><button onClick={() => openEdit(p)} className="btn-ghost btn-sm"><HiOutlinePencil className="w-3.5 h-3.5" /></button></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-surface-50 font-bold">
                                <tr>
                                    <td colSpan={5} className="text-right py-3">Total Outstanding :</td>
                                    <td className="text-red-600 py-3">
                                        {formatCurrency(payments.reduce((sum, p) => sum + (p.amount - (p.paidAmount || 0)), 0))}
                                    </td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="sm:hidden space-y-3">
                        {payments.map((p) => {
                            const outstanding = p.amount - (p.paidAmount || 0);
                            return (
                                <div key={p.id} className="card card-body" onClick={() => openEdit(p)}>
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-semibold text-surface-900">{p.customer?.name}</p>
                                        <div className="flex items-center gap-2">
                                            <span className={getStatusColor(p.status)}>{p.status}</span>
                                            {p.isOverdue && (
                                                <span className="badge-danger">overdue</span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-surface-500 mb-2">Due: {formatDate(p.dueDate)}</p>
                                    <div className="flex justify-between text-sm">
                                        <span>Amount: <strong>{formatCurrency(p.amount)}</strong></span>
                                        {p.paidAmount && <span className="text-emerald-600">Paid: {formatCurrency(p.paidAmount)}</span>}
                                    </div>
                                    {outstanding > 0 && (
                                        <div className="mt-2 pt-2 border-t border-dashed border-surface-200 flex justify-between items-center text-sm">
                                            <span className="text-surface-500">Outstanding:</span>
                                            <span className="font-bold text-red-600">{formatCurrency(outstanding)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div className="card card-body bg-red-50 border-red-100">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-red-800">Total Outstanding (Page)</span>
                                <span className="text-lg font-bold text-red-600">
                                    {formatCurrency(payments.reduce((sum, p) => sum + (p.amount - (p.paidAmount || 0)), 0))}
                                </span>
                            </div>
                        </div>
                    </div>
                    <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={(p) => fetchPayments(p)} />
                </>
            )}

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Update Payment' : 'New Payment'}>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    {!editing && (
                        <>
                            <div>
                                <label className="label">Customer *</label>
                                <SearchableSelect
                                    options={customers.map(c => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` }))}
                                    value={form.customerId}
                                    onChange={(val) => {
                                        const selectedPolicy = policies.find(p => p.id === form.policyId);
                                        const policyBelongsToNewCustomer = selectedPolicy && selectedPolicy.customerId === val;
                                        setForm({
                                            ...form,
                                            customerId: val,
                                            policyId: policyBelongsToNewCustomer ? form.policyId : ''
                                        });
                                        setErrors(prev => ({ ...prev, customerId: '', policyId: '' }));
                                    }}
                                    placeholder="Select Customer"
                                    hasError={!!errors.customerId}
                                />
                                {errors.customerId && <p className="text-xs text-red-500 mt-1">{errors.customerId}</p>}
                            </div>
                            <div>
                                <label className="label">Policy *</label>
                                <SearchableSelect
                                    options={policies.filter(p => !form.customerId || p.customerId === form.customerId).map(p => ({
                                        value: p.id,
                                        label: `${p.policyNumber ? p.policyNumber + ' - ' : ''}${p.vehicleNumber ? p.vehicleNumber + ' - ' : ''}${p.customer?.name || ''}${p.customer?.phone ? ` (${p.customer.phone})` : ''} (${p.productName || p.policyType})`
                                    }))}
                                    value={form.policyId}
                                    onChange={(val) => {
                                        const selectedPolicy = policies.find(p => p.id === val);
                                        const resolvedCustomerId = selectedPolicy?.customerId || selectedPolicy?.customer?.id || '';

                                        if (selectedPolicy?.customer) {
                                            const customerExists = customers.some(c => c.id === resolvedCustomerId);
                                            if (!customerExists) {
                                                setCustomers(prev => [...prev, selectedPolicy.customer]);
                                            }
                                        }

                                        setForm({
                                            ...form,
                                            policyId: val,
                                            customerId: resolvedCustomerId || form.customerId,
                                            amount: selectedPolicy ? (selectedPolicy.totalPremium || selectedPolicy.premiumAmount).toString() : form.amount,
                                            dueDate: selectedPolicy ? selectedPolicy.startDate.split('T')[0] : form.dueDate
                                        });
                                        setErrors(prev => ({ ...prev, policyId: '', customerId: '', amount: '', dueDate: '' }));
                                    }}
                                    placeholder="Search by Policy #, Vehicle # or Name"
                                    hasError={!!errors.policyId}
                                />
                                {errors.policyId && <p className="text-xs text-red-500 mt-1">{errors.policyId}</p>}
                            </div>
                        </>
                    )}
                    <div>
                        <label className="label">Payment Amount *</label>
                        <input
                            type="number" min="0" step="0.01"
                            className={`input ${errors.amount ? 'border-red-500 focus:ring-red-400' : ''}`}
                            data-error-field={errors.amount ? 'true' : undefined}
                            value={form.amount}
                            onChange={(e) => { setForm({ ...form, amount: e.target.value }); setErrors(prev => ({ ...prev, amount: '' })); }}
                            placeholder="Enter amount"
                        />
                        <p className="text-[10px] text-surface-400 mt-1 italic">Auto-filled from Total Premium when policy is selected.</p>
                        {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
                    </div>
                    <div>
                        <label className="label">Due Date *</label>
                        <input
                            type="date"
                            className={`input ${errors.dueDate ? 'border-red-500 focus:ring-red-400' : ''}`}
                            data-error-field={errors.dueDate ? 'true' : undefined}
                            value={form.dueDate}
                            onChange={(e) => { setForm({ ...form, dueDate: e.target.value }); setErrors(prev => ({ ...prev, dueDate: '' })); }}
                        />
                        {errors.dueDate && <p className="text-xs text-red-500 mt-1">{errors.dueDate}</p>}
                    </div>
                    <div><label className="label">Paid Date</label><input type="date" className="input" value={form.paidDate} onChange={(e) => setForm({ ...form, paidDate: e.target.value })} /></div>
                    <div><label className="label">Paid Amount</label><input type="number" min="0" step="0.01" className="input" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} placeholder="Partial or full" /></div>
                    <div>
                        <label className="label">Status *</label>
                        <SearchableSelect
                            options={statusOptions.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                            value={form.status}
                            onChange={(val) => { setForm({ ...form, status: val }); setErrors(prev => ({ ...prev, status: '' })); }}
                            placeholder="Select Status"
                            hasError={!!errors.status}
                        />
                        {errors.status && <p className="text-xs text-red-500 mt-1">{errors.status}</p>}
                    </div>
                    <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                        <Button type="submit" isLoading={isSubmitting} className="btn-primary flex-1">{editing ? 'Update' : 'Create'}</Button>
                    </div>
                </form>
            </Modal>

            <button onClick={openCreate} className="fab lg:hidden"><HiOutlinePlus className="w-6 h-6" /></button>
        </div>
    );
};

export default Payments;
