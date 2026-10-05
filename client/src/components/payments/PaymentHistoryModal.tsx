import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/format';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { 
    HiOutlineCreditCard, 
    HiOutlineCalendar, 
    HiOutlineOfficeBuilding, 
    HiOutlineUser, 
    HiOutlineCheckCircle, 
    HiOutlineClock,
    HiOutlineDocumentText,
    HiOutlineExternalLink,
    HiOutlineInformationCircle
} from 'react-icons/hi';
import BatchDetailModal from './BatchDetailModal';

export interface PaymentHistoryItem {
    type: 'manual' | 'batch';
    amount: number;
    receiptNo: string | null;
    date: string | Date;
    payerName: string;
    payerType: 'direct' | 'dealer' | 'reference' | string;
    paymentMethod?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
    batchId?: string | null;
}

export interface PaymentHistoryData {
    payment: {
        id: string;
        amount: number;
        paidAmount: number;
        status: string;
        dueDate: string;
        paidDate?: string;
        customer?: {
            name: string;
            phone?: string;
        };
        policy?: {
            id: string;
            policyNumber: string;
            vehicleNumber?: string;
            productName?: string;
            policyType?: string;
            dealer?: {
                name: string;
            };
        };
    };
    history: PaymentHistoryItem[];
    summary: {
        amount: number;
        paidAmount: number;
        balanceDue: number;
        installmentsCount: number;
    };
}

