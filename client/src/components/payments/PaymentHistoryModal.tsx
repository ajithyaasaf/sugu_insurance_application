import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/format';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { 
    HiOutlineClock,
    HiOutlineDocumentText,
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
                const payload = res.data?.data || res.data;
                setData(payload);
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
            setSelectedBatch(res.data?.data || res.data);
        } catch {
            toast.error('Failed to load batch receipt details');
        } finally {
            setFetchingBatch(false);
        }
    };

    if (!isOpen) return null;

    const summary = data?.summary;
    const payment = data?.payment;
    const history = data?.history || [];

    const percentPaid = summary && summary.amount > 0 
        ? Math.min(100, Math.round(((summary.paidAmount || 0) / summary.amount) * 100))
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
                        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-medium text-surface-500">Loading payment history...</p>
                    </div>
                ) : !data || !payment || !summary ? (
                    <div className="py-8 text-center text-surface-500">
                        <HiOutlineInformationCircle className="w-8 h-8 mx-auto text-surface-400 mb-2" />
                        <p className="text-sm">No payment history details available.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Header Policy Summary Card (Clean brand-matching light container) */}
                        <div className="bg-surface-50 border border-surface-200 rounded-xl p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-200">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="badge-default">
                                            {payment.policy?.productName || payment.policy?.policyType || 'Policy'}
                                        </span>
                                        {payment.policy?.vehicleNumber && (
                                            <span className="badge-default font-mono">
                                                {payment.policy.vehicleNumber}
                                            </span>
                                        )}
                                        <span className={getStatusColor(payment.status)}>
                                            {payment.status}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-bold text-surface-900">
                                        {payment.customer?.name || 'Customer'}
                                        {payment.customer?.phone && (
                                            <span className="text-xs font-normal text-surface-500 ml-1.5">
                                                ({payment.customer.phone})
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-surface-500 mt-0.5">
                                        Policy No: <span className="font-mono text-surface-700">{payment.policy?.policyNumber || '—'}</span>
                                        {payment.policy?.dealer?.name && (
                                            <span className="ml-2 pl-2 border-l border-surface-300">
                                                Dealer: <span className="font-medium text-surface-800">{payment.policy.dealer.name}</span>
                                            </span>
                                        )}
                                    </p>
                                </div>

                                <div className="text-left sm:text-right">
                                    <span className="text-xs text-surface-500 block mb-0.5">Collection Progress</span>
                                    <span className="text-lg font-bold text-primary-600">
                                        {percentPaid}%
                                    </span>
                                </div>
                            </div>

                            {/* Summary Metrics Grid */}
                            <div className="grid grid-cols-3 gap-3 pt-3">
                                <div className="bg-white p-3 rounded-lg border border-surface-200 text-center">
                                    <span className="text-xs text-surface-500 block mb-0.5">Total Due</span>
                                    <span className="text-base font-bold text-surface-900">
                                        {formatCurrency(summary.amount)}
                                    </span>
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-surface-200 text-center">
                                    <span className="text-xs text-surface-500 block mb-0.5">Total Paid</span>
                                    <span className="text-base font-bold text-surface-900">
                                        {formatCurrency(summary.paidAmount)}
                                    </span>
                                </div>
                                <div className={`p-3 rounded-lg border text-center ${summary.balanceDue > 0 ? 'bg-red-50/50 border-red-200' : 'bg-white border-surface-200'}`}>
                                    <span className="text-xs text-surface-500 block mb-0.5">Balance Left</span>
                                    <span className={`text-base font-bold ${summary.balanceDue > 0 ? 'text-red-600' : 'text-surface-900'}`}>
                                        {formatCurrency(summary.balanceDue)}
                                    </span>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-3 pt-3 border-t border-surface-200">
                                <div className="w-full h-2 bg-surface-200 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary-600 rounded-full transition-all duration-300"
                                        style={{ width: `${percentPaid}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Chronological Installments Timeline */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-surface-900 flex items-center gap-1.5">
                                    <HiOutlineClock className="w-4 h-4 text-surface-500" />
                                    Payment Installments & Settlements
                                </h4>
                                <span className="text-xs text-surface-500">
                                    {history.length} {history.length === 1 ? 'record' : 'records'}
                                </span>
                            </div>

                            {history.length === 0 ? (
                                <div className="p-6 text-center bg-surface-50 rounded-xl border border-surface-200">
                                    <p className="text-xs text-surface-500">No installment records found for this policy.</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {history.map((item, idx) => {
                                        const isBatch = item.type === 'batch';

                                        return (
                                            <div 
                                                key={idx}
                                                className="bg-white rounded-xl p-3.5 border border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span className="w-7 h-7 rounded-lg bg-surface-100 text-surface-600 border border-surface-200 flex items-center justify-center font-semibold text-xs shrink-0 mt-0.5">
                                                        #{idx + 1}
                                                    </span>

                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                                            <span className="text-sm font-bold text-surface-900">
                                                                {formatCurrency(item.amount)}
                                                            </span>

                                                            {isBatch ? (
                                                                <span className="badge-info">
                                                                    Dealer Batch
                                                                </span>
                                                            ) : (
                                                                <span className="badge-default">
                                                                    Direct Payment
                                                                </span>
                                                            )}

                                                            {item.receiptNo && (
                                                                <span className="text-[11px] font-mono text-surface-600 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200">
                                                                    #{item.receiptNo}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-surface-500">
                                                            <span>{formatDate(item.date)}</span>
                                                            <span>•</span>
                                                            <span>Received from: <strong className="text-surface-700 font-medium">{item.payerName}</strong></span>
                                                            {item.paymentMethod && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="uppercase">{item.paymentMethod}</span>
                                                                </>
                                                            )}
                                                            {item.referenceNumber && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="font-mono">Ref: {item.referenceNumber}</span>
                                                                </>
                                                            )}
                                                        </div>

                                                        {item.notes && (
                                                            <p className="text-[11px] text-surface-500 mt-1">
                                                                {item.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {isBatch && item.batchId && (
                                                    <div className="sm:self-center shrink-0">
                                                        <button
                                                            type="button"
                                                            className="btn-secondary btn-sm flex items-center gap-1.5"
                                                            onClick={() => handleViewBatch(item.batchId!)}
                                                            disabled={fetchingBatch}
                                                        >
                                                            <HiOutlineDocumentText className="w-3.5 h-3.5 text-surface-500" />
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

                        {/* Modal Footer */}
                        <div className="flex justify-end pt-3 border-t border-surface-100">
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
