import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    HiOutlineClipboardCheck,
    HiOutlineCurrencyRupee,
    HiOutlineRefresh,
    HiOutlineOfficeBuilding
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { formatCurrency, formatShortCurrency } from '../../utils/format';
import { BarChartRow, CompanyBarChart, PolicyPieChart, TrendAreaChart } from './ReportCharts';

const DashboardTab: React.FC = () => {
    // ── Dashboard Date Filters
    const [localDashFrom, setLocalDashFrom] = useState('');
    const [localDashTo, setLocalDashTo] = useState('');
    const [appliedDashFrom, setAppliedDashFrom] = useState('');
    const [appliedDashTo, setAppliedDashTo] = useState('');
    const [isDashDirty, setIsDashDirty] = useState(false);

    // --- Dashboard analytics ---
    const { data: dashboardData, isLoading: dashLoading } = useQuery({
        queryKey: ['report-dashboard', appliedDashFrom, appliedDashTo],
        queryFn: () => {
            const params = new URLSearchParams();
            if (appliedDashFrom) params.set('dateFrom', appliedDashFrom);
            if (appliedDashTo) params.set('dateTo', appliedDashTo);
            return api.get(`/reports/dashboard${params.toString() ? `?${params}` : ''}`).then(r => r.data);
        },
    });
    const dash = dashboardData?.data;

    if (dashLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full" />
            </div>
        );
    }
    if (!dash) return null;

    const companyData = dash.companyPerformance?.data || [];
    const policyTypeData = dash.policyTypeBreakdown?.data || [];
    const dealerData = dash.dealerPerformance?.data || [];
    const monthlyData = dash.monthlyTrend?.data || [];
    const paymentData = dash.paymentSummary?.data || [];
    const vehicleClassData = dash.vehicleClassPerformance?.data || [];
    const periodLabel: string = dash.periodLabel || 'This Month';
    const isFiltered = !!(appliedDashFrom || appliedDashTo);

    const applyDashFilter = () => {
        if (localDashFrom && localDashTo && new Date(localDashFrom) > new Date(localDashTo)) {
            toast.error('Date From cannot be after Date To');
            return;
        }
        setAppliedDashFrom(localDashFrom);
        setAppliedDashTo(localDashTo);
        setIsDashDirty(false);
    };

    const clearDashFilter = () => {
        setLocalDashFrom('');
        setLocalDashTo('');
        setAppliedDashFrom('');
        setAppliedDashTo('');
        setIsDashDirty(false);
    };

    return (
        <div className="space-y-6">
            {/* Date Filter Panel */}
            <div className="card card-body">
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1">
                        <label className="label">Date From</label>
                        <input
                            type="date"
                            className="input"
                            value={localDashFrom}
                            onChange={e => { setLocalDashFrom(e.target.value); setIsDashDirty(true); }}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="label">Date To</label>
                        <input
                            type="date"
                            className="input"
                            value={localDashTo}
                            onChange={e => { setLocalDashTo(e.target.value); setIsDashDirty(true); }}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={applyDashFilter}
                            className={`btn-primary ${isDashDirty ? 'ring-2 ring-offset-2 ring-primary-400' : ''}`}
                            disabled={dashLoading}
                        >
                            <HiOutlineRefresh className={`w-4 h-4 ${dashLoading ? 'animate-spin' : ''}`} />
                            {isDashDirty ? 'Apply' : 'Generate'}
                        </button>
                        {isFiltered && (
                            <button onClick={clearDashFilter} className="btn-ghost text-red-500">
                                Clear
                            </button>
                        )}
                    </div>
                </div>
                {isFiltered && (
                    <p className="text-xs text-primary-600 font-medium mt-3">
                        Showing data from {appliedDashFrom || '—'} to {appliedDashTo || 'today'}
                    </p>
                )}
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div className="stat-card p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                            <HiOutlineClipboardCheck className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
                        </div>
                        <div className="w-full">
                            <p className="stat-label">{periodLabel} Policies</p>
                            <p className="stat-value text-xl">{dash.thisMonth?.policiesAdded || 0}</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                            <HiOutlineCurrencyRupee className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="stat-label truncate">{periodLabel} Premium</p>
                            <p className="stat-value text-xl" title={formatCurrency(dash.thisMonth?.totalPremium || 0)}>{formatShortCurrency(dash.thisMonth?.totalPremium || 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                            <HiOutlineRefresh className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="stat-label">Renewal Rate</p>
                            <p className="stat-value text-xl">{dash.renewalStats?.successRate || 0}%</p>
                        </div>
                    </div>
                </div>
                <div className="stat-card p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                            <HiOutlineOfficeBuilding className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <p className="stat-label">Active Companies</p>
                            <p className="stat-value text-xl">{companyData.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Company Performance Bar Chart */}
                <div className="card card-body">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-surface-900">Company-wise Performance</h3>
                        <span className="badge-info">{companyData.length} companies</span>
                    </div>
                    <CompanyBarChart data={companyData} nameKey="name" valueKey="totalPremiumSum" />
                </div>

                {/* Company Performance List */}
                <div className="card card-body">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-surface-900">Company Premium & Policies</h3>
                        <span className="badge-info">{companyData.length} companies</span>
                    </div>
                    <BarChartRow data={companyData} nameKey="name" valueKey="totalPremiumSum" label="Premium (₹)" />
                    {!companyData?.length && (
                        <p className="text-xs text-surface-400 text-center py-6">No company data available</p>
                    )}
                </div>

                {/* Policy Type Breakdown */}
                <div className="card card-body">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-surface-900">Policy Type Breakdown</h3>
                        <span className="badge-info">{policyTypeData.length} types</span>
                    </div>
                    <PolicyPieChart data={policyTypeData} nameKey="name" valueKey="count" />
                    {!policyTypeData?.length && (
                        <p className="text-xs text-surface-400 text-center py-6">No policy data available</p>
                    )}
                </div>

                {/* Monthly Trend */}
                <div className="card card-body">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-surface-900">Monthly Premium Trend</h3>
                        <span className="badge-info">{periodLabel}</span>
                    </div>
                    <TrendAreaChart data={monthlyData} nameKey="name" valueKey="totalPremiumSum" label="Premium (₹)" />
                    {!monthlyData?.length && (
                        <p className="text-xs text-surface-400 text-center py-6">No monthly data available</p>
                    )}
                </div>

                {/* Vehicle Class Performance */}
                <div className="card card-body">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-surface-900">Vehicle Class Performance</h3>
                        <span className="badge-info">{vehicleClassData.length} classes</span>
                    </div>
                    <BarChartRow data={vehicleClassData} nameKey="name" valueKey="totalPremiumSum" label="Premium (₹)" />
                    {!vehicleClassData?.length && (
                        <p className="text-xs text-surface-400 text-center py-6">No vehicle class data available</p>
                    )}
                </div>

                {/* Dealer Performance */}
                <div className="card card-body">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-sm font-bold text-surface-900">Dealer Performance</h3>
                        <span className="badge-info">{dealerData.length} dealers</span>
                    </div>
                    <BarChartRow data={dealerData} nameKey="name" valueKey="totalPremiumSum" label="Premium (₹)" limit={8} />
                    {!dealerData?.length && (
                        <p className="text-xs text-surface-400 text-center py-6">No dealer data available</p>
                    )}
                </div>
            </div>

            {/* Payment Summary */}
            {paymentData?.length > 0 && (
                <div className="card card-body">
                    <h3 className="text-sm font-bold text-surface-900 mb-4">Payment Collection Summary</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {paymentData.map((p: any, i: number) => {
                            const statusColors: any = {
                                paid: 'bg-emerald-500',
                                partial: 'bg-amber-500',
                                pending: 'bg-rose-500',
                                overdue: 'bg-red-600',
                            };
                            const dotColor = statusColors[p.name.toLowerCase()] || 'bg-surface-400';

                            return (
                                <div key={i} className="group relative bg-white border border-surface-200 p-5 rounded-2xl transition-all duration-300 hover:border-primary-200 hover:shadow-xl hover:shadow-primary-900/5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                                            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{p.name}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-surface-900 mb-1">
                                            {formatShortCurrency(p.amountSum || 0)}
                                        </p>
                                        <p className="text-xs font-medium text-surface-500">
                                            {(() => {
                                                const lower = p.name.toLowerCase();
                                                const pluralSuffix = p.count === 1 ? 'payment' : 'payments';
                                                if (lower === 'paid') return `${p.count} ${pluralSuffix} collected`;
                                                if (lower === 'partial') return `${p.count} ${pluralSuffix} partially collected`;
                                                if (lower === 'pending') return `${p.count} ${pluralSuffix} pending collection`;
                                                if (lower === 'overdue') return `${p.count} ${pluralSuffix} overdue`;
                                                return `${p.count} ${pluralSuffix}`;
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardTab;
