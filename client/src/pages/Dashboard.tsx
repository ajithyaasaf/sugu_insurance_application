import React, { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import DashboardSkeleton from '../components/ui/DashboardSkeleton';
import { formatCurrency, formatDate, formatRelativeDate, getStatusColor, daysUntil, formatVehicleClass } from '../utils/format';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineDocumentText,
    HiOutlineUsers,
    HiOutlineTrendingUp,
    HiOutlineCreditCard,
    HiOutlineExclamation,
    HiOutlinePhone,
    HiOutlineClock,
    HiOutlineChevronRight,
    HiOutlineOfficeBuilding,
    HiOutlineCake,
} from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';

interface DashboardData {
    stats: {
        totalCustomers: number;
        totalActivePolicies: number;
        totalLeads: number;
        expiringPoliciesCount: number;
        todayFollowUpsCount: number;
        pendingPaymentsCount: number;
        overduePaymentsCount: number;
        todayBirthdaysCount?: number;
        expiredPoliciesCount?: number;
    };
    expiringPolicies: any[];
    expiredPolicies?: any[];
    todayFollowUps: any[];
    pendingPayments: any[];
    overduePayments: any[];
    recentClaims: any[];
    companyStats: any[];
    vehicleClassStats: any[];
    todayBirthdays?: any[];
}

