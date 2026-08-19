import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    HiOutlineCalendar, 
    HiOutlineClipboardCheck, 
    HiOutlineCurrencyRupee, 
    HiOutlineRefresh, 
    HiOutlineOfficeBuilding,
    HiOutlineTrendingUp
} from 'react-icons/hi';
import api from '../../api/client';
import { formatCurrency, formatShortCurrency } from '../../utils/format';
import { BarChartRow, CompanyBarChart, PolicyPieChart } from './ReportCharts';

interface FinancialYear {
    label: string;
    dateFrom: string;
    dateTo: string;
    policyCount: number;
    totalPremium: number;
}

const FinancialYearTab: React.FC = () => {
    const [selectedFy, setSelectedFy] = useState<FinancialYear | null>(null);

    // 1. Fetch available financial years dynamically (enriched with year aggregates)
    const { data: fyListResponse, isLoading: fyLoading } = useQuery({
        queryKey: ['financial-years'],
        queryFn: () => api.get('/reports/financial-years').then(r => r.data),
    });
    
    const fyList: FinancialYear[] = fyListResponse?.data || [];

    // Auto-select the most recent financial year when loaded
    useEffect(() => {
        if (fyList.length > 0 && !selectedFy) {
            setSelectedFy(fyList[0]);
        }
    }, [fyList, selectedFy]);

    // 2. Fetch analytics for the selected financial year
    const { data: dashboardData, isLoading: analyticsLoading } = useQuery({
        queryKey: ['report-fy-dashboard', selectedFy?.label],
        queryFn: () => {
            if (!selectedFy) return null;
            return api.get(`/reports/dashboard?dateFrom=${selectedFy.dateFrom}&dateTo=${selectedFy.dateTo}`).then(r => r.data);
        },
        enabled: !!selectedFy,
    });

    const dash = dashboardData?.data;

    if (fyLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    const companyData = dash?.companyPerformance?.data || [];
    const policyTypeData = dash?.policyTypeBreakdown?.data || [];
    const dealerData = dash?.dealerPerformance?.data || [];
    const monthlyData = dash?.monthlyTrend?.data || [];
    const paymentData = dash?.paymentSummary?.data || [];
    const vehicleClassData = dash?.vehicleClassPerformance?.data || [];
    const claimsTrendData = dash?.claimsTrend?.data || [];
    const periodLabel = selectedFy?.label || 'Financial Year';

    // Find next oldest financial year to compare
    const currentIdx = fyList.findIndex(f => f.label === selectedFy?.label);
    const prevFy = currentIdx !== -1 && currentIdx < fyList.length - 1 ? fyList[currentIdx + 1] : null;

    // Calculate YoY growth percentage
    let premiumGrowthPct = 0;
    let policyGrowthPct = 0;
    if (prevFy && selectedFy) {
        if (prevFy.totalPremium > 0) {
            premiumGrowthPct = Math.round(((selectedFy.totalPremium - prevFy.totalPremium) / prevFy.totalPremium) * 100);
        }
        if (prevFy.policyCount > 0) {
            policyGrowthPct = Math.round(((selectedFy.policyCount - prevFy.policyCount) / prevFy.policyCount) * 100);
        }
    }

    return (
        <div className="space-y-6">
            {/* Visual FY Selector Grid */}
            <div>
                <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-3">Select Financial Year</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {fyList.map((fy) => {
                        const isSelected = selectedFy?.label === fy.label;
                        // Format range visually: April 2025 - March 2026
                        const fromYear = new Date(fy.dateFrom).getFullYear();
                        const toYear = new Date(fy.dateTo).getFullYear();
                        const rangeText = `April ${fromYear} - March ${toYear}`;

                        return (
                            <button
                                key={fy.label}
                                onClick={() => setSelectedFy(fy)}
                                className={`flex flex-col items-start p-5 rounded-2xl border text-left transition-all duration-300 w-full relative overflow-hidden ${
                                    isSelected
                                        ? 'bg-gradient-to-br from-primary-50/50 to-primary-100/50 border-primary-500 shadow-xl shadow-primary-900/5 ring-1 ring-primary-500'
                                        : 'bg-white border-surface-200 hover:border-surface-300 hover:shadow-lg'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full mb-3">
                                    <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-primary-600 text-white' : 'bg-surface-100 text-surface-500'}`}>
                                        <HiOutlineCalendar className="w-5 h-5" />
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-primary-600/10 text-primary-700' : 'bg-surface-100 text-surface-500'}`}>
                                        {fy.policyCount} {fy.policyCount === 1 ? 'Policy' : 'Policies'}
                                    </span>
                                </div>
                                <span className={`text-lg font-black ${isSelected ? 'text-primary-950' : 'text-surface-900'}`}>
                                    {fy.label}
                                </span>
                                <span className="text-xs font-semibold text-surface-500 mt-1">
                                    {rangeText}
                                </span>
                                <div className="mt-4 pt-3 border-t border-dashed border-surface-200 w-full flex items-center justify-between">
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-surface-400">Total Premium</span>
                                    <span className={`text-sm font-extrabold ${isSelected ? 'text-primary-700' : 'text-surface-900'}`}>
                                        {formatShortCurrency(fy.totalPremium)}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* YoY Growth analysis banner */}
            {prevFy && selectedFy && (
                <div className="bg-primary-900/5 border border-primary-500/20 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h4 className="text-sm font-bold text-primary-950 flex items-center gap-1.5">
                            <HiOutlineTrendingUp className="w-5 h-5 text-primary-600" />
                            Year-on-Year (YoY) Growth Analysis
                        </h4>
                        <p className="text-xs text-surface-600 mt-1">
                            Comparing performance of <strong className="text-primary-900">{selectedFy?.label}</strong> against <strong className="text-surface-700">{prevFy.label}</strong>
                        </p>
                    </div>
                    <div className="flex gap-6">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Premium Growth</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-base font-extrabold ${premiumGrowthPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {premiumGrowthPct >= 0 ? `+${premiumGrowthPct}%` : `${premiumGrowthPct}%`}
                                </span>
                                <span className="text-xs text-surface-400">({premiumGrowthPct >= 0 ? 'Up' : 'Down'})</span>
                            </div>
                        </div>
                        <div className="w-px bg-surface-200 self-stretch" />
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Policies Growth</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-base font-extrabold ${policyGrowthPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {policyGrowthPct >= 0 ? `+${policyGrowthPct}%` : `${policyGrowthPct}%`}
                                </span>
                                <span className="text-xs text-surface-400">({policyGrowthPct >= 0 ? 'Up' : 'Down'})</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {analyticsLoading && (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full" />
                </div>
            )}

            {!analyticsLoading && dash && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* KPI Cards Row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
                                    <p className="stat-value text-xl" title={formatCurrency(dash.thisMonth?.totalPremium || 0)}>
                                        {formatShortCurrency(dash.thisMonth?.totalPremium || 0)}
                                    </p>
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

                    {/* Financial Premium Breakdown Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card card-body flex flex-col justify-between p-5">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-surface-400">Total Premium (Gross)</span>
                                <p className="text-3xl font-black text-surface-900 mt-1">{formatCurrency(dash.thisMonth?.totalPremium || 0)}</p>
                            </div>
                            <p className="text-[11px] text-surface-500 mt-4">Total amount collected from customers (including GST/taxes).</p>
                        </div>
                        <div className="card card-body flex flex-col justify-between p-5">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-surface-400">Net Premium (Revenue)</span>
                                <p className="text-3xl font-black text-primary-600 mt-1">{formatCurrency(dash.thisMonth?.netPremium || 0)}</p>
                            </div>
                            <p className="text-[11px] text-surface-500 mt-4">Actual revenue earned by insurers before government taxes.</p>
                        </div>
                        <div className="card card-body flex flex-col justify-between p-5">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-surface-400">GST / Tax Collected</span>
                                <p className="text-3xl font-black text-amber-600 mt-1">{formatCurrency(dash.thisMonth?.tax || 0)}</p>
                            </div>
                            <p className="text-[11px] text-surface-500 mt-4">Total service taxes collected and paid to the government.</p>
                        </div>
                    </div>

                    {/* Claims Performance Breakdown Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card card-body flex flex-col justify-between p-5">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-surface-400">Total Claims Filed</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <p className="text-3xl font-black text-surface-900">{dash.claimsSummary?.totalCount || 0}</p>
                                    <span className="text-xs font-semibold text-surface-500">Claims</span>
                                </div>
                            </div>
                            <p className="text-[11px] text-surface-500 mt-4">
                                {dash.claimsSummary?.totalAmount ? `Total claimed value: ${formatCurrency(dash.claimsSummary.totalAmount)}` : 'Total claims registered in this financial year.'}
                            </p>
                        </div>
                        <div className="card card-body flex flex-col justify-between p-5">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-surface-400">Total Settled Amount</span>
                                <p className="text-3xl font-black text-emerald-600 mt-1">
                                    {formatCurrency(dash.claimsSummary?.settledAmount || 0)}
                                </p>
                            </div>
                            <p className="text-[11px] text-surface-500 mt-4">
                                {dash.claimsSummary?.settledCount || 0} claim{(dash.claimsSummary?.settledCount || 0) === 1 ? '' : 's'} successfully approved and disbursed by insurers.
                            </p>
                        </div>
                        <div className="card card-body flex flex-col justify-between p-5">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-surface-400">Claims Settlement Ratio</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <p className="text-3xl font-black text-blue-600">{dash.claimsSummary?.settlementRate || 0}%</p>
                                    <span className="text-xs font-semibold text-surface-500">
                                        ({dash.claimsSummary?.openCount || 0} Open / Pending)
                                    </span>
                                </div>
                            </div>
                            <p className="text-[11px] text-surface-500 mt-4">
                                Percentage of registered claims successfully settled for customers.
                            </p>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Company Performance */}
                        <div className="card card-body">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold text-surface-900">Company-wise Performance ({periodLabel})</h3>
                                <span className="badge-info">{companyData.length} companies</span>
                            </div>
                            <BarChartRow data={companyData} nameKey="name" valueKey="totalPremiumSum" label="Premium (₹)" limit={8} />
                            {!companyData?.length && (
                                <p className="text-xs text-surface-400 text-center py-6">No company data available</p>
                            )}
                        </div>

                        {/* Policy Type Breakdown */}
                        <div className="card card-body">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold text-surface-900">Policy Type Breakdown ({periodLabel})</h3>
                                <span className="badge-info">{policyTypeData.length} types</span>
                            </div>
                            <PolicyPieChart data={policyTypeData} nameKey="name" valueKey="count" />
                            {!policyTypeData?.length && (
                                <p className="text-xs text-surface-400 text-center py-6">No policy data available</p>
                            )}
                        </div>

                        {/* Dealer Performance */}
                        <div className="card card-body">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold text-surface-900">Dealer Performance ({periodLabel})</h3>
                                <span className="badge-info">{dealerData.length} dealers</span>
                            </div>
                            <BarChartRow data={dealerData} nameKey="name" valueKey="totalPremiumSum" label="Premium (₹)" limit={8} />
                            {!dealerData?.length && (
                                <p className="text-xs text-surface-400 text-center py-6">No dealer data available</p>
                            )}
                        </div>

                        {/* Vehicle Class Performance */}
                        <div className="card card-body">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold text-surface-900">Vehicle Class Performance ({periodLabel})</h3>
                                <span className="badge-info">{vehicleClassData.length} classes</span>
                            </div>
                            <BarChartRow data={vehicleClassData} nameKey="name" valueKey="totalPremiumSum" label="Premium (₹)" />
                            {!vehicleClassData?.length && (
                                <p className="text-xs text-surface-400 text-center py-6">No vehicle class data available</p>
                            )}
                        </div>

                        {/* Monthly Trend */}
                        <div className="card card-body">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold text-surface-900">Monthly Premium Trend ({periodLabel})</h3>
                                <span className="badge-info">Financial Year Months</span>
                            </div>
                            <BarChartRow data={monthlyData} nameKey="name" valueKey="totalPremiumSum" label="Premium (₹)" />
                            {!monthlyData?.length && (
                                <p className="text-xs text-surface-400 text-center py-6">No monthly data available</p>
                            )}
                        </div>

                        {/* Claims Trend */}
                        <div className="card card-body">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-sm font-bold text-surface-900">Month-wise Claims & Settlements ({periodLabel})</h3>
                                <span className="badge-info">{claimsTrendData.length} months</span>
                            </div>
                            <div className="space-y-4">
                                {claimsTrendData.map((item: any, i: number) => {
                                    const maxVal = Math.max(...claimsTrendData.map((d: any) => Math.max(d.billSum || 0, d.claimSum || 0)), 1);
                                    const billPct = (item.billSum / maxVal) * 100;
                                    const claimPct = (item.claimSum / maxVal) * 100;

                                    return (
                                        <div key={i} className="group">
                                            <div className="flex items-center justify-between text-xs mb-1.5">
                                                <span className="text-surface-700 font-bold capitalize">
                                                    {item.name}
                                                </span>
                                                <span className="text-surface-400 font-medium">
                                                    {item.count} {item.count === 1 ? 'Claim' : 'Claims'}
                                                </span>
                                            </div>

                                            <div className="space-y-1.5">
                                                {/* Bill Amount (Claimed) */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-surface-400 w-12 uppercase">Claimed:</span>
                                                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden flex-1">
                                                        <div
                                                            className="h-full rounded-full bg-amber-500 transition-all duration-700 ease-out"
                                                            style={{ width: `${Math.max(billPct, 1)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-surface-600 w-16 text-right">
                                                        {formatShortCurrency(item.billSum)}
                                                    </span>
                                                </div>

                                                {/* Settled Amount */}
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-emerald-500 w-12 uppercase">Settled:</span>
                                                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden flex-1">
                                                        <div
                                                            className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
                                                            style={{ width: `${Math.max(claimPct, 1)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-emerald-600 w-16 text-right">
                                                        {formatShortCurrency(item.claimSum)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {!claimsTrendData?.length && (
                                    <p className="text-xs text-surface-400 text-center py-6">No claims registered in this financial year</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Payment Summary */}
                    {paymentData?.length > 0 && (
                        <div className="card card-body">
                            <h3 className="text-sm font-bold text-surface-900 mb-4">Payment Collection Summary ({periodLabel})</h3>
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
            )}
        </div>
    );
};

export default FinancialYearTab;
