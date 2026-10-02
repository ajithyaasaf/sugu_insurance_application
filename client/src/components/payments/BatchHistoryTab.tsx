import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import { generateBatchReceiptPdf } from '../../utils/batchReceiptPdf';
import Pagination from '../ui/Pagination';
import EmptyState from '../ui/EmptyState';
import TableSkeleton from '../ui/TableSkeleton';
import BatchDetailModal from './BatchDetailModal';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { 
    HiOutlineSearch, 
    HiOutlineEye, 
    HiOutlineDocumentDownload, 
    HiOutlineRefresh, 
    HiOutlineCollection, 
    HiOutlineCash,
    HiOutlineUserGroup,
    HiOutlineCalendar
} from 'react-icons/hi';

interface BatchHistoryTabProps {
    onOpenNewBatch: () => void;
    refreshTrigger?: number;
}

export const BatchHistoryTab: React.FC<BatchHistoryTabProps> = ({ onOpenNewBatch, refreshTrigger }) => {
    const [batches, setBatches] = useState<any[]>([]);
    const [meta, setMeta] = useState<{ page: number; totalPages: number; total: number; totalCollected?: number }>({
        page: 1,
        totalPages: 1,
        total: 0,
        totalCollected: 0,
    });
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState<any | null>(null);

    const fetchBatches = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const res = await api.get('/payments/batches', {
                params: {
                    page,
                    limit: 10,
                    search: search || undefined,
                },
            });
            setBatches(res.data.data || []);
            setMeta(res.data.meta || { page: 1, totalPages: 1, total: 0, totalCollected: 0 });
        } catch {
            toast.error('Failed to load batch payment history');
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        fetchBatches(1);
    }, [fetchBatches, refreshTrigger]);

    const handleDownloadReceipt = (e: React.MouseEvent, batch: any) => {
        e.stopPropagation();
        try {
            generateBatchReceiptPdf(batch);
            toast.success(`Downloaded Receipt #${batch.receiptNo}`);
        } catch {
            toast.error('Failed to download receipt PDF');
        }
    };

    return (
        <div className="space-y-4">
            {/* KPI Summary Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-surface-200 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 border border-primary-100">
                        <HiOutlineCollection className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Total Batches Recorded</p>
                        <p className="text-xl sm:text-2xl font-black text-surface-900 tracking-tight mt-0.5">
                            {meta.total || 0}
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-surface-200 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                        <HiOutlineCash className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Total Batch Collections</p>
                        <p className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight mt-0.5">
                            {formatCurrency(meta.totalCollected || 0)}
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-surface-200 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                        <HiOutlineUserGroup className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">Avg. Collection per Batch</p>
                        <p className="text-xl sm:text-2xl font-black text-blue-600 tracking-tight mt-0.5">
                            {formatCurrency(meta.total > 0 ? Math.round((meta.totalCollected || 0) / meta.total) : 0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="bg-white rounded-xl p-3 border border-surface-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                    <input
                        type="text"
                        placeholder="Search by receipt #, dealer / payer, UTR..."
                        className="input pl-9 w-full text-xs"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fetchBatches(meta.page)}
                        className="btn-secondary text-xs flex items-center gap-1.5"
                        title="Refresh batches"
                    >
                        <HiOutlineRefresh className="w-4 h-4 text-surface-500" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <Button
                        type="button"
                        onClick={onOpenNewBatch}
                        className="btn-primary text-xs flex items-center gap-1.5"
                    >
                        <HiOutlineCollection className="w-4 h-4" />
                        <span>New Batch Collection</span>
                    </Button>
                </div>
            </div>

            {/* Content Table / Cards */}
            {loading ? (
                <TableSkeleton cols={6} rows={5} />
            ) : batches.length === 0 ? (
                <EmptyState
                    message={search ? 'No batch receipts match your search.' : 'No batch payments have been recorded yet.'}
                    icon={<HiOutlineCollection className="w-12 h-12" />}
                />
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="table-container hidden md:block">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Receipt No.</th>
                                    <th>Date</th>
                                    <th>Payer (Dealer / Ref)</th>
                                    <th>Payment Mode</th>
                                    <th>Policies Settled</th>
                                    <th className="text-right">Total Amount</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {batches.map((b) => (
                                    <tr 
                                        key={b.id} 
                                        className="hover:bg-surface-50/70 transition-colors cursor-pointer"
                                        onClick={() => setSelectedBatch(b)}
                                    >
                                        <td>
                                            <span className="inline-flex items-center font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                                                #{b.receiptNo}
                                            </span>
                                        </td>
                                        <td className="text-xs text-surface-600">
                                            {formatDate(b.paymentDate)}
                                        </td>
                                        <td>
                                            <p className="font-semibold text-surface-900">{b.payerName}</p>
                                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-surface-100 text-surface-600 uppercase">
                                                {b.payerType === 'dealer' ? '🏢 Dealer' : '👤 Reference'}
                                            </span>
                                        </td>
                                        <td>
                                            <p className="font-medium text-surface-800 uppercase text-xs">
                                                {b.paymentMethod || 'Cash'}
                                            </p>
                                            {b.referenceNumber && (
                                                <p className="text-[11px] text-surface-400 font-mono">
                                                    Ref: {b.referenceNumber}
                                                </p>
                                            )}
                                        </td>
                                        <td>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-100 text-surface-700">
                                                {b.payments?.length || 0} policies
                                            </span>
                                        </td>
                                        <td className="text-right font-black text-sm text-emerald-600">
                                            {formatCurrency(b.totalAmount)}
                                        </td>
                                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedBatch(b)}
                                                    className="btn-ghost btn-sm text-primary-600 flex items-center gap-1"
                                                    title="View Itemized Breakdown"
                                                >
                                                    <HiOutlineEye className="w-4 h-4" />
                                                    <span className="text-xs">View</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDownloadReceipt(e, b)}
                                                    className="btn-ghost btn-sm text-surface-600 hover:text-emerald-700 flex items-center gap-1"
                                                    title="Download PDF Receipt"
                                                >
                                                    <HiOutlineDocumentDownload className="w-4 h-4" />
                                                    <span className="text-xs">Receipt</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {batches.map((b) => (
                            <div 
                                key={b.id} 
                                className="card card-body space-y-3 cursor-pointer hover:border-primary-200 transition-colors"
                                onClick={() => setSelectedBatch(b)}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                                        #{b.receiptNo}
                                    </span>
                                    <span className="text-xs text-surface-500">
                                        {formatDate(b.paymentDate)}
                                    </span>
                                </div>

                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-surface-900 text-sm">{b.payerName}</p>
                                        <p className="text-xs text-surface-500 uppercase mt-0.5">
                                            {b.payerType === 'dealer' ? '🏢 Dealer' : '👤 Reference'} • {b.paymentMethod || 'Cash'}
                                        </p>
                                        {b.referenceNumber && (
                                            <p className="text-[11px] text-surface-400 font-mono mt-0.5">
                                                UTR: {b.referenceNumber}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-base text-emerald-600">{formatCurrency(b.totalAmount)}</p>
                                        <span className="text-[11px] text-surface-500 font-medium">
                                            {b.payments?.length || 0} policies settled
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-2 border-t border-surface-100" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedBatch(b)}
                                        className="btn-secondary btn-sm flex-1 flex items-center justify-center gap-1"
                                    >
                                        <HiOutlineEye className="w-3.5 h-3.5" /> View Details
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => handleDownloadReceipt(e, b)}
                                        className="btn-primary btn-sm flex-1 flex items-center justify-center gap-1"
                                    >
                                        <HiOutlineDocumentDownload className="w-3.5 h-3.5" /> PDF Receipt
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {meta.totalPages > 1 && (
                        <Pagination
                            page={meta.page}
                            totalPages={meta.totalPages}
                            onPageChange={(p) => fetchBatches(p)}
                        />
                    )}
                </>
            )}

            {/* Batch Detail Modal */}
            <BatchDetailModal
                batch={selectedBatch}
                isOpen={!!selectedBatch}
                onClose={() => setSelectedBatch(null)}
            />
        </div>
    );
};

export default BatchHistoryTab;