const Dashboard: React.FC = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activePaymentTab, setActivePaymentTab] = useState<'overdue' | 'upcoming'>('overdue');
    const [activeExpiryTab, setActiveExpiryTab] = useState<'7days' | '30days' | 'expired'>('30days');
    const navigate = useNavigate();
    const birthdaySectionRef = useRef<HTMLDivElement>(null);
    const [birthdayFlash, setBirthdayFlash] = useState(false);

    const scrollToBirthdays = () => {
        birthdaySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setBirthdayFlash(true);
        setTimeout(() => setBirthdayFlash(false), 1400);
    };

    const handleWhatsAppWish = (customer: any) => {
        const phone = customer.phone?.replace(/\D/g, '');
        if (!phone) return;
        const message = encodeURIComponent(`Hi ${customer.name}, Happy Birthday! Wishing you a wonderful day ahead. Warm regards, InsureCRM Team.`);
        window.open(`https://wa.me/91${phone}?text=${message}`, '_blank');
    };

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await api.get('/dashboard/summary');
                setData(res.data.data);
            } catch (err) {
                console.error('Dashboard fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    if (loading) return <DashboardSkeleton />;

    if (!data) return <div className="text-center text-surface-500 py-20">Failed to load dashboard</div>;

    const statCards = [
        {
            label: 'Total Customers',
            value: data.stats.totalCustomers,
            icon: HiOutlineUsers,
            iconBg: 'text-blue-600 bg-blue-50 group-hover:bg-blue-100',
            cardBg: 'border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/10 to-white hover:shadow-md hover:border-l-blue-600',
            valueColor: 'text-blue-600'
        },
        {
            label: 'Active Policies',
            value: data.stats.totalActivePolicies,
            icon: HiOutlineDocumentText,
            iconBg: 'text-emerald-600 bg-emerald-50 group-hover:bg-emerald-100',
            cardBg: 'border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50/10 to-white hover:shadow-md hover:border-l-emerald-600',
            valueColor: 'text-emerald-600'
        },
        {
            label: 'Total Leads',
            value: data.stats.totalLeads,
            icon: HiOutlineTrendingUp,
            iconBg: 'text-violet-600 bg-violet-50 group-hover:bg-violet-100',
            cardBg: 'border-l-4 border-l-violet-500 bg-gradient-to-r from-violet-50/10 to-white hover:shadow-md hover:border-l-violet-600',
            valueColor: 'text-violet-600'
        },
        {
            label: 'Expiring in 30d',
            value: data.stats.expiringPoliciesCount,
            icon: HiOutlineClock,
            iconBg: 'text-amber-600 bg-amber-50 group-hover:bg-amber-100',
            cardBg: 'border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/10 to-white hover:shadow-md hover:border-l-amber-600',
            valueColor: 'text-amber-600'
        },
        {
            label: 'Follow-ups (Due/Overdue)',
            value: data.stats.todayFollowUpsCount,
            icon: HiOutlinePhone,
            iconBg: 'text-cyan-600 bg-cyan-50 group-hover:bg-cyan-100',
            cardBg: 'border-l-4 border-l-cyan-500 bg-gradient-to-r from-cyan-50/10 to-white hover:shadow-md hover:border-l-cyan-600',
            valueColor: 'text-cyan-600'
        },
        {
            label: 'Upcoming Payments',
            value: data.stats.pendingPaymentsCount,
            icon: HiOutlineCreditCard,
            iconBg: 'text-orange-600 bg-orange-50 group-hover:bg-orange-100',
            cardBg: 'border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50/10 to-white hover:shadow-md hover:border-l-orange-600',
            valueColor: 'text-orange-600'
        },
        {
            label: 'Overdue Payments',
            value: data.stats.overduePaymentsCount,
            icon: HiOutlineExclamation,
            iconBg: 'text-red-600 bg-red-50 group-hover:bg-red-100',
            cardBg: 'border-l-4 border-l-red-500 bg-gradient-to-r from-red-50/10 to-white hover:shadow-md hover:border-l-red-600',
            valueColor: 'text-red-600'
        },
        {
            label: "Today's Birthdays",
            value: data.stats.todayBirthdaysCount || 0,
            icon: HiOutlineCake,
            iconBg: 'text-pink-600 bg-pink-50 group-hover:bg-pink-100',
            cardBg: 'border-l-4 border-l-pink-500 bg-gradient-to-r from-pink-50/10 to-white hover:shadow-md hover:border-l-pink-600',
            valueColor: 'text-pink-600'
        },
    ];

    const getFollowUpUrgency = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0,0,0,0);
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        
        const compareDate = new Date(date);
        compareDate.setHours(0,0,0,0);
        
        if (compareDate.getTime() < today.getTime()) {
            return { label: 'Overdue', color: 'bg-red-50 text-red-600 border-red-200' };
        } else if (compareDate.getTime() === today.getTime()) {
            return { label: 'Today', color: 'bg-blue-50 text-blue-600 border-blue-200' };
        } else if (compareDate.getTime() === tomorrow.getTime()) {
            return { label: 'Tomorrow', color: 'bg-amber-50 text-amber-600 border-amber-200' };
        } else {
            return { label: formatDate(dateStr), color: 'bg-slate-50 text-slate-600 border-slate-200' };
        }
    };

    const hasBirthdays = data.todayBirthdays && data.todayBirthdays.length > 0;

    return (
        <>
        <style>{`
            @keyframes birthday-glow {
                0%, 100% {
                    box-shadow: 0 0 8px 2px rgba(236, 72, 153, 0.25), 0 0 20px 5px rgba(168, 85, 247, 0.12);
                }
                50% {
                    box-shadow: 0 0 16px 4px rgba(236, 72, 153, 0.45), 0 0 32px 8px rgba(168, 85, 247, 0.22);
                }
            }
            @keyframes birthday-flash {
                0%   { box-shadow: 0 0 0 0 rgba(236,72,153,0); outline: 2px solid transparent; }
                25%  { box-shadow: 0 0 0 6px rgba(236,72,153,0.3); outline: 2px solid rgba(236,72,153,0.5); }
                70%  { box-shadow: 0 0 0 10px rgba(236,72,153,0.15); outline: 2px solid rgba(236,72,153,0.25); }
                100% { box-shadow: 0 0 0 0 rgba(236,72,153,0); outline: 2px solid transparent; }
            }
            .birthday-flash-ring {
                animation: birthday-flash 1.4s ease-out forwards;
            }
            @keyframes birthday-border-spin {
                0%   { background-position: 0% 50%; }
                50%  { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @keyframes confetti-rise {
                0%   { transform: translateY(0) rotate(0deg) scale(0.7); opacity: 0; }
                15%  { opacity: 0.85; }
                80%  { opacity: 0.85; }
                100% { transform: translateY(-320px) rotate(320deg) scale(0.65); opacity: 0; }
            }
            @keyframes shimmer-bg {
                0%   { background-position: -200% center; }
                100% { background-position: 200% center; }
            }
            @keyframes bounce-cake {
                0%, 100% { transform: translateY(0) scale(1); }
                40%       { transform: translateY(-4px) scale(1.08); }
                60%       { transform: translateY(-2px) scale(1.04); }
            }
            .birthday-card-glow {
                animation: birthday-glow 3s ease-in-out infinite;
                border: 2px solid transparent !important;
                background-clip: padding-box !important;
                position: relative;
            }
            .birthday-card-glow::before {
                content: '';
                position: absolute;
                inset: -2px;
                border-radius: 16px;
                padding: 2px;
                background: linear-gradient(135deg, #f9a8d4, #c084fc, #f472b6, #a78bfa, #f9a8d4);
                background-size: 300% 300%;
                animation: birthday-border-spin 4s linear infinite;
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                opacity: 0.65;
                z-index: 0;
                pointer-events: none;
            }
            .birthday-shimmer-bg {
                background: linear-gradient(120deg,
                    rgba(253,242,248,0.55) 0%,
                    rgba(245,243,255,0.45) 50%,
                    rgba(253,242,248,0.55) 100%) !important;
                background-size: 200% auto !important;
                animation: shimmer-bg 6s linear infinite !important;
            }
            .confetti-particle {
                position: absolute;
                bottom: 6px;
                font-size: 16px;
                animation: confetti-rise 3.2s ease-in infinite;
                pointer-events: none;
                z-index: 20;
            }
            .bounce-cake-icon {
                animation: bounce-cake 2.2s ease-in-out infinite;
                display: inline-block;
            }
            .birthday-row-highlight {
                background: linear-gradient(90deg, rgba(253,242,248,0.5) 0%, rgba(245,243,255,0.35) 100%);
            }
            .birthday-row-highlight:hover {
                background: linear-gradient(90deg, rgba(252,231,243,0.65) 0%, rgba(237,233,254,0.55) 100%) !important;
            }
            .birthday-stat-glow {
                animation: birthday-glow 3s ease-in-out infinite;
                border-left: 4px solid #f472b6 !important;
                background: linear-gradient(135deg,
                    rgba(253,242,248,0.55) 0%,
                    rgba(245,243,255,0.45) 60%,
                    rgba(253,242,248,0.55) 100%) !important;
                background-size: 200% auto !important;
                position: relative;
                overflow: hidden;
                z-index: 1;
            }
            .birthday-stat-glow::before {
                content: '';
                position: absolute;
                inset: -1.5px;
                border-radius: inherit;
                padding: 1.5px;
                background: linear-gradient(135deg, #f9a8d4, #c084fc, #f472b6, #a78bfa, #f9a8d4);
                background-size: 300% 300%;
                animation: birthday-border-spin 5s linear infinite;
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                opacity: 0.65;
                z-index: 0;
                border-radius: 12px;
            }
            @keyframes stat-confetti-rise {
                0%   { transform: translateY(0) rotate(0deg); opacity: 0.8; }
                100% { transform: translateY(-40px) rotate(160deg); opacity: 0; }
            }
            .stat-confetti {
                position: absolute;
                font-size: 11px;
                pointer-events: none;
                animation: stat-confetti-rise 2.4s ease-in infinite;
                opacity: 0.7;
            }
        `}</style>
        <div className="space-y-6 animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="text-sm text-surface-500 mt-1">Your daily overview</p>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                {statCards.map((stat) => {
                    const isBirthdayStat = stat.label === "Today's Birthdays" && hasBirthdays;
                    return (
                        <div
                            key={stat.label}
                            onClick={isBirthdayStat ? scrollToBirthdays : undefined}
                            className={`card card-body group transition-all duration-200 ${
                                isBirthdayStat
                                    ? 'birthday-stat-glow cursor-pointer'
                                    : `hover:scale-[1.02] ${stat.cardBg}`
                            }`}
                        >
                            {/* Mini confetti for birthday stat card */}
                            {isBirthdayStat && (
                                <>
                                    <span className="stat-confetti" style={{ left: '10%', bottom: '6px', animationDelay: '0s' }}>🎉</span>
                                    <span className="stat-confetti" style={{ left: '55%', bottom: '6px', animationDelay: '0.9s' }}>✨</span>
                                    <span className="stat-confetti" style={{ left: '80%', bottom: '6px', animationDelay: '0.45s' }}>🎂</span>
                                </>
                            )}
                            <div className={`w-10 h-10 rounded-xl ${
                                isBirthdayStat
                                    ? 'bg-gradient-to-br from-pink-400 to-purple-500 text-white shadow-md'
                                    : stat.iconBg
                            } flex items-center justify-center mb-3 transition-colors relative z-10`}>
                                <span className={isBirthdayStat ? 'bounce-cake-icon' : ''}>
                                    <stat.icon className="w-5 h-5" />
                                </span>
                            </div>
                            <p className={`text-2xl font-bold relative z-10 ${
                                isBirthdayStat ? 'text-pink-600' : stat.valueColor
                            }`}>{stat.value}</p>
                            <p className={`stat-label text-xs relative z-10 ${
                                isBirthdayStat ? 'text-pink-400 font-semibold' : ''
                            }`}>{stat.label}</p>
                        </div>
                    );
                })}
            </div>

            {/* Priority Section: Expiring Policies & Payments tabbed card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Expiring Policies */}
                <div className="card">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-100">
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            <span className="font-semibold text-surface-900 text-sm sm:text-base">Expiring Policies</span>
                            <div className="flex bg-surface-100 p-0.5 rounded-lg border border-surface-200 text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setActiveExpiryTab('7days')}
                                    className={`px-2.5 py-1 rounded-md transition-all duration-150 ${activeExpiryTab === '7days' ? 'bg-white text-red-600 shadow-sm border border-surface-200 font-bold' : 'text-surface-500 hover:text-surface-900'}`}
                                >
                                    7 Days ({data.expiringPolicies.filter((p: any) => Math.min(daysUntil(p.expiryDate), p.tpEndDate ? daysUntil(p.tpEndDate) : 9999) <= 7).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveExpiryTab('30days')}
                                    className={`px-2.5 py-1 rounded-md transition-all duration-150 ${activeExpiryTab === '30days' ? 'bg-white text-amber-600 shadow-sm border border-surface-200 font-bold' : 'text-surface-500 hover:text-surface-900'}`}
                                >
                                    30 Days ({data.expiringPolicies.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveExpiryTab('expired')}
                                    className={`px-2.5 py-1 rounded-md transition-all duration-150 ${activeExpiryTab === 'expired' ? 'bg-white text-red-600 shadow-sm border border-surface-200 font-bold' : 'text-surface-500 hover:text-surface-900'}`}
                                >
                                    Expired ({data.stats.expiredPoliciesCount || 0})
                                </button>
                            </div>
                        </div>
                        <button onClick={() => navigate('/policies')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5 sm:gap-1">
                            View All <HiOutlineChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="divide-y divide-surface-100 max-h-[400px] overflow-y-auto">
                        {(() => {
                            const filteredPolicies = activeExpiryTab === '7days'
                                ? data.expiringPolicies.filter((p: any) => Math.min(daysUntil(p.expiryDate), p.tpEndDate ? daysUntil(p.tpEndDate) : 9999) <= 7)
                                : activeExpiryTab === 'expired'
                                ? data.expiredPolicies || []
                                : data.expiringPolicies;

                            if (filteredPolicies.length === 0) {
                                return (
                                    <p className="px-5 py-8 text-center text-sm text-surface-400">
                                        {activeExpiryTab === 'expired'
                                            ? 'No expired policies'
                                            : `No policies expiring in ${activeExpiryTab === '7days' ? '7' : '30'} days`}
                                    </p>
                                );
                            }

                            return filteredPolicies.map((policy: any) => (
                                <div key={policy.id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-50 cursor-pointer" onClick={() => navigate(`/policies`)}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-surface-900 truncate">{policy.customer?.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-xs text-surface-500 truncate">{policy.productName || policy.policyType} • {policy.company?.name}</p>
                                            {policy.vehicleNumber && (
                                                <span className="px-1.5 py-0.5 rounded flex-shrink-0 bg-surface-100 text-surface-600 text-[10px] font-semibold tracking-wider uppercase border border-surface-200">
                                                    {policy.vehicleNumber}
                                                </span>
                                            )}
                                            {policy.vehicleClass && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-surface-100 text-surface-700 border border-surface-200 uppercase">
                                                    {formatVehicleClass(policy.vehicleClass)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        {(() => {
                                            const odDays = daysUntil(policy.expiryDate);
                                            const tpDays = policy.tpEndDate ? daysUntil(policy.tpEndDate) : 9999;
                                            const isTpSoonest = tpDays < odDays;
                                            const targetDate = isTpSoonest ? policy.tpEndDate : policy.expiryDate;
                                            const isUrgent = activeExpiryTab === 'expired' || Math.min(odDays, tpDays) <= 7;
                                            return (
                                                <>
                                                    <p className={`text-xs font-medium ${isUrgent ? 'text-red-600' : 'text-amber-600'}`}>
                                                        {isTpSoonest ? 'TP: ' : ''}{formatRelativeDate(targetDate)}
                                                    </p>
                                                    <p className="text-xs text-surface-400">{formatDate(targetDate)}</p>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                {/* Tabbed Payment Collections Card */}
                <div className="card">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-100">
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            <span className="font-semibold text-surface-900 text-sm sm:text-base">Payments</span>
                            <div className="flex bg-surface-100 p-0.5 rounded-lg border border-surface-200 text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setActivePaymentTab('overdue')}
                                    className={`px-2.5 py-1 rounded-md transition-all duration-150 ${activePaymentTab === 'overdue' ? 'bg-white text-red-600 shadow-sm border border-surface-200 font-bold' : 'text-surface-500 hover:text-surface-900'}`}
                                >
                                    Overdue ({data.overduePayments.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActivePaymentTab('upcoming')}
                                    className={`px-2.5 py-1 rounded-md transition-all duration-150 ${activePaymentTab === 'upcoming' ? 'bg-white text-primary-600 shadow-sm border border-surface-200 font-bold' : 'text-surface-500 hover:text-surface-900'}`}
                                >
                                    Upcoming ({data.pendingPayments.length})
                                </button>
                            </div>
                        </div>
                        <button onClick={() => navigate('/payments')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5 sm:gap-1">
                            View All <HiOutlineChevronRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="divide-y divide-surface-100 max-h-[400px] overflow-y-auto">
                        {activePaymentTab === 'overdue' ? (
                            data.overduePayments.length === 0 ? (
                                <p className="px-5 py-8 text-center text-sm text-surface-400">No overdue payments 🎉</p>
                            ) : (
                                data.overduePayments.map((payment: any) => (
                                    <div key={payment.id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-50">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-surface-900 truncate">{payment.customer?.name}</p>
                                            <p className="text-xs text-red-500">Due: {formatDate(payment.dueDate)}</p>
                                        </div>
                                        <p className="text-sm font-semibold text-red-600">{formatCurrency(payment.amount)}</p>
                                    </div>
                                ))
                            )
                        ) : (
                            data.pendingPayments.length === 0 ? (
                                <p className="px-5 py-8 text-center text-sm text-surface-400">No upcoming payments</p>
                            ) : (
                                data.pendingPayments.map((payment: any) => (
                                    <div key={payment.id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-50">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-surface-900 truncate">{payment.customer?.name}</p>
                                            <p className="text-xs text-surface-500">Due: {formatDate(payment.dueDate)}</p>
                                        </div>
                                        <p className="text-sm font-semibold text-surface-900">{formatCurrency(payment.amount)}</p>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Follow-up Row (Full-width for premium look) */}
            <div className="grid grid-cols-1 gap-6">
                {/* Follow-up (7 Days) */}
                <div className="card">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                        <h2 className="font-semibold text-surface-900">Follow-up (7 Days)</h2>
                        <button onClick={() => navigate('/follow-ups')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                            View All <HiOutlineChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="divide-y divide-surface-100 max-h-[400px] overflow-y-auto">
                        {data.todayFollowUps.length === 0 ? (
                            <p className="px-5 py-8 text-center text-sm text-surface-400 font-medium">All caught up! No overdue or upcoming follow-ups for this week. 🎉</p>
                        ) : (
                            data.todayFollowUps.map((item: any) => (
                                <div key={item.id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-50 cursor-pointer" onClick={() => navigate(item.type === 'lead' ? '/leads' : '/follow-ups')}>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-surface-900 truncate">{item.customer?.name}</p>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${item.type === 'lead' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {item.type === 'lead' ? 'Lead' : 'Customer'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-surface-500 truncate mt-0.5">{item.notes || 'No notes'}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                                        {item.nextFollowUpDate && (() => {
                                            const urgency = getFollowUpUrgency(item.nextFollowUpDate);
                                            return (
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${urgency.color}`}>
                                                    {urgency.label}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Company-wise Stats */}
            <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-2">
                    <HiOutlineOfficeBuilding className="w-5 h-5 text-surface-400" />
                    <h2 className="font-semibold text-surface-900">Policies by Company</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-surface-100">
                    {data.companyStats.length === 0 ? (
                        <p className="col-span-full py-8 text-center text-sm text-surface-400">No company data available</p>
                    ) : (
                        data.companyStats.map((stat: any) => (
                            <div key={stat.companyId} className="px-5 py-4 hover:bg-surface-50 transition-colors">
                                <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-1 truncate">{stat.companyName}</p>
                                <div className="flex items-end justify-between">
                                    <p className="text-xl font-bold text-surface-900">{stat.count} <span className="text-xs font-normal text-surface-500">Policies</span></p>
                                    <p className="text-sm font-semibold text-primary-600">{formatCurrency(stat.totalPremium)}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Vehicle Class Distribution */}
            <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-100 flex items-center gap-2">
                    <HiOutlineDocumentText className="w-5 h-5 text-surface-400" />
                    <h2 className="font-semibold text-surface-900">Vehicle Class Distribution</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-surface-100">
                    {data.vehicleClassStats.length === 0 ? (
                        <p className="col-span-full py-8 text-center text-sm text-surface-400">No vehicle class data available</p>
                    ) : (
                        data.vehicleClassStats.map((stat: any) => (
                            <div key={stat.vehicleClass} className="px-5 py-4 hover:bg-surface-50 transition-colors">
                                <p className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-1 truncate">{formatVehicleClass(stat.vehicleClass)}</p>
                                <div className="flex items-end justify-between">
                                    <p className="text-xl font-bold text-surface-900">{stat.count} <span className="text-xs font-normal text-surface-500">Policies</span></p>
                                    <p className="text-sm font-semibold text-primary-600">{formatCurrency(stat.totalPremium)}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's Birthdays */}
                <div
                    ref={birthdaySectionRef}
                    className={`card lg:col-span-2 overflow-hidden relative ${
                        hasBirthdays ? 'birthday-card-glow birthday-shimmer-bg' : ''
                    } ${
                        birthdayFlash ? 'birthday-flash-ring' : ''
                    }`}
                >
                    {/* Confetti particles — only shown when there are birthdays */}
                    {hasBirthdays && (
                        <div className="absolute inset-x-0 bottom-0 h-full overflow-hidden pointer-events-none">
                            {[...Array(10)].map((_, i) => {
                                const emojis = ['🎂','🎉','🎁','🎊','✨','🌟','🥳','💖','🎈','🍰'];
                                const delays = [0, 0.4, 0.8, 1.2, 1.6, 0.2, 1.0, 0.6, 1.4, 0.3];
                                const lefts  = [8, 15, 24, 35, 46, 57, 65, 74, 83, 92];
                                return (
                                    <span
                                        key={i}
                                        className="confetti-particle"
                                        style={{
                                            left: `${lefts[i]}%`,
                                            animationDelay: `${delays[i]}s`,
                                            animationDuration: `${2.2 + (i % 3) * 0.5}s`,
                                        }}
                                    >
                                        {emojis[i]}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    <div className={`flex items-center justify-between px-5 py-4 border-b ${ hasBirthdays ? 'border-pink-200' : 'border-surface-100' }`}>
                        <div className="flex items-center gap-2">
                            <span className={hasBirthdays ? 'bounce-cake-icon' : ''}>
                                <HiOutlineCake className={`w-5 h-5 ${ hasBirthdays ? 'text-pink-500' : 'text-pink-500' }`} />
                            </span>
                            <h2 className={`font-semibold ${ hasBirthdays ? 'text-pink-700' : 'text-surface-900' }`}>
                                Today's Birthdays
                            </h2>
                            {hasBirthdays && (
                                <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-600 border border-pink-200 animate-pulse">
                                    🎉 {data.todayBirthdays!.length} Celebration{data.todayBirthdays!.length > 1 ? 's' : ''} Today!
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="divide-y divide-pink-100 max-h-[400px] overflow-y-auto relative z-10">
                        {!hasBirthdays ? (
                            <div className="px-5 py-8 text-center">
                                <p className="text-sm text-surface-400">No birthdays today</p>
                            </div>
                        ) : (
                            data.todayBirthdays!.map((customer: any) => (
                                <div key={customer.id} className="px-5 py-3.5 flex items-center justify-between birthday-row-highlight">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md">
                                            {customer.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-surface-900 truncate">{customer.name} 🎂</p>
                                            <p className="text-xs text-pink-500">
                                                {customer.phone || 'No phone number'}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleWhatsAppWish(customer)}
                                        disabled={!customer.phone}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-all hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                    >
                                        <FaWhatsapp className="w-3.5 h-3.5" />
                                        Wish on WhatsApp
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Claims */}
                <div className="card lg:col-span-2">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                        <h2 className="font-semibold text-surface-900">Recent Claims</h2>
                        <button onClick={() => navigate('/claims')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                            View All <HiOutlineChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="divide-y divide-surface-100 max-h-[400px] overflow-y-auto">
                        {data.recentClaims.length === 0 ? (
                            <p className="px-5 py-8 text-center text-sm text-surface-400">No recent claims</p>
                        ) : (
                            data.recentClaims.map((claim: any) => (
                                <div key={claim.id} className="px-5 py-3 flex items-center justify-between hover:bg-surface-50 cursor-pointer" onClick={() => navigate('/claims')}>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-surface-900 truncate">{claim.customer?.name}</p>
                                        <p className="text-xs text-surface-500 truncate">{claim.policyNumber} • {formatDate(claim.claimDate)}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        <p className="text-sm font-semibold text-surface-900">{claim.claimAmount != null ? formatCurrency(claim.claimAmount) : '—'}</p>
                                        <span className={getStatusColor(claim.status)}>{claim.status}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};

export default Dashboard;