interface PaymentHistoryModalProps {
    paymentId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({ paymentId, isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<PaymentHistoryData | null>(null);
    const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
    const [fetchingBatch, setFetchingBatch] = useState(false);

    useEffect(() => {
        if (!isOpen || !paymentId) {
            setData(null);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/payments/${paymentId}/history`);
                setData(res.data);
            } catch (err: any) {
                toast.error(err?.response?.data?.message || 'Failed to load payment history');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [isOpen, paymentId]);

    const handleViewBatch = async (batchId: string) => {
        setFetchingBatch(true);
        try {
            const res = await api.get(`/payments/batches/${batchId}`);
            setSelectedBatch(res.data);
        } catch {
            toast.error('Failed to load batch receipt details');
        } finally {
            setFetchingBatch(false);
        }
    };

    if (!isOpen) return null;

    const percentPaid = data && data.summary.amount > 0 
        ? Math.min(100, Math.round((data.summary.paidAmount / data.summary.amount) * 100))
        : 0;

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Payment Breakdown & Installment History"
                size="lg"
            >
                {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-3">
                        <div className="w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-medium text-surface-500">Loading payment installments...</p>
                    </div>
                ) : !data ? (
                    <div className="py-8 text-center text-surface-500">
                        <HiOutlineInformationCircle className="w-10 h-10 mx-auto text-surface-400 mb-2" />
                        <p>No payment history details available.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Header Policy Summary Card */}
                        <div className="bg-gradient-to-br from-surface-900 via-surface-800 to-surface-950 text-white p-5 rounded-2xl shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-white/10">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white/20 text-white uppercase tracking-wider">
                                            {data.payment.policy?.productName || data.payment.policy?.policyType || 'Policy'}
                                        </span>
                                        {data.payment.policy?.vehicleNumber && (
                                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide">
                                                🚗 {data.payment.policy.vehicleNumber}
                                            </span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${getStatusColor(data.payment.status)} uppercase`}>
                                            {data.payment.status}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                        {data.payment.customer?.name}
                                        {data.payment.customer?.phone && (
                                            <span className="text-xs font-normal text-surface-300">
                                                ({data.payment.customer.phone})
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-surface-300 mt-0.5">
                                        Policy No: <span className="font-mono text-white">{data.payment.policy?.policyNumber || '—'}</span>
                                        {data.payment.policy?.dealer?.name && (
                                            <span className="ml-2 pl-2 border-l border-white/20">
                                                Dealer: <span className="text-amber-300 font-semibold">{data.payment.policy.dealer.name}</span>
                                            </span>
                                        )}
                                    </p>
                                </div>

                                <div className="text-left sm:text-right bg-white/5 p-3 rounded-xl border border-white/10 shrink-0">
                                    <span className="text-[10px] uppercase font-bold text-surface-300 block mb-0.5">
                                        Collection Progress
                                    </span>
                                    <span className="text-2xl font-black text-emerald-400">
                                        {percentPaid}%
                                    </span>
                                </div>
                            </div>

                            {/* Summary Metrics */}
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm border border-white/5">
                                    <span className="text-[10px] font-semibold uppercase text-surface-300 block">Total Due</span>
                                    <span className="text-base sm:text-lg font-bold text-white">
                                        {formatCurrency(data.summary.amount)}
                                    </span>
                                </div>
                                <div className="bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-500/30">
                                    <span className="text-[10px] font-semibold uppercase text-emerald-200 block">Total Collected</span>
                                    <span className="text-base sm:text-lg font-bold text-emerald-300">
                                        {formatCurrency(data.summary.paidAmount)}
                                    </span>
                                </div>
                                <div className={`p-2.5 rounded-xl border ${data.summary.balanceDue > 0 ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-white/10 border-white/5 text-surface-300'}`}>
                                    <span className="text-[10px] font-semibold uppercase block">Balance Left</span>
                                    <span className={`text-base sm:text-lg font-bold ${data.summary.balanceDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {formatCurrency(data.summary.balanceDue)}
                                    </span>
                                </div>
                            </div>

                            {/* Visual Progress Bar */}
                            <div className="mt-4 pt-3 border-t border-white/10">
                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-500 rounded-full ${data.summary.balanceDue === 0 ? 'bg-emerald-400' : 'bg-primary-400'}`}
                                        style={{ width: `${percentPaid}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Chronological Installments Timeline */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-surface-900 flex items-center gap-2">
                                    <HiOutlineClock className="w-4 h-4 text-primary-600" />
                                    Payment Installments & Settlements
                                </h4>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">
                                    {data.history.length} {data.history.length === 1 ? 'Record' : 'Records'}
                                </span>
                            </div>

                            {data.history.length === 0 ? (
                                <div className="p-8 text-center bg-surface-50 rounded-2xl border border-dashed border-surface-200">
                                    <p className="text-sm text-surface-500">No installments recorded yet for this policy.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {data.history.map((item, idx) => {
                                        const isBatch = item.type === 'batch';

                                        return (
                                            <div 
                                                key={idx}
                                                className="relative bg-white rounded-xl p-4 border border-surface-200 hover:border-surface-300 transition-shadow shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                            >
                                                <div className="flex items-start gap-3">
                                                    {/* Installment Badge Number / Icon */}
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                                                        isBatch 
                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    }`}>
                                                        #{idx + 1}
                                                    </div>

                                                    <div className="space-y-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="text-base font-black text-emerald-700">
                                                                +{formatCurrency(item.amount)}
                                                            </span>

                                                            {isBatch ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                                                                    <HiOutlineOfficeBuilding className="w-3.5 h-3.5" />
                                                                    Dealer Batch
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-surface-100 text-surface-700">
                                                                    <HiOutlineUser className="w-3.5 h-3.5" />
                                                                    Direct Collection
                                                                </span>
                                                            )}

                                                            {item.receiptNo && (
                                                                <span className="text-xs font-mono font-bold text-surface-600 bg-surface-100 px-2 py-0.5 rounded border border-surface-200">
                                                                    {item.receiptNo}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Source & Payment Details */}
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-600">
                                                            <span className="flex items-center gap-1">
                                                                <HiOutlineCalendar className="w-3.5 h-3.5 text-surface-400" />
                                                                {formatDate(item.date)}
                                                            </span>
                                                            <span>•</span>
                                                            <span>
                                                                Received from: <strong className="text-surface-900">{item.payerName}</strong>
                                                            </span>
                                                            {item.paymentMethod && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="uppercase font-semibold text-surface-700">
                                                                        {item.paymentMethod}
                                                                    </span>
                                                                </>
                                                            )}
                                                            {item.referenceNumber && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="font-mono text-surface-500">
                                                                        Ref: {item.referenceNumber}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>

                                                        {item.notes && (
                                                            <p className="text-[11px] text-surface-500 italic mt-0.5">
                                                                Note: {item.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action: View Batch Details if from batch */}
                                                {isBatch && item.batchId && (
                                                    <div className="sm:self-center shrink-0">
                                                        <button
                                                            type="button"
                                                            className="btn-secondary btn-sm text-xs flex items-center gap-1.5 w-full sm:w-auto justify-center"
                                                            onClick={() => handleViewBatch(item.batchId!)}
                                                            disabled={fetchingBatch}
                                                        >
                                                            <HiOutlineDocumentText className="w-3.5 h-3.5 text-blue-600" />
                                                            View Receipt
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer Info */}
                        <div className="bg-surface-50 p-3.5 rounded-xl border border-surface-200 flex items-start gap-2 text-xs text-surface-600">
                            <HiOutlineInformationCircle className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-surface-800">Automatic Installment Reconciliation</p>
                                <p className="text-surface-500 text-[11px] mt-0.5">
                                    All payments, whether collected directly from the customer or via dealer bulk batches, are tracked chronologically to ensure complete audit compliance without discrepancies.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button type="button" className="btn-secondary" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Nested Batch Receipt Viewer Modal */}
            {selectedBatch && (
                <BatchDetailModal
                    batch={selectedBatch}
                    isOpen={!!selectedBatch}
                    onClose={() => setSelectedBatch(null)}
                />
            )}
        </>
    );
};

export default PaymentHistoryModal;
