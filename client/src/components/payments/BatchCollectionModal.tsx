import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import SearchableSelect from '../ui/SearchableSelect';
import { formatCurrency, formatDate, formatVehicleClass } from '../../utils/format';
import toast from 'react-hot-toast';
import { 
    HiOutlineDocumentDownload, 
    HiOutlineLightningBolt, 
    HiOutlineRefresh, 
    HiOutlineCheckCircle, 
    HiOutlineExclamationCircle,
    HiOutlineInformationCircle
} from 'react-icons/hi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BatchCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface UnsettledItem {
    policyId: string;
    paymentId: string;
    policyNumber: string;
    vehicleNumber: string;
    vehicleClass?: string;
    policyType: string;
    productName?: string;
    customerName: string;
    customerPhone?: string;
    companyName: string;
    startDate: string;
    expiryDate: string;
    dueDate: string;
    fullPremium: number;
    paymentAmount: number;
    alreadyPaid: number;
    remainingBalance: number;
    status: string;
}

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI / GPay / PhonePe' },
    { value: 'bank_transfer', label: 'Bank Transfer / NEFT / IMPS' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'card', label: 'Debit / Credit Card' },
    { value: 'other', label: 'Other' },
];

export const BatchCollectionModal: React.FC<BatchCollectionModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [payerType, setPayerType] = useState<'dealer' | 'reference'>('dealer');
    const [payers, setPayers] = useState<{ dealers: any[]; references: any[] }>({ dealers: [], references: [] });
    const [selectedPayerId, setSelectedPayerId] = useState<string>('');
    const [selectedPayerName, setSelectedPayerName] = useState<string>('');

    const [items, setItems] = useState<UnsettledItem[]>([]);
    const [summary, setSummary] = useState<{ totalPolicies: number; totalPayments: number; totalUnpaid: number }>({
        totalPolicies: 0,
        totalPayments: 0,
        totalUnpaid: 0,
    });

    const [totalAmount, setTotalAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('upi');
    const [referenceNumber, setReferenceNumber] = useState<string>('');
    const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState<string>('');

    const [allocations, setAllocations] = useState<Record<string, number>>({});
    const [loadingPayers, setLoadingPayers] = useState(false);
    const [loadingItems, setLoadingItems] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch payers with unsettled policies
    const fetchPayers = useCallback(async () => {
        setLoadingPayers(true);
        try {
            const res = await api.get('/payments/unsettled-payers');
            setPayers(res.data.data || { dealers: [], references: [] });
        } catch {
            toast.error('Failed to load unsettled parties');
        } finally {
            setLoadingPayers(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchPayers();
            // Reset form state on open
            setSelectedPayerId('');
            setSelectedPayerName('');
            setItems([]);
            setSummary({ totalPolicies: 0, totalPayments: 0, totalUnpaid: 0 });
            setTotalAmount('');
            setAllocations({});
            setReferenceNumber('');
            setNotes('');
        }
    }, [isOpen, fetchPayers]);

    const payerPoliciesCache = React.useRef<Record<string, { items: UnsettledItem[]; summary: { totalPolicies: number; totalPayments: number; totalUnpaid: number } }>>({});

    // Fetch unsettled policies when a payer is selected
    const fetchUnsettledPolicies = useCallback(async (type: 'dealer' | 'reference', val: string, name: string, forceRefresh = false) => {
        if (!val) return;
        const cacheKey = `${type}-${val}`;

        if (!forceRefresh && payerPoliciesCache.current[cacheKey]) {
            const cached = payerPoliciesCache.current[cacheKey];
            setItems(cached.items);
            setSummary(cached.summary);
            setSelectedPayerName(name);
            setLoadingItems(false);
            return;
        }

        setLoadingItems(true);
        try {
            const res = await api.get('/payments/unsettled-by-payer', {
                params: { payerType: type, payerValue: val },
            });
            const fetchedItems: UnsettledItem[] = res.data.data?.items || [];
            const fetchedSummary = res.data.data?.summary || { totalPolicies: 0, totalPayments: 0, totalUnpaid: 0 };

            payerPoliciesCache.current[cacheKey] = {
                items: fetchedItems,
                summary: fetchedSummary,
            };

            setItems(fetchedItems);
            setSummary(fetchedSummary);
            setSelectedPayerName(name);

            // Clear allocations on payer change
            setAllocations({});
            setTotalAmount('');
        } catch {
            toast.error('Failed to load unsettled policies');
        } finally {
            setLoadingItems(false);
        }
    }, []);

    const handlePayerChange = (val: string) => {
        setSelectedPayerId(val);
        let foundName = '';
        let initialCount = 0;
        let initialUnpaid = 0;

        if (payerType === 'dealer') {
            const dealer = payers.dealers.find(d => d.id === val);
            if (dealer) {
                foundName = dealer.name;
                initialCount = dealer.unsettledCount;
                initialUnpaid = dealer.totalUnpaid;
            }
        } else {
            const ref = payers.references.find(r => r.name === val);
            if (ref) {
                foundName = ref.name;
                initialCount = ref.unsettledCount;
                initialUnpaid = ref.totalUnpaid;
            }
        }

        if (foundName) {
            // Instantly update name and summary stats without waiting for network roundtrip!
            setSelectedPayerName(foundName);
            setSummary({
                totalPolicies: initialCount,
                totalPayments: initialCount,
                totalUnpaid: initialUnpaid,
            });
            setAllocations({});
            setTotalAmount('');

            const cacheKey = `${payerType}-${val}`;
            if (payerPoliciesCache.current[cacheKey]) {
                const cached = payerPoliciesCache.current[cacheKey];
                setItems(cached.items);
                setSummary(cached.summary);
                setLoadingItems(false);
                return;
            }

            setItems([]);
            fetchUnsettledPolicies(payerType, val, foundName);
        } else {
            setSelectedPayerName('');
            setItems([]);
        }
    };

    // Auto-allocate via FIFO (Oldest first)
    const runFIFO = (amountNum: number, currentItems = items) => {
        let remaining = Math.max(0, amountNum);
        const newAlloc: Record<string, number> = {};

        for (const item of currentItems) {
            if (remaining <= 0) {
                newAlloc[item.paymentId] = 0;
            } else {
                const give = Math.min(remaining, item.remainingBalance);
                newAlloc[item.paymentId] = give;
                remaining -= give;
            }
        }

        setAllocations(newAlloc);
    };

    const handleTotalAmountChange = (val: string) => {
        setTotalAmount(val);
        const num = parseFloat(val) || 0;
        if (num > 0 && items.length > 0) {
            runFIFO(num);
        } else {
            setAllocations({});
        }
    };

    const handleAllocationChange = (paymentId: string, val: string) => {
        const num = parseFloat(val);
        setAllocations(prev => ({
            ...prev,
            [paymentId]: isNaN(num) ? 0 : num,
        }));
    };

    // Computations
    const enteredTotal = parseFloat(totalAmount) || 0;
    const allocatedTotal = Object.values(allocations).reduce((sum, v) => sum + (v || 0), 0);
    const unallocatedDiff = Math.round((enteredTotal - allocatedTotal) * 100) / 100;
    const isMatching = Math.abs(unallocatedDiff) < 0.01 && enteredTotal > 0;

    // PDF Receipt Generator
    const generateReceiptPDF = (batchData: any, receiptAllocations: any[]) => {
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;

            // Header Banner
            doc.setFillColor(30, 58, 138); // Dark Navy Blue
            doc.rect(0, 0, pageWidth, 28, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('BATCH PAYMENT RECEIPT', 14, 15);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`Receipt No: ${batchData.receiptNo}`, 14, 22);
            doc.text(`Date: ${formatDate(batchData.paymentDate)}`, pageWidth - 14, 22, { align: 'right' });

            // Payer & Payment Details Cards
            doc.setTextColor(31, 41, 55);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Payer Information:', 14, 38);
            doc.text('Payment Summary:', pageWidth / 2 + 10, 38);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(`Name: ${batchData.payerName} (${batchData.payerType === 'dealer' ? 'Dealer' : 'Reference'})`, 14, 45);
            doc.text(`Payment Mode: ${(batchData.paymentMethod || 'Cash').toUpperCase()}`, 14, 51);
            if (batchData.referenceNumber) {
                doc.text(`Ref / UTR: ${batchData.referenceNumber}`, 14, 57);
            }

            doc.setFont('helvetica', 'bold');
            doc.text(`Total Received: Rs. ${batchData.totalAmount.toLocaleString('en-IN')}`, pageWidth / 2 + 10, 45);
            doc.setFont('helvetica', 'normal');
            doc.text(`Policies Settled: ${receiptAllocations.length}`, pageWidth / 2 + 10, 51);
            if (batchData.notes) {
                doc.text(`Notes: ${batchData.notes}`, pageWidth / 2 + 10, 57);
            }

            // Divider
            doc.setDrawColor(229, 231, 235);
            doc.line(14, 63, pageWidth - 14, 63);

            // Table of allocated policies
            autoTable(doc, {
                startY: 68,
                margin: { left: 14, right: 14 },
                head: [['#', 'Customer', 'Policy / Vehicle', 'Company', 'Due Date', 'Previous Due', 'Paid Now', 'Balance Due']],
                body: receiptAllocations.map((item, idx) => {
                    const allocAmt = allocations[item.paymentId] || 0;
                    const remainingAfter = Math.max(0, item.remainingBalance - allocAmt);
                    return [
                        idx + 1,
                        item.customerName,
                        `${item.policyNumber} ${item.vehicleNumber ? `(${item.vehicleNumber})` : ''}`,
                        item.companyName,
                        formatDate(item.dueDate),
                        `Rs. ${item.remainingBalance.toLocaleString('en-IN')}`,
                        `Rs. ${allocAmt.toLocaleString('en-IN')}`,
                        remainingAfter === 0 ? 'CLEARED' : `Rs. ${remainingAfter.toLocaleString('en-IN')}`
                    ];
                }),
                foot: [[
                    { content: 'Total Received & Allocated:', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } },
                    { content: `Rs. ${batchData.totalAmount.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold', textColor: [16, 185, 129] } },
                    { content: '' }
                ]],
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                styles: { fontSize: 8, cellPadding: 2.5 },
            });

            const finalY = (doc as any).lastAutoTable?.finalY || 180;
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text('This is a computer generated receipt. Thank you for your business.', 14, finalY + 15);

            doc.save(`Receipt_${batchData.receiptNo}_${batchData.payerName.replace(/\s+/g, '_')}.pdf`);
        } catch {
            toast.error('Receipt saved, but could not download PDF automatically.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPayerName) {
            toast.error('Please select a Dealer or Reference Person');
            return;
        }
        if (enteredTotal <= 0) {
            toast.error('Please enter a valid received amount');
            return;
        }
        if (!isMatching) {
            if (unallocatedDiff > 0) {
                toast.error(`You have Rs. ${unallocatedDiff.toLocaleString('en-IN')} remaining to allocate.`);
            } else {
                toast.error(`You have over-allocated by Rs. ${Math.abs(unallocatedDiff).toLocaleString('en-IN')}.`);
            }
            return;
        }

        const validAllocations = items
            .filter(item => (allocations[item.paymentId] || 0) > 0)
            .map(item => ({
                policyId: item.policyId,
                paymentId: item.paymentId,
                amount: allocations[item.paymentId],
            }));

        if (validAllocations.length === 0) {
            toast.error('Please allocate an amount to at least one policy');
            return;
        }

        // Validate individual caps
        for (const alloc of validAllocations) {
            const item = items.find(i => i.paymentId === alloc.paymentId);
            if (item && alloc.amount > item.remainingBalance + 0.01) {
                toast.error(`Allocation for ${item.customerName} cannot exceed ${formatCurrency(item.remainingBalance)}`);
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const payload = {
                payerType,
                payerId: payerType === 'dealer' ? selectedPayerId : null,
                payerName: selectedPayerName,
                totalAmount: enteredTotal,
                paymentDate: new Date(paymentDate).toISOString(),
                paymentMethod,
                referenceNumber: referenceNumber || undefined,
                notes: notes || undefined,
                allocations: validAllocations,
            };

            const res = await api.post('/payments/batch-collect', payload);
            const batch = res.data.data?.batch;

            toast.success(res.data.message || 'Batch collection saved!');

            // Auto-trigger PDF receipt download
            const allocatedItems = items.filter(item => (allocations[item.paymentId] || 0) > 0);
            if (batch) {
                generateReceiptPDF(batch, allocatedItems);
            }

            // Clear in-memory cache so future opens fetch freshly updated payment balances
            payerPoliciesCache.current = {};

            onSuccess();
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to record batch collection');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Lump-Sum Batch Collection" size="3xl">
            <form onSubmit={handleSubmit} className="space-y-5 min-h-[360px]">
                {/* Step 1: Payer Selection */}
                <div className="bg-surface-50 p-4 rounded-xl border border-surface-200/80 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="text-xs font-bold text-surface-600 uppercase tracking-wider">
                            Step 1: Select Mediator / Source
                        </label>
                        <div className="flex rounded-lg border border-surface-200 bg-white p-0.5 text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => {
                                    setPayerType('dealer');
                                    setSelectedPayerId('');
                                    setSelectedPayerName('');
                                    setItems([]);
                                }}
                                className={`px-3 py-1 rounded-md transition-all ${
                                    payerType === 'dealer'
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'text-surface-600 hover:text-surface-900'
                                }`}
                            >
                                Registered Dealers ({payers.dealers.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPayerType('reference');
                                    setSelectedPayerId('');
                                    setSelectedPayerName('');
                                    setItems([]);
                                }}
                                className={`px-3 py-1 rounded-md transition-all ${
                                    payerType === 'reference'
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'text-surface-600 hover:text-surface-900'
                                }`}
                            >
                                Reference Persons ({payers.references.length})
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="flex-1 w-full">
                            <SearchableSelect
                                dropUp={false}
                                options={
                                    payerType === 'dealer'
                                        ? payers.dealers.map(d => ({
                                              value: d.id,
                                              label: d.unsettledCount > 0
                                                  ? `${d.name} (${d.unsettledCount} policies — Due: Rs. ${d.totalUnpaid.toLocaleString('en-IN')})`
                                                  : `${d.name} (All Paid — Rs. 0 Due)`,
                                          }))
                                        : payers.references.map(r => ({
                                              value: r.name,
                                              label: r.unsettledCount > 0
                                                  ? `${r.name} (${r.unsettledCount} policies — Due: Rs. ${r.totalUnpaid.toLocaleString('en-IN')})`
                                                  : `${r.name} (All Paid — Rs. 0 Due)`,
                                          }))
                                }
                                value={selectedPayerId}
                                onChange={handlePayerChange}
                                placeholder={
                                    loadingPayers
                                        ? 'Loading parties...'
                                        : payerType === 'dealer'
                                        ? `Search across all ${payers.dealers.length} dealers...`
                                        : `Search across ${payers.references.length} reference persons...`
                                }
                            />
                        </div>

                        {selectedPayerName && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (selectedPayerId) {
                                        fetchUnsettledPolicies(payerType, selectedPayerId, selectedPayerName, true);
                                    }
                                }}
                                className="btn-ghost btn-sm flex items-center gap-1 text-surface-500 hover:text-surface-800"
                                title="Refresh policies from server"
                            >
                                <HiOutlineRefresh className={`w-4 h-4 ${loadingItems ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                        )}
                    </div>

                    {/* Summary Bar */}
                    {selectedPayerName && (
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-surface-200/60 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-surface-700">Selected Party:</span>
                                <span className="font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-100">
                                    {selectedPayerName}
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span>
                                    Unsettled Policies: <strong>{summary.totalPolicies}</strong>
                                </span>
                                <span>
                                    Total Outstanding: <strong className="text-red-600 text-sm font-black">{formatCurrency(summary.totalUnpaid)}</strong>
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Instant Loading Skeleton when fetching policies */}
                {loadingItems && (
                    <div className="bg-white p-5 rounded-xl border border-surface-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs font-semibold text-surface-800">
                                    Loading unsettled policies for <strong className="text-primary-700">{selectedPayerName}</strong>...
                                </span>
                            </div>
                            <span className="text-[11px] text-surface-400 animate-pulse">Syncing installment records...</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 animate-pulse">
                            <div className="h-10 bg-surface-100 rounded-lg" />
                            <div className="h-10 bg-surface-100 rounded-lg" />
                            <div className="h-10 bg-surface-100 rounded-lg" />
                            <div className="h-10 bg-surface-100 rounded-lg" />
                        </div>
                        <div className="space-y-2 pt-2 animate-pulse">
                            <div className="h-8 bg-surface-100 rounded-md w-full" />
                            <div className="h-10 bg-surface-50 rounded-md w-full" />
                            <div className="h-10 bg-surface-50 rounded-md w-full" />
                        </div>
                    </div>
                )}

                {/* Empty State when 0 unsettled policies */}
                {selectedPayerName && !loadingItems && items.length === 0 && (
                    <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-2">
                        <HiOutlineCheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                        <h4 className="font-bold text-emerald-900 text-sm">All Policies Fully Settled</h4>
                        <p className="text-xs text-emerald-700">
                            There are no pending or partial payments due for <strong>{selectedPayerName}</strong>. All policies under this party are 100% paid.
                        </p>
                    </div>
                )}

                {/* Step 2: Payment Receipt Details */}
                {selectedPayerName && !loadingItems && items.length > 0 && (
                    <div className="bg-white p-4 rounded-xl border border-surface-200 space-y-4">
                        <label className="text-xs font-bold text-surface-600 uppercase tracking-wider block">
                            Step 2: Enter Received Money
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                                <label className="label">Lump-Sum Received (Rs.) *</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 font-bold text-sm">Rs.</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max={summary.totalUnpaid}
                                        step="any"
                                        placeholder="e.g. 30000"
                                        className="input pl-10 text-base font-bold text-surface-900 border-primary-300 focus:border-primary-500"
                                        value={totalAmount}
                                        onChange={e => handleTotalAmountChange(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Payment Mode</label>
                                <select
                                    className="input text-xs"
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value)}
                                >
                                    {PAYMENT_METHODS.map(m => (
                                        <option key={m.value} value={m.value}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Payment Date</label>
                                <input
                                    type="date"
                                    className="input text-xs"
                                    value={paymentDate}
                                    onChange={e => setPaymentDate(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="label">UTR / Cheque / Ref No.</label>
                                <input
                                    type="text"
                                    placeholder="Optional Ref No"
                                    className="input text-xs"
                                    value={referenceNumber}
                                    onChange={e => setReferenceNumber(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <input
                                type="text"
                                placeholder="Additional notes or memo for this batch..."
                                className="input text-xs"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Step 3: Allocation Table (FIFO Default + Editable Inputs) */}
                {selectedPayerName && !loadingItems && items.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-surface-700 uppercase tracking-wider">
                                    Step 3: Policy Allocation
                                </label>
                                <span className="text-[11px] text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full">
                                    Oldest First (FIFO) by default
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => runFIFO(enteredTotal)}
                                    className="btn-ghost btn-sm flex items-center gap-1 text-primary-600 hover:bg-primary-50 text-xs"
                                >
                                    <HiOutlineLightningBolt className="w-3.5 h-3.5" /> Re-apply FIFO
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAllocations({})}
                                    className="btn-ghost btn-sm text-surface-400 hover:text-surface-700 text-xs"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        <div className="border border-surface-200 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                            <table className="table w-full text-xs">
                                <thead className="sticky top-0 bg-surface-50 shadow-sm z-10">
                                    <tr>
                                        <th>Policy / Vehicle</th>
                                        <th>Customer</th>
                                        <th>Due Date</th>
                                        <th className="text-right">Total Prem.</th>
                                        <th className="text-right">Balance Due</th>
                                        <th className="text-right w-36">Allocated (Rs.)</th>
                                        <th className="text-right">Remaining</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-100">
                                    {items.map(item => {
                                        const alloc = allocations[item.paymentId] || 0;
                                        const remainingAfter = Math.max(0, item.remainingBalance - alloc);
                                        const isFullyCleared = alloc >= item.remainingBalance - 0.01 && alloc > 0;
                                        const isPartial = alloc > 0 && !isFullyCleared;

                                        return (
                                            <tr
                                                key={item.paymentId}
                                                className={
                                                    isFullyCleared
                                                        ? 'bg-emerald-50/40'
                                                        : isPartial
                                                        ? 'bg-blue-50/30'
                                                        : 'hover:bg-surface-50/60'
                                                }
                                            >
                                                <td>
                                                    <div className="font-semibold text-surface-900">{item.policyNumber}</div>
                                                    <div className="text-[11px] text-surface-500 flex items-center gap-1">
                                                        <span>{item.vehicleNumber}</span>
                                                        {item.vehicleClass && (
                                                            <span className="text-[9px] px-1 py-0.2 bg-surface-100 rounded text-surface-600 font-bold uppercase">
                                                                {formatVehicleClass(item.vehicleClass)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="font-medium text-surface-800">{item.customerName}</div>
                                                    <div className="text-[10px] text-surface-400">{item.customerPhone || '—'}</div>
                                                </td>
                                                <td className="text-surface-600">{formatDate(item.dueDate)}</td>
                                                <td className="text-right text-surface-600">{formatCurrency(item.fullPremium)}</td>
                                                <td className="text-right font-bold text-red-600">
                                                    {formatCurrency(item.remainingBalance)}
                                                </td>
                                                <td className="text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={item.remainingBalance}
                                                        step="any"
                                                        className={`input input-sm text-right font-bold ${
                                                            isFullyCleared
                                                                ? 'border-emerald-400 text-emerald-700 bg-emerald-50/50'
                                                                : isPartial
                                                                ? 'border-blue-400 text-blue-700 bg-blue-50/50'
                                                                : ''
                                                        }`}
                                                        value={alloc || ''}
                                                        placeholder="0"
                                                        onChange={e => handleAllocationChange(item.paymentId, e.target.value)}
                                                    />
                                                </td>
                                                <td className="text-right font-semibold">
                                                    {isFullyCleared ? (
                                                        <span className="text-emerald-600 text-[11px] font-bold inline-flex items-center gap-0.5">
                                                            <HiOutlineCheckCircle className="w-3.5 h-3.5" /> CLEARED
                                                        </span>
                                                    ) : (
                                                        <span className={remainingAfter > 0 ? 'text-surface-700' : 'text-surface-400'}>
                                                            {formatCurrency(remainingAfter)}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Live Allocation Validation Bar */}
                        <div
                            className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                                isMatching
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : unallocatedDiff > 0
                                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                                    : 'bg-red-50 border-red-200 text-red-800'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                {isMatching ? (
                                    <HiOutlineCheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                                ) : (
                                    <HiOutlineExclamationCircle className="w-5 h-5 shrink-0" />
                                )}
                                <div>
                                    <span className="font-bold">
                                        {isMatching
                                            ? 'Exact Match! Ready to save.'
                                            : unallocatedDiff > 0
                                            ? `Rs. ${unallocatedDiff.toLocaleString('en-IN')} remaining to allocate.`
                                            : `Over-allocated by Rs. ${Math.abs(unallocatedDiff).toLocaleString('en-IN')}!`
                                        }
                                    </span>
                                    <div className="text-[11px] opacity-80">
                                        Received: {formatCurrency(enteredTotal)} | Allocated: {formatCurrency(allocatedTotal)}
                                    </div>
                                </div>
                            </div>

                            {!isMatching && enteredTotal > 0 && (
                                <button
                                    type="button"
                                    onClick={() => runFIFO(enteredTotal)}
                                    className="btn-sm bg-white/80 border border-current text-xs font-semibold px-2.5 py-1 rounded-lg"
                                >
                                    Auto-Balance with FIFO
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-surface-200">
                    <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
                        Cancel
                    </button>

                    <div className="flex items-center gap-2">
                        <Button
                            type="submit"
                            className="btn-primary flex items-center gap-1.5"
                            isLoading={isSubmitting}
                            disabled={!isMatching || isSubmitting || items.length === 0}
                        >
                            <HiOutlineDocumentDownload className="w-4 h-4" /> Save & Generate Receipt
                        </Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default BatchCollectionModal;
