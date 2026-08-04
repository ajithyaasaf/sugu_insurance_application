import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { formatDate, formatCurrency, getStatusColor, daysUntil, scrollToFirstError, formatVehicleClass } from '../utils/format';
import toast from 'react-hot-toast';
import Modal from '../components/ui/Modal';
import { 
    HiOutlineArrowLeft, 
    HiOutlineDocumentText, 
    HiOutlineUser, 
    HiOutlineOfficeBuilding, 
    HiOutlineClock,
    HiOutlineShieldCheck,
    HiOutlineRefresh,
    HiOutlineUserGroup,
    HiOutlineCash,
    HiOutlinePlus,
    HiOutlineCreditCard
} from 'react-icons/hi';
import Button from '../components/ui/Button';

const PolicyDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [policy, setPolicy] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Quick Add Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const fetchPolicy = async () => {
        try {
            const res = await api.get(`/policies/${id}`);
            setPolicy(res.data.data);
        } catch (err) {
            toast.error('Failed to load policy details');
            navigate('/policies');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolicy();
    }, [id, navigate]);

    const validatePayment = () => {
        const errs: Record<string, string> = {};
        const amt = parseFloat(paymentAmount);
        if (!paymentAmount) errs.paymentAmount = 'Amount is required';
        else if (amt <= 0) errs.paymentAmount = 'Amount must be greater than zero';
        else if (amt > summary.balanceDue) errs.paymentAmount = `Amount cannot exceed balance (${formatCurrency(summary.balanceDue)})`;
        return errs;
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validatePayment();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            scrollToFirstError();
            return;
        }
        setErrors({});
        
        setIsSubmitting(true);
        try {
            const amt = parseFloat(paymentAmount);
            // 1. Find the existing pending record (the balance placeholder)
            const pendingPayment = policy.payments?.find((p: any) => p.status === 'pending');

            // 2. Create the NEW collection record (The History Entry)
            await api.post('/payments', {
                policyId: policy.id,
                customerId: policy.customerId,
                amount: amt,
                paidAmount: amt,
                paidDate: new Date().toISOString(),
                dueDate: new Date().toISOString(),
                status: 'paid',
                notes: paymentNotes || 'Collection from policy detail',
            });

            // 3. If there was a pending placeholder, reduce its amount by the collected amount
            if (pendingPayment) {
                const newPendingAmount = Math.max(0, pendingPayment.amount - amt);
                if (newPendingAmount < 0.01) {
                    // Fully paid — remove the pending placeholder
                    await api.delete(`/payments/${pendingPayment.id}`);
                } else {
                    // Still a balance — update the placeholder
                    await api.put(`/payments/${pendingPayment.id}`, {
                        amount: newPendingAmount,
                        status: 'pending'
                    });
                }
            }

            toast.success('Collection recorded');
            setShowPaymentModal(false);
            setPaymentAmount('');
            setPaymentNotes('');
            fetchPolicy(); // Refresh data to see new history
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to record payment');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full" /></div>;
    if (!policy) return null;

    const summary = policy.paymentSummary || { totalPremium: policy.totalPremium || policy.premiumAmount, totalPaid: 0, balanceDue: policy.totalPremium || policy.premiumAmount };
    const percentPaid = Math.min(100, Math.round((summary.totalPaid / summary.totalPremium) * 100));

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl transition-colors">
                    <HiOutlineArrowLeft className="w-5 h-5 text-surface-600" />
                </button>
                <div>
                    <h1 className="text-xl font-bold text-surface-900">Policy Details</h1>
                    <p className="text-xs text-surface-500">ID: {policy.id}</p>
                </div>
                <div className="ml-auto">
                    <span className={getStatusColor(policy.status)}>{policy.status}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card card-body space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><HiOutlineUser className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Customer</p>
                                    <p className="text-sm font-medium text-surface-900">{policy.customer?.name}</p>
                                    <p className="text-xs text-surface-500">{policy.customer?.phone}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><HiOutlineOfficeBuilding className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Company</p>
                                    <p className="text-sm font-medium text-surface-900">{policy.company?.name}</p>
                                    <p className="text-xs text-surface-500">{policy.company?.category}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${policy.dealer ? 'bg-purple-50 text-purple-600' : 'bg-surface-100 text-surface-500'}`}>
                                    <HiOutlineUserGroup className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Source / Dealer</p>
                                    <p className="text-sm font-medium text-surface-900">
                                        {policy.dealer ? policy.dealer.name : 'Direct Policy'}
                                    </p>
                                    <p className="text-xs text-surface-500">
                                        {policy.dealer ? (policy.dealer.phone || 'Referred') : 'Direct'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><HiOutlineDocumentText className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Policy Details</p>
                                    <p className="text-sm font-medium text-surface-900">
                                        {policy.policyType === 'motor' ? `${policy.make || ''} ${policy.model || ''}`.trim() || 'Motor' : policy.productName || policy.policyType}
                                    </p>
                                    <p className="text-xs text-surface-500">No: {policy.policyNumber || 'N/A'}</p>
                                </div>
                            </div>
                            {policy.vehicleNumber && (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-violet-50 rounded-lg text-violet-600"><HiOutlineShieldCheck className="w-5 h-5" /></div>
                                    <div>
                                        <p className="text-xs font-bold text-surface-400 uppercase tracking-wider">Vehicle Number</p>
                                        <p className="text-sm font-medium text-surface-900">{policy.vehicleNumber}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {(policy.policyType === 'motor' || policy.vehicleClass) && (policy.make || policy.model || policy.vehicleClass || policy.paymentMethod) && (
                            <div className="pt-4 border-t border-surface-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {policy.make && <div>
                                    <p className="text-xs text-surface-500 mb-1">Make</p>
                                    <p className="text-sm font-medium text-surface-900">{policy.make}</p>
                                </div>}
                                {policy.model && <div>
                                    <p className="text-xs text-surface-500 mb-1">Model</p>
                                    <p className="text-sm font-medium text-surface-900">{policy.model}</p>
                                </div>}
                                {policy.registrationDate && <div>
                                    <p className="text-xs text-surface-500 mb-1">Reg. Date</p>
                                    <p className="text-sm font-medium text-surface-900">{formatDate(policy.registrationDate)}</p>
                                </div>}
                                {policy.vehicleClass && <div>
                                    <p className="text-xs text-surface-500 mb-1">Class</p>
                                    <p className="text-sm font-medium text-surface-900">{formatVehicleClass(policy.vehicleClass)}</p>
                                </div>}
                                {policy.paymentMethod && <div>
                                    <p className="text-xs text-surface-500 mb-1">Payment Method</p>
                                    <p className="text-sm font-medium text-surface-900 capitalize">{policy.paymentMethod}</p>
                                </div>}
                            </div>
                        )}

                        {/* Premium Breakdown Section */}
                        <div className="pt-4 border-t border-surface-100">
                            <h3 className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mb-3">Premium Breakdown</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                                {policy.sumInsured > 0 && <div>
                                    <p className="text-xs text-surface-500 mb-1">Sum Insured</p>
                                    <p className="text-sm font-medium text-surface-900">{formatCurrency(policy.sumInsured)}</p>
                                </div>}
                                {policy.idv > 0 && <div>
                                    <p className="text-xs text-surface-500 mb-1">IDV</p>
                                    <p className="text-sm font-medium text-surface-900">{formatCurrency(policy.idv)}</p>
                                </div>}
                                {policy.od > 0 && <div>
                                    <p className="text-xs text-surface-500 mb-1">OD Premium</p>
                                    <p className="text-sm font-medium text-surface-900">{formatCurrency(policy.od)}</p>
                                </div>}
                                {policy.tp > 0 && <div>
                                    <p className="text-xs text-surface-500 mb-1">TP Premium</p>
                                    <p className="text-sm font-medium text-surface-900">{formatCurrency(policy.tp)}</p>
                                </div>}
                                {policy.tax > 0 && <div>
                                    <p className="text-xs text-surface-500 mb-1">Tax (GST)</p>
                                    <p className="text-sm font-medium text-surface-900">{formatCurrency(policy.tax)}</p>
                                </div>}
                                <div>
                                    <p className="text-xs text-surface-500 mb-1">Payment Method</p>
                                    <p className="text-sm font-medium text-surface-900 capitalize">{policy.paymentMethod || 'Not set'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-surface-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                                <p className="text-xs text-surface-500 mb-1">Net Premium</p>
                                <p className="text-base font-bold text-surface-900">{formatCurrency(policy.premiumAmount)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-surface-500 mb-1">Total Premium</p>
                                <p className="text-lg font-black text-primary-600">{formatCurrency(policy.totalPremium || policy.premiumAmount)}</p>
                            </div>
                            {(() => {
                                const isSaod = policy.vehicleClass === 'SAOD_TW' || policy.vehicleClass === 'SAOD_PVT';
                                return (
                                    <>
                                        <div>
                                            <p className="text-xs text-surface-500 mb-1">{isSaod ? 'OD Start Date' : 'Start Date'}</p>
                                            <p className="text-sm font-medium text-surface-900">{formatDate(policy.startDate)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-surface-500 mb-1">{isSaod ? 'OD End Date' : 'Expiry Date'}</p>
                                            <p className="text-sm font-medium text-surface-900">{formatDate(policy.expiryDate)}</p>
                                        </div>
                                        {isSaod && policy.tpStartDate && (
                                            <div>
                                                <p className="text-xs text-surface-500 mb-1">TP Start Date</p>
                                                <p className="text-sm font-medium text-surface-900">{formatDate(policy.tpStartDate)}</p>
                                            </div>
                                        )}
                                        {isSaod && policy.tpEndDate && (
                                            <div>
                                                <p className="text-xs text-surface-500 mb-1">TP End Date</p>
                                                <p className="text-sm font-medium text-surface-900">{formatDate(policy.tpEndDate)}</p>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Renewal History */}
                    <div className="card">
                        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                            <h2 className="font-semibold text-surface-900">Renewal History</h2>
                            <HiOutlineRefresh className="w-4 h-4 text-surface-400" />
                        </div>
                        <div className="p-5">
                            <div className="space-y-6">
                                {/* Parent Policy */}
                                {policy.parentPolicy && (
                                    <div className="flex gap-4 relative">
                                        <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-surface-100" />
                                        <div className="w-6 h-6 rounded-full bg-surface-100 border-2 border-surface-200 flex-shrink-0 z-10" />
                                        <div className="flex-1 pb-4">
                                            <div className="bg-surface-50 rounded-xl p-3 border border-surface-100 cursor-pointer hover:border-primary-200 transition-colors"
                                                 onClick={() => navigate(`/policies/${policy.parentPolicy.id}`)}>
                                                <div className="flex justify-between mb-1">
                                                    <p className="text-xs font-bold text-surface-400">PREVIOUS POLICY</p>
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-200 text-surface-600 rounded capitalize">{policy.parentPolicy.status}</span>
                                                </div>
                                                <p className="text-sm font-medium text-surface-900">
                                                    {policy.parentPolicy.company?.name ? `${policy.parentPolicy.company.name} — ` : ''}{policy.parentPolicy.policyNumber || 'No Number'}
                                                </p>
                                                <p className="text-xs text-surface-500">{formatDate(policy.parentPolicy.startDate)} - {formatDate(policy.parentPolicy.expiryDate)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Current Policy */}
                                <div className="flex gap-4 relative">
                                    <div className={`absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-surface-100 ${policy.renewals?.length === 0 ? 'hidden' : ''}`} />
                                    <div className="w-6 h-6 rounded-full bg-primary-600 border-4 border-primary-50 flex-shrink-0 z-10" />
                                    <div className="flex-1 pb-4">
                                        <div className="bg-primary-50 rounded-xl p-3 border border-primary-100 ring-2 ring-primary-600/10">
                                            <div className="flex justify-between mb-1">
                                                <p className="text-xs font-bold text-primary-600">CURRENT POLICY</p>
                                                <span className={getStatusColor(policy.status)}>{policy.status}</span>
                                            </div>
                                            <p className="text-sm font-medium text-surface-900">
                                                {policy.company?.name ? `${policy.company.name} — ` : ''}{policy.policyNumber || 'No Number'}
                                            </p>
                                            <p className="text-xs text-surface-500">{formatDate(policy.startDate)} - {formatDate(policy.expiryDate)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Renewals (Children) */}
                                {policy.renewals?.map((renewal: any) => (
                                    <div key={renewal.id} className="flex gap-4 relative last:mb-0">
                                        <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-surface-100 last:hidden" />
                                        <div className="w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-200 flex-shrink-0 z-10" />
                                        <div className="flex-1 pb-4">
                                            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 cursor-pointer hover:border-emerald-300 transition-colors"
                                                 onClick={() => navigate(`/policies/${renewal.id}`)}>
                                                <div className="flex justify-between mb-1">
                                                    <p className="text-xs font-bold text-emerald-600 uppercase">RENEWED TO</p>
                                                    <span className={getStatusColor(renewal.status)}>{renewal.status}</span>
                                                </div>
                                                <p className="text-sm font-medium text-surface-900">
                                                    {renewal.company?.name ? `${renewal.company.name} — ` : ''}{renewal.policyNumber || 'No Number'}
                                                </p>
                                                <p className="text-xs text-surface-500">{formatDate(renewal.startDate)} - {formatDate(renewal.expiryDate)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    {/* Financial Ledger (Flexible Tracker) */}
                    <div className="card">
                        <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between bg-primary-50/30">
                            <div className="flex items-center gap-2">
                                <HiOutlineCash className="w-5 h-5 text-primary-600" />
                                <h3 className="text-sm font-bold text-surface-900">Financial Ledger</h3>
                            </div>
                            <button 
                                onClick={() => setShowPaymentModal(true)}
                                className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                                title="Record Payment"
                            >
                                <HiOutlinePlus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                    <span className="text-surface-500">Collection Progress</span>
                                    <span className={summary.balanceDue === 0 ? 'text-emerald-600' : 'text-primary-600'}>
                                        {percentPaid}%
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-surface-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-500 ${summary.balanceDue === 0 ? 'bg-emerald-500' : 'bg-primary-600'}`}
                                        style={{ width: `${percentPaid}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div className="p-3 bg-surface-50 rounded-xl border border-surface-100">
                                    <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1">Total Paid</p>
                                    <p className="text-lg font-bold text-emerald-600">{formatCurrency(summary.totalPaid)}</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Balance Due</p>
                                    <p className="text-lg font-bold text-red-600">{formatCurrency(summary.balanceDue)}</p>
                                </div>
                            </div>

                            {policy.payments?.length > 0 && (
                                <div className="pt-2">
                                    <p className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-2">Recent Collections</p>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {policy.payments.filter((p: any) => p.status === 'paid' || (p.paidAmount || 0) > 0).map((p: any) => (
                                            <div key={p.id} className="flex justify-between items-center text-xs p-2 hover:bg-surface-50 rounded-lg transition-colors border border-transparent hover:border-surface-100">
                                                <div>
                                                    <p className="font-semibold text-surface-900">{formatCurrency(p.paidAmount || p.amount)}</p>
                                                    <p className="text-[10px] text-surface-400">{formatDate(p.paidDate || p.createdAt)}</p>
                                                </div>
                                                <HiOutlineCreditCard className="w-3.5 h-3.5 text-surface-300" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timeline Card */}
                    <div className="card card-body">
                        <div className="flex items-center gap-2 mb-4">
                            <HiOutlineClock className="w-4 h-4 text-surface-400" />
                            <h3 className="text-sm font-bold text-surface-900">Timeline</h3>
                        </div>
                        <div className="space-y-4">
                            {(() => {
                                const isSaod = policy.vehicleClass === 'SAOD_TW' || policy.vehicleClass === 'SAOD_PVT';
                                const odDays = daysUntil(policy.expiryDate);
                                const tpDays = isSaod && policy.tpEndDate ? daysUntil(policy.tpEndDate) : 9999;
                                const minDays = isSaod && policy.tpEndDate ? Math.min(odDays, tpDays) : odDays;
                                const isTpSoonest = isSaod && policy.tpEndDate && tpDays < odDays;

                                return (
                                    <div>
                                        <p className="text-xs text-surface-500">
                                            {isSaod && policy.tpEndDate ? (isTpSoonest ? 'Days Left (TP Cover)' : 'Days Left (OD Cover)') : 'Days Left'}
                                        </p>
                                        <p className={`text-xl font-bold ${minDays <= 30 ? 'text-red-600' : 'text-surface-900'}`}>
                                            {minDays} <span className="text-xs font-normal">days until expiry</span>
                                        </p>
                                    </div>
                                );
                            })()}
                            <div>
                                <p className="text-xs text-surface-500">Created</p>
                                <p className="text-sm text-surface-700">{formatDate(policy.createdAt)} by {policy.createdBy}</p>
                            </div>
                        </div>
                    </div>

                    {/* Claims Card */}
                    <div className="card">
                        <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between bg-surface-50/50">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">Claims</h3>
                                <span className="text-[10px] font-bold bg-surface-200 text-surface-600 px-1.5 py-0.5 rounded-full">{policy.claims?.length || 0}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-surface-500">NCB:</span>
                                {policy.hasNCB ? (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">YES</span>
                                ) : (
                                    <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">NO</span>
                                )}
                                {policy.policyType === 'motor' && (
                                    <>
                                        <span className="text-surface-300 mx-1">|</span>
                                        <span className="text-[10px] uppercase font-bold text-surface-500">Applied:</span>
                                        <span className="text-[10px] font-bold bg-surface-100 text-surface-700 px-1.5 py-0.5 rounded">
                                            {policy.ncbPercentage ? `${policy.ncbPercentage}%` : '—'}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="p-4">
                            {policy.claims?.length === 0 ? (
                                <p className="text-center text-xs text-surface-400 py-2">No claims filed</p>
                            ) : (
                                <div className="space-y-3">
                                    {policy.claims.map((claim: any) => (
                                        <div key={claim.id} className="text-xs border-b border-surface-50 pb-2 last:border-0 last:pb-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="font-medium text-surface-900">
                                                    <span className="text-[10px] text-surface-400 font-bold uppercase mr-1">Settled:</span>
                                                    {claim.claimAmount != null ? formatCurrency(claim.claimAmount) : '—'}
                                                </p>
                                                <span className={`text-[10px] uppercase font-bold ${getStatusColor(claim.status)}`}>
                                                    {claim.status}
                                                </span>
                                            </div>
                                            <div className="flex gap-3 text-[10px] text-surface-500">
                                                {claim.estimatedAmount != null && (
                                                    <span className="text-amber-600">Est: {formatCurrency(claim.estimatedAmount)}</span>
                                                )}
                                                {claim.billAmount != null && (
                                                    <span className="text-emerald-600">Bill: {formatCurrency(claim.billAmount)}</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-surface-400 mt-0.5">{formatDate(claim.claimDate)}</p>
                                            {(claim.surveyorName || claim.workshopName) && (
                                                <p className="text-[10px] text-surface-500 mt-1">
                                                    {claim.surveyorName && `Srv: ${claim.surveyorName}`}
                                                    {claim.surveyorPhone && ` (${claim.surveyorPhone})`}
                                                    {claim.workshopName && ` | WS: ${claim.workshopName}`}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Add Payment Modal */}
            <Modal
                isOpen={showPaymentModal}
                onClose={() => { if (!isSubmitting) { setShowPaymentModal(false); setErrors({}); } }}
                title="Record Collection"
            >
                <form onSubmit={handleAddPayment} className="space-y-4" noValidate>
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl mb-4">
                        <div className="flex justify-between items-center mb-1">
                            <p className="text-[10px] font-bold text-amber-600 uppercase">Remaining Balance</p>
                            <p className="text-sm font-bold text-amber-700">{formatCurrency(summary.balanceDue)}</p>
                        </div>
                        <p className="text-[10px] text-amber-600 italic">Total Premium: {formatCurrency(summary.totalPremium)}</p>
                    </div>

                    <div>
                        <label className="label">Amount Received (₹) *</label>
                        <input 
                            type="number" 
                            className={`input ${errors.paymentAmount ? 'border-red-500 focus:ring-red-400' : ''}`} 
                            data-error-field={errors.paymentAmount ? 'true' : undefined}
                            placeholder="e.g. 5000"
                            value={paymentAmount}
                            onChange={(e) => { setPaymentAmount(e.target.value); setErrors(prev => ({ ...prev, paymentAmount: '' })); }}
                            disabled={isSubmitting}
                        />
                        {errors.paymentAmount && <p className="text-xs text-red-500 mt-1">{errors.paymentAmount}</p>}
                    </div>
                    <div>
                        <label className="label">Notes / Reference</label>
                        <textarea 
                            className="input" 
                            rows={2} 
                            placeholder="e.g. Cash collected at office"
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setShowPaymentModal(false)} 
                            className="btn-secondary flex-1"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <Button 
                            type="submit" 
                            isLoading={isSubmitting}
                            disabled={!paymentAmount}
                            className="btn-primary flex-1"
                        >
                            Collect Payment
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default PolicyDetail;
