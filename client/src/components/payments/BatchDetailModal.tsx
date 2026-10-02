import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { formatCurrency, formatDate } from '../../utils/format';
import { generateBatchReceiptPdf } from '../../utils/batchReceiptPdf';
import toast from 'react-hot-toast';
import { 
    HiOutlineDocumentDownload, 
    HiOutlineUserGroup, 
    HiOutlineCash, 
    HiOutlineCalendar, 
    HiOutlineDocumentText, 
    HiOutlineIdentification,
    HiOutlineCheckCircle
} from 'react-icons/hi';

interface BatchDetailModalProps {
    batch: any | null;
    isOpen: boolean;
    onClose: () => void;
}

export const BatchDetailModal: React.FC<BatchDetailModalProps> = ({ batch, isOpen, onClose }) => {
    if (!batch) return null;

    const handleDownloadPdf = () => {
        try {
            generateBatchReceiptPdf(batch);
            toast.success(`Downloaded Receipt #${batch.receiptNo}`);
        } catch {
            toast.error('Failed to generate receipt PDF');
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Batch Receipt Details: #${batch.receiptNo}`}
            size="xl"
        >
            <div className="space-y-5">
                {/* Header Highlights Banner */}
                <div className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-950 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white/20 uppercase tracking-wider">
                                {batch.payerType === 'dealer' ? '🏢 Dealer Batch' : '👤 Reference Batch'}
                            </span>
                            <span className="text-xs text-primary-200">
                                Receipt #{batch.receiptNo}
                            </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight">{batch.payerName}</h2>
                        <p className="text-xs text-primary-200 mt-0.5 flex items-center gap-1.5">
                            <HiOutlineCalendar className="w-4 h-4 inline" />
                            Payment Date: {formatDate(batch.paymentDate)}
                        </p>
                    </div>

                    <div className="text-left sm:text-right bg-white/10 p-3.5 rounded-xl backdrop-blur-sm border border-white/10 shrink-0">
                        <p className="text-[11px] font-medium text-primary-200 uppercase tracking-wider">Total Received</p>
                        <p className="text-2xl font-black text-emerald-300 tracking-tight">
                            {formatCurrency(batch.totalAmount)}
                        </p>
                        <p className="text-xs text-primary-200 mt-0.5">
                            {batch.payments?.length || 0} Policies Settled
                        </p>
                    </div>
                </div>

                {/* Metadata Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-50 p-4 rounded-xl border border-surface-200 text-xs">
                    <div>
                        <span className="text-surface-500 font-semibold block mb-0.5">Payment Method</span>
                        <span className="font-bold text-surface-900 uppercase">
                            {batch.paymentMethod || 'Cash'}
                        </span>
                    </div>
                    <div>
                        <span className="text-surface-500 font-semibold block mb-0.5">Reference / UTR</span>
                        <span className="font-bold text-surface-900">
                            {batch.referenceNumber || '—'}
                        </span>
                    </div>
                    <div>
                        <span className="text-surface-500 font-semibold block mb-0.5">Recorded By</span>
                        <span className="font-bold text-surface-900 capitalize">
                            {batch.createdBy || 'Staff'}
                        </span>
                    </div>
                    <div>
                        <span className="text-surface-500 font-semibold block mb-0.5">Recorded On</span>
                        <span className="font-bold text-surface-900">
                            {formatDate(batch.createdAt)}
                        </span>
                    </div>
                    {batch.notes && (
                        <div className="col-span-full pt-2 border-t border-surface-200">
                            <span className="text-surface-500 font-semibold block mb-0.5">Notes:</span>
                            <span className="text-surface-800 italic">{batch.notes}</span>
                        </div>
                    )}
                </div>

                {/* Itemized Settled Policies Table */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-surface-700 uppercase tracking-wider flex items-center gap-1.5">
                            <HiOutlineDocumentText className="w-4 h-4 text-primary-600" />
                            Itemized Policies Settled in this Batch ({batch.payments?.length || 0})
                        </h4>
                    </div>

                    <div className="border border-surface-200 rounded-xl overflow-hidden shadow-sm max-h-80 overflow-y-auto">
                        <table className="min-w-full divide-y divide-surface-200 text-xs text-left">
                            <thead className="bg-surface-100 font-semibold text-surface-600 sticky top-0 z-10">
                                <tr>
                                    <th className="px-3 py-2.5">#</th>
                                    <th className="px-3 py-2.5">Customer</th>
                                    <th className="px-3 py-2.5">Policy / Vehicle</th>
                                    <th className="px-3 py-2.5">Insurer</th>
                                    <th className="px-3 py-2.5">Due Date</th>
                                    <th className="px-3 py-2.5 text-right">Due Amount</th>
                                    <th className="px-3 py-2.5 text-right font-bold text-emerald-700">Paid in Batch</th>
                                    <th className="px-3 py-2.5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-100 bg-white">
                                {(batch.payments || []).map((p: any, idx: number) => {
                                    // Parse allocated amount from notes if present
                                    let allocAmt = p.paidAmount || p.amount;
                                    if (p.notes) {
                                        const match = p.notes.match(/\(\+₹([0-9.]+)\)/);
                                        if (match && match[1]) {
                                            allocAmt = parseFloat(match[1]);
                                        }
                                    }

                                    return (
                                        <tr key={p.id || idx} className="hover:bg-surface-50 transition-colors">
                                            <td className="px-3 py-2 text-surface-500">{idx + 1}</td>
                                            <td className="px-3 py-2">
                                                <p className="font-semibold text-surface-900">{p.customer?.name || '—'}</p>
                                                {p.customer?.phone && <p className="text-[11px] text-surface-500">{p.customer.phone}</p>}
                                            </td>
                                            <td className="px-3 py-2">
                                                <p className="font-medium text-surface-900">{p.policy?.policyNumber || '—'}</p>
                                                {p.policy?.vehicleNumber && (
                                                    <span className="text-[11px] text-surface-500 font-mono">
                                                        {p.policy.vehicleNumber}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-surface-600">
                                                {p.policy?.company?.name || '—'}
                                            </td>
                                            <td className="px-3 py-2 text-surface-500">
                                                {formatDate(p.dueDate)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-surface-700 font-medium">
                                                {formatCurrency(p.amount)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-emerald-600 bg-emerald-50/50">
                                                {formatCurrency(allocAmt)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    p.status === 'paid' 
                                                        ? 'bg-emerald-100 text-emerald-800' 
                                                        : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                    {p.status === 'paid' ? 'CLEARED' : p.status.toUpperCase()}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-surface-200">
                    <p className="text-xs text-surface-500">
                        Official Receipt #{batch.receiptNo} • Issued on {formatDate(batch.paymentDate)}
                    </p>
                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <Button
                            type="button"
                            onClick={handleDownloadPdf}
                            className="btn-primary flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
                        >
                            <HiOutlineDocumentDownload className="w-4 h-4" /> Download PDF Receipt
                        </Button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1 sm:flex-initial"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default BatchDetailModal;
