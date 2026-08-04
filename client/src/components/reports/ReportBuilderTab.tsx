import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    HiOutlineTable,
    HiOutlineFilter,
    HiOutlineRefresh,
    HiOutlineAdjustments,
    HiOutlineDocumentDownload,
    HiOutlineUser,
    HiOutlineDatabase,
    HiOutlineTag,
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import api from '../../api/client';
import SearchableSelect from '../ui/SearchableSelect';
import Pagination from '../ui/Pagination';
import TableSkeleton from '../ui/TableSkeleton';
import EmptyState from '../ui/EmptyState';
import ReportTable from './ReportTable';
import { formatVehicleClass } from '../../utils/format';
import { BarChartRow, PolicyPieChart, CompanyBarChart } from './ReportCharts';
import {
    POLICY_TYPES, VEHICLE_CLASSES, POLICY_STATUSES,
    PAYMENT_STATUSES, CLAIM_STATUSES, FOLLOWUP_STATUSES
} from '../../utils/constants';

type Source = 'policies' | 'policies-expired' | 'payments' | 'claims' | 'customers' | 'followups' | 'customer-snapshot' | 'offers';
type GroupBy = 'company' | 'dealer' | 'policyType' | 'vehicleClass' | 'status' | 'month' | 'policyOrigin' | '';

interface Column { key: string; label: string }
interface ReportFilters {
    companyId?: string;
    companyIds?: string[] | string;
    dealerId?: string;
    customerId?: string;
    policyType?: string;
    vehicleClass?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    policyOrigin?: string;
}

const SOURCE_OPTIONS: { value: Source; label: string; icon: React.ElementType }[] = [
    { value: 'policies', label: 'Policies', icon: HiOutlineTable },
    { value: 'policies-expired', label: 'Policy Expire Register', icon: HiOutlineTable },
    { value: 'payments', label: 'Payments', icon: HiOutlineRefresh },
    { value: 'claims', label: 'Claims', icon: HiOutlineDocumentDownload },
    { value: 'customers', label: 'Customers', icon: HiOutlineTable },
    { value: 'followups', label: 'Follow-ups', icon: HiOutlineRefresh },
    // { value: 'offers', label: 'Offers & Discounts', icon: HiOutlineTag },
    { value: 'customer-snapshot', label: 'Customer Statement', icon: HiOutlineUser },
];

function getStatusOptions(source: Source): string[] {
    switch (source) {
        case 'policies':
        case 'policies-expired': return POLICY_STATUSES;
        case 'payments': return PAYMENT_STATUSES;
        case 'claims': return CLAIM_STATUSES;
        case 'followups': return FOLLOWUP_STATUSES;
        default: return [];
    }
}

function getGroupOptions(source: Source): { value: GroupBy; label: string }[] {
    switch (source) {
        case 'policies':
        case 'policies-expired': return [
            { value: 'company', label: 'By Company' },
            { value: 'dealer', label: 'By Dealer' },
            { value: 'policyType', label: 'By Policy Type' },
            { value: 'vehicleClass', label: 'By Vehicle Class' },
            { value: 'status', label: 'By Status' },
            { value: 'policyOrigin', label: 'By Policy Origin' },
            { value: 'month', label: 'By Month' },
        ];
        case 'payments': return [
            { value: 'status', label: 'Status' },
            { value: 'month', label: 'Month' },
        ];
        case 'offers': return [
            { value: 'company', label: 'By Company' },
            { value: 'month', label: 'By Month' },
        ];
        default: return [];
    }
}

const ReportBuilderTab: React.FC = () => {
    const [localFilters, setLocalFilters] = useState<ReportFilters>({});
    const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({});
    const [localGroupBy, setLocalGroupBy] = useState<GroupBy>('');
    const [appliedGroupBy, setAppliedGroupBy] = useState<GroupBy>('');
    const [source, setSource] = useState<Source>('policies');
    const [subTab, setSubTab] = useState<'policies' | 'claims' | 'expiring'>('policies');
    const [page, setPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
    const [showColumns, setShowColumns] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const limit = 10;

    // --- Fetch companies & dealers for dropdown ---
    const { data: companiesData } = useQuery({
        queryKey: ['companies'],
        queryFn: () => api.get('/companies').then(r => r.data),
    });
    const { data: dealersData } = useQuery({
        queryKey: ['dealers'],
        queryFn: () => api.get('/dealers?limit=10000').then(r => r.data),
    });
    const { data: customersData } = useQuery({
        queryKey: ['customers'],
        queryFn: () => api.get('/customers?limit=10000').then(r => r.data),
    });
    const companies = companiesData?.data || [];
    const dealers = dealersData?.data || [];
    const customers = customersData?.data || [];

    // --- Report builder data ---
    const { data: reportData, isLoading: reportLoading, isError, error } = useQuery({
        queryKey: ['report-generate', source, appliedGroupBy, appliedFilters, page],
        queryFn: () => api.post('/reports/generate', {
            source,
            filters: Object.fromEntries(Object.entries(appliedFilters).filter(([_, v]) => v)),
            groupBy: appliedGroupBy || undefined,
            page,
            limit,
        }).then(r => r.data),
        enabled: source !== 'customer-snapshot' || !!appliedFilters.customerId,
    });
    const report = reportData?.data;

    const updateLocalFilter = useCallback((key: keyof ReportFilters, value: string) => {
        setLocalFilters(prev => ({ ...prev, [key]: value || undefined }));
        setIsDirty(true);
    }, []);

    const generateReport = useCallback(() => {
        if (source === 'customer-snapshot') {
            if (!localFilters.customerId) {
                toast.error('Please select a Customer for the statement.');
                return;
            }
            if (!localFilters.dateFrom || !localFilters.dateTo) {
                toast.error('Please select both Date From and Date To.');
                return;
            }
        }
        setAppliedFilters(localFilters);
        setAppliedGroupBy(localGroupBy);
        setPage(1);
        setIsDirty(false);
    }, [localFilters, localGroupBy, source]);

    const clearFilters = useCallback(() => {
        setLocalFilters({});
        setAppliedFilters({});
        setLocalGroupBy('');
        setAppliedGroupBy('');
        setPage(1);
        setHiddenColumns([]);
        setIsDirty(false);
    }, []);

    const handleExport = useCallback(async (format: 'xlsx' | 'pdf', cols: Column[]) => {
        try {
            toast.loading(`Generating ${format.toUpperCase()}...`, { id: 'export' });

            let exportSource: string = source;
            let exportCols = cols;
            let exportTitle = source === 'policies-expired'
                ? 'Policy Expire Register'
                : `${source.charAt(0).toUpperCase() + source.slice(1)} Report`;

            if (source === 'customer-snapshot') {
                if (subTab === 'claims') {
                    exportSource = 'customer-snapshot-claims';
                    exportCols = [
                        { key: 'claimNumber', label: 'Claim No' },
                        { key: 'policyNumber', label: 'Policy No' },
                        { key: 'vehicleNumber', label: 'Vehicle No' },
                        { key: 'claimDate', label: 'Claim Date' },
                        { key: 'billAmount', label: 'Bill Amount (₹)' },
                        { key: 'claimAmount', label: 'Claim Settled Amount (₹)' },
                        { key: 'status', label: 'Status' },
                    ];
                    exportTitle = `${report?.summary?.customerName || 'Customer'} - Claims Statement`;
                } else if (subTab === 'expiring') {
                    exportSource = 'customer-snapshot-expiring';
                    exportCols = [
                        { key: 'policyNumber', label: 'Policy No' },
                        { key: 'companyName', label: 'Insurer' },
                        { key: 'vehicleClass', label: 'Vehicle Class' },
                        { key: 'vehicleNo', label: 'Vehicle No' },
                        { key: 'expiryDate', label: 'Expiry Date' },
                        { key: 'daysRemaining', label: 'Days Left' },
                    ];
                    exportTitle = `${report?.summary?.customerName || 'Customer'} - Expiring Policies`;
                } else {
                    exportTitle = `${report?.summary?.customerName || 'Customer'} - Insurance Statement`;
                }
            }

            const activePolicyType = (appliedFilters.policyType || '').toLowerCase();

            if (format === 'pdf' && source === 'policies') {
                if (activePolicyType === 'health' || activePolicyType === 'life') {
                    exportCols = [
                        { key: 'startDate', label: 'Start Date' },
                        { key: 'customerName', label: 'Customer' },
                        { key: 'policyNumber', label: 'Policy No.' },
                        { key: 'productName', label: 'Product Name' },
                        { key: 'sumInsured', label: 'Sum Insured' },
                        { key: 'companyName', label: 'Company' },
                        { key: 'customerPhone', label: 'Mobile No.' },
                        { key: 'totalPremium', label: 'Total Premium' },
                    ];
                } else {
                    exportCols = [
                        { key: 'startDate', label: 'Start Date' },
                        { key: 'customerName', label: 'Customer' },
                        { key: 'policyNumber', label: 'Policy No.' },
                        { key: 'make', label: 'Make' },
                        { key: 'model', label: 'Model' },
                        { key: 'vehicleNumber', label: 'Vehicle No.' },
                        { key: 'vehicleClass', label: 'Vehicle Class' },
                        { key: 'companyName', label: 'Company' },
                        { key: 'customerPhone', label: 'Mobile No.' },
                        { key: 'totalPremium', label: 'Total Premium' },
                    ];
                }
            }

            if (format === 'pdf' && source === 'policies-expired') {
                if (activePolicyType === 'health' || activePolicyType === 'life') {
                    exportCols = [
                        { key: 'startDate', label: 'Start Date' },
                        { key: 'expiryDate', label: 'Expiry Date' },
                        { key: 'customerName', label: 'Customer' },
                        { key: 'policyNumber', label: 'Policy No.' },
                        { key: 'productName', label: 'Product Name' },
                        { key: 'sumInsured', label: 'Sum Insured' },
                        { key: 'companyName', label: 'Company' },
                        { key: 'customerPhone', label: 'Mobile No.' },
                        { key: 'totalPremium', label: 'Total Premium' },
                    ];
                } else {
                    exportCols = [
                        { key: 'startDate', label: 'Start Date' },
                        { key: 'expiryDate', label: 'Expiry Date' },
                        { key: 'customerName', label: 'Customer' },
                        { key: 'policyNumber', label: 'Policy No.' },
                        { key: 'make', label: 'Make' },
                        { key: 'model', label: 'Model' },
                        { key: 'vehicleNumber', label: 'Vehicle No.' },
                        { key: 'vehicleClass', label: 'Vehicle Class' },
                        { key: 'companyName', label: 'Company' },
                        { key: 'ncbPercentage', label: 'NCB' },
                        { key: 'customerPhone', label: 'Mobile No.' },
                        { key: 'totalPremium', label: 'Total Premium' },
                    ];
                }
            }

            if (format === 'pdf' && source === 'payments') {
                if (activePolicyType === 'health' || activePolicyType === 'life') {
                    exportCols = [
                        { key: 'startDate', label: 'Start Date' },
                        { key: 'customerName', label: 'Customer' },
                        { key: 'policyNumber', label: 'Policy No.' },
                        { key: 'productName', label: 'Product Name' },
                        { key: 'paidAmount', label: 'Paid (₹)' },
                        { key: 'pendingAmount', label: 'Pending (₹)' },
                        { key: 'amount', label: 'Premium (₹)' },
                        { key: 'dealerName', label: 'Dealer' },
                        { key: 'companyName', label: 'Company' },
                        { key: 'status', label: 'Status' },
                    ];
                } else {
                    exportCols = [
                        { key: 'startDate', label: 'Start Date' },
                        { key: 'customerName', label: 'Customer' },
                        { key: 'policyNumber', label: 'Policy No.' },
                        { key: 'vehicleNumber', label: 'Vehicle No.' },
                        { key: 'vehicleClass', label: 'Vehicle Class' },
                        { key: 'paidAmount', label: 'Paid (₹)' },
                        { key: 'pendingAmount', label: 'Pending (₹)' },
                        { key: 'amount', label: 'Premium (₹)' },
                        { key: 'dealerName', label: 'Dealer' },
                        { key: 'companyName', label: 'Company' },
                        { key: 'status', label: 'Status' },
                    ];
                }
            }

            const res = await api.post('/reports/export', {
                source: exportSource,
                filters: Object.fromEntries(Object.entries(appliedFilters).filter(([_, v]) => v)),
                groupBy: appliedGroupBy || undefined,
                format,
                columns: exportCols.map(c => c.key),
                title: exportTitle,
            }, { responseType: 'blob' });

            const blob = new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report_${exportSource}_${new Date().toISOString().split('T')[0]}.${format}`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(`${format.toUpperCase()} downloaded!`, { id: 'export' });
        } catch {
            toast.error('Export failed', { id: 'export' });
        }
    }, [source, appliedFilters, appliedGroupBy, subTab, report]);

    const handleFullExport = useCallback(async (format: 'xlsx' | 'pdf') => {
        try {
            toast.loading(`Compiling Full ${format.toUpperCase()} Portfolio Statement...`, { id: 'full-export' });

            const fileTitle = `${report?.summary?.customerName || 'Customer'}_Portfolio_Statement`;
            const res = await api.post('/reports/export', {
                source: 'customer-snapshot-full',
                filters: Object.fromEntries(Object.entries(appliedFilters).filter(([_, v]) => v)),
                format,
                title: fileTitle.replace(/_/g, ' '),
            }, { responseType: 'blob' });

            const blob = new Blob([res.data]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileTitle}_${new Date().toISOString().split('T')[0]}.${format}`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success(`Full Portfolio ${format.toUpperCase()} downloaded successfully!`, { id: 'full-export' });
        } catch {
            toast.error('Failed to compile full statement export', { id: 'full-export' });
        }
    }, [appliedFilters, report]);

    const statuses = getStatusOptions(source);
    const groupOptions = getGroupOptions(source);
    const showCompanyFilter = ['policies', 'policies-expired', 'payments', 'claims', 'followups', 'customer-snapshot'].includes(source);
    const showDealerFilter = ['policies', 'policies-expired', 'payments'].includes(source);
    const showCustomerFilter = ['policies', 'policies-expired', 'payments', 'claims', 'followups', 'leads', 'customer-snapshot'].includes(source);
    const showPolicyTypeFilter = ['policies', 'policies-expired', 'payments', 'claims', 'followups', 'customer-snapshot'].includes(source);
    const showVehicleClassFilter = ['policies', 'policies-expired', 'payments', 'claims', 'customer-snapshot'].includes(source);
    const isSnapshot = source === 'customer-snapshot';
    const hasAdvancedFilters = showCompanyFilter || showCustomerFilter || showDealerFilter || showPolicyTypeFilter || showVehicleClassFilter;

    return (
        <div className="space-y-6">
            {/* Source selector pills */}
            <div className="card card-body">
                <h2 className="text-sm font-bold text-surface-900 mb-3 flex items-center gap-2">
                    <HiOutlineDatabase className="w-4 h-4 text-primary-500" />
                    Data Source
                </h2>
                <div className="flex flex-wrap gap-2">
                    {SOURCE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => {
                                setSource(opt.value);
                                setSubTab('policies');
                                setLocalGroupBy('');
                                setAppliedGroupBy('');
                                setLocalFilters({});
                                setAppliedFilters({});
                                setPage(1);
                                setHiddenColumns([]);
                                setShowColumns(false);
                                setShowAdvancedFilters(false);
                                setIsDirty(false);
                            }}
                            className={`
                                btn flex items-center gap-1.5 py-2 px-4 rounded-xl text-sm font-medium transition-all duration-200
                                ${source === opt.value
                                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                                    : 'bg-surface-50 text-surface-600 hover:bg-surface-100 hover:text-surface-900 border border-surface-100'
                                }
                            `}
                        >
                            <opt.icon className="w-4 h-4" />
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filters + Group By */}
            <div className="card card-body">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <HiOutlineFilter className="w-4 h-4 text-surface-500" />
                        <span className="text-sm font-bold text-surface-900">Filters & Grouping</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="btn-secondary btn-sm lg:hidden"
                        >
                            {showFilters ? 'Hide Filters' : 'Show Filters'}
                        </button>
                        {hasAdvancedFilters && (
                            <button
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                className={`btn-secondary btn-sm flex items-center gap-1.5 ${showAdvancedFilters ? 'bg-surface-200' : ''} ${!showFilters ? 'hidden lg:flex' : ''}`}
                            >
                                <HiOutlineAdjustments className="w-3.5 h-3.5" />
                                {showAdvancedFilters ? 'Less Filters' : 'More Filters'}
                            </button>
                        )}
                        <button onClick={clearFilters} className="btn-ghost btn-sm text-red-500">
                            Clear All
                        </button>
                    </div>
                </div>

                <div className={`space-y-4 ${!showFilters ? 'hidden lg:block' : ''}`}>
                    {/* Primary Filters Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Group By */}
                        {groupOptions.length > 0 && !isSnapshot && (
                            <div>
                                <label className="label">Group By</label>
                                <SearchableSelect
                                    options={groupOptions.map(opt => ({ value: opt.value, label: opt.label }))}
                                    value={localGroupBy}
                                    onChange={val => { setLocalGroupBy(val as GroupBy); setIsDirty(true); }}
                                    allLabel="No Grouping"
                                    placeholder="Select grouping..."
                                />
                            </div>
                        )}

                        {/* Status */}
                        {statuses.length > 0 && (
                            <div>
                                <label className="label">Status</label>
                                <SearchableSelect
                                    options={statuses.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                                    value={localFilters.status || ''}
                                    onChange={val => updateLocalFilter('status', val)}
                                    allLabel="All Statuses"
                                    placeholder="Select status..."
                                />
                            </div>
                        )}

                        {/* Date From */}
                        <div>
                            <label className="label">Date From</label>
                            <input
                                type="date"
                                className="input"
                                value={localFilters.dateFrom || ''}
                                onChange={e => updateLocalFilter('dateFrom', e.target.value)}
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="label">Date To</label>
                            <input
                                type="date"
                                className="input"
                                value={localFilters.dateTo || ''}
                                onChange={e => updateLocalFilter('dateTo', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Advanced/Secondary Filters Row */}
                    {hasAdvancedFilters && (
                        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-surface-200 ${!showAdvancedFilters ? 'hidden' : ''}`}>
                            {/* Company */}
                            {showCompanyFilter && (
                                <div>
                                    <label className="label">Insurers</label>
                                    <SearchableSelect
                                        options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
                                        value={localFilters.companyIds || []}
                                        onChange={val => updateLocalFilter('companyIds', val)}
                                        multiple={true}
                                        placeholder="Select Insurers"
                                    />
                                </div>
                            )}

                            {/* Customer */}
                            {showCustomerFilter && (
                                <div>
                                    <label className="label">Customer</label>
                                    <SearchableSelect
                                        options={customers.map((c: any) => ({ value: c.id, label: c.name }))}
                                        value={localFilters.customerId || ''}
                                        onChange={val => updateLocalFilter('customerId', val)}
                                        allLabel="All Customers"
                                        placeholder="Search customer..."
                                    />
                                </div>
                            )}

                            {/* Dealer */}
                            {showDealerFilter && (
                                <div>
                                    <label className="label">Dealer</label>
                                    <SearchableSelect
                                        options={[
                                            { value: 'direct', label: '⭐ Direct' },
                                            ...dealers.map((d: any) => ({ value: d.id, label: d.name }))
                                        ]}
                                        value={localFilters.dealerId || ''}
                                        onChange={val => updateLocalFilter('dealerId', val)}
                                        allLabel="All Dealers"
                                        placeholder="Search dealer..."
                                    />
                                </div>
                            )}

                            {/* Policy Type */}
                            {showPolicyTypeFilter && (
                                <div>
                                    <label className="label">Policy Type</label>
                                    <SearchableSelect
                                        options={POLICY_TYPES.map(t => ({ value: t, label: t === 'non_motor' ? 'Non Motor' : t.charAt(0).toUpperCase() + t.slice(1) }))}
                                        value={localFilters.policyType || ''}
                                        onChange={val => {
                                            updateLocalFilter('policyType', val);
                                            // Auto-clear vehicle class if switching away from motor and non_motor
                                            if (val !== 'motor' && val !== 'non_motor') {
                                                updateLocalFilter('vehicleClass', '');
                                            }
                                            if (val !== 'motor') {
                                                updateLocalFilter('policyOrigin', '');
                                            }
                                        }}
                                        allLabel="All Types"
                                        placeholder="Select policy type..."
                                    />
                                </div>
                            )}

                            {/* Origin */}
                            {source === 'policies' && (
                                <div>
                                    <label className="label">Origin</label>
                                    <SearchableSelect
                                        disabled={!!(localFilters.policyType && localFilters.policyType !== 'motor')}
                                        options={[
                                            { value: 'new_vehicle', label: 'New Vehicle' },
                                            { value: 'fresh', label: 'Fresh' },
                                            { value: 'external_renewal', label: 'External Renewal' },
                                            { value: 'in_system_renewal', label: 'Own Renewal' },
                                        ]}
                                        value={localFilters.policyOrigin || ''}
                                        onChange={val => updateLocalFilter('policyOrigin', val)}
                                        allLabel="All Origins"
                                        placeholder={localFilters.policyType && localFilters.policyType !== 'motor' ? "N/A (Motor Only)" : "Select origin..."}
                                    />
                                </div>
                            )}

                            {/* Vehicle Class */}
                            {showVehicleClassFilter && (
                                <div>
                                    <label className="label">Vehicle Class</label>
                                    <SearchableSelect
                                        disabled={!!(localFilters.policyType && localFilters.policyType !== 'motor' && localFilters.policyType !== 'non_motor')}
                                        options={VEHICLE_CLASSES.map(t => ({ value: t, label: formatVehicleClass(t) }))}
                                        value={localFilters.vehicleClass || ''}
                                        onChange={val => updateLocalFilter('vehicleClass', val)}
                                        allLabel="All Classes"
                                        placeholder={localFilters.policyType && localFilters.policyType !== 'motor' && localFilters.policyType !== 'non_motor' ? "N/A" : "Select vehicle class..."}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Action Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4">
                <button
                    onClick={generateReport}
                    className={`btn-primary w-full sm:w-auto ${isDirty ? 'ring-2 ring-offset-2 ring-primary-400' : ''}`}
                    disabled={reportLoading}
                >
                    <HiOutlineRefresh className={`w-4 h-4 ${reportLoading ? 'animate-spin' : ''}`} />
                    {isDirty ? 'Apply & Generate' : 'Generate Report'}
                </button>
                <div className={`grid ${isSnapshot ? 'grid-cols-2 md:flex md:items-center' : 'grid-cols-3'} gap-2 w-full sm:w-auto`}>
                    {report && !report.grouped && (
                        <button
                            onClick={() => setShowColumns(!showColumns)}
                            className="btn-secondary w-full md:w-auto"
                        >
                            <HiOutlineAdjustments className="w-4 h-4" />
                            <span className="hidden xs:inline sm:hidden md:inline">Cols</span>
                        </button>
                    )}
                    <button
                        onClick={() => handleExport('xlsx', report?.columns?.filter((c: Column) => report.grouped ? true : !hiddenColumns.includes(c.key)) || [])}
                        className="btn-secondary w-full md:w-auto"
                        disabled={!report || reportLoading}
                    >
                        <HiOutlineDocumentDownload className="w-4 h-4" />
                        <span>Export Tab (Excel)</span>
                    </button>
                    <button
                        onClick={() => handleExport('pdf', report?.columns?.filter((c: Column) => report.grouped ? true : !hiddenColumns.includes(c.key)) || [])}
                        className="btn-secondary w-full md:w-auto"
                        disabled={!report || reportLoading}
                    >
                        <HiOutlineDocumentDownload className="w-4 h-4" />
                        <span>Export Tab (PDF)</span>
                    </button>
                    {isSnapshot && (
                        <>
                            <button
                                onClick={() => handleFullExport('xlsx')}
                                className="btn bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-primary-500/20 transition-all w-full md:w-auto justify-center"
                                disabled={!report || reportLoading}
                            >
                                <HiOutlineDocumentDownload className="w-4 h-4" />
                                <span>Full Workbook (Excel)</span>
                            </button>
                            {/* Hidden for testing per user request:
                            <button
                                onClick={() => handleFullExport('pdf')}
                                className="btn bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-500/20 transition-all w-full md:w-auto justify-center"
                                disabled={!report || reportLoading}
                            >
                                <HiOutlineDocumentDownload className="w-4 h-4" />
                                <span>Full Report (PDF)</span>
                            </button>
                            */}
                        </>
                    )}
                </div>
            </div>

            {/* Column Selector Dropdown */}
            {showColumns && report && !report.grouped && (
                <div className="card card-body mt-2">
                    <p className="text-sm font-bold text-surface-900 mb-3">Visible Columns</p>
                    <div className="flex flex-wrap gap-3">
                        {report.columns.map((col: Column) => {
                            const isHidden = hiddenColumns.includes(col.key);
                            return (
                                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 text-primary-600 rounded border-surface-300 focus:ring-primary-500"
                                        checked={!isHidden}
                                        onChange={() => {
                                            setHiddenColumns(prev =>
                                                isHidden ? prev.filter(k => k !== col.key) : [...prev, col.key]
                                            );
                                        }}
                                    />
                                    <span className="text-surface-700">{col.label}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Results */}
            {isError ? (
                <div className="card card-body py-16 mt-4 border-dashed border-2 border-surface-200">
                    <EmptyState
                        message="We encountered an issue while generating this report."
                        icon={<HiOutlineFilter className="w-16 h-16 text-surface-300" />}
                    />
                    <div className="flex justify-center mt-2">
                        <button onClick={clearFilters} className="btn-ghost text-primary-600 font-semibold">
                            Reset filters and try again
                        </button>
                    </div>
                </div>
            ) : reportLoading ? (
                <TableSkeleton cols={6} rows={10} />
            ) : report ? (
                report.total === 0 ? (
                    <div className="card card-body py-20 mt-4 border-dashed border-2 border-surface-200">
                        <EmptyState
                            message="No results match your current filters"
                            icon={<HiOutlineFilter className="w-16 h-16 text-surface-300" />}
                        />
                        <div className="flex justify-center mt-2">
                            <button onClick={clearFilters} className="btn-ghost text-primary-600 font-semibold">
                                Clear all filters
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary info */}
                        <div className="flex items-center justify-between mt-4">
                            <p className="text-xs text-surface-500 font-medium">
                                {report.grouped
                                    ? `Grouped by ${report.groupLabel} • ${report.total} groups`
                                    : `${report.total} records found`}
                            </p>
                        </div>

                        {/* Dynamic Charts Section */}
                        {isSnapshot && report.summary ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="card p-4 bg-primary-50 border border-primary-100">
                                        <p className="text-xs text-primary-600 font-bold uppercase">Total Policies</p>
                                        <p className="text-2xl font-bold text-primary-900">{report.summary.totalPolicies}</p>
                                    </div>
                                    <div className="card p-4 bg-emerald-50 border border-emerald-100">
                                        <p className="text-xs text-emerald-600 font-bold uppercase">Total Premium Paid</p>
                                        <p className="text-2xl font-bold text-emerald-900">₹{report.summary.totalPremium.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="card p-4 bg-rose-50 border border-rose-100">
                                        <p className="text-xs text-rose-600 font-bold uppercase">Total Claims Made</p>
                                        <p className="text-2xl font-bold text-rose-900">{report.summary.totalClaims}</p>
                                    </div>
                                    <div className="card p-4 bg-orange-50 border border-orange-100">
                                        <p className="text-xs text-orange-600 font-bold uppercase">Total Bill Amount</p>
                                        <p className="text-2xl font-bold text-orange-900">₹{report.summary.totalClaimedAmount.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="card p-4 bg-purple-50 border border-purple-100">
                                        <p className="text-xs text-purple-600 font-bold uppercase">Total Claim Settled Amount</p>
                                        <p className="text-2xl font-bold text-purple-900">₹{report.summary.totalBillAmount.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="card card-body">
                                        <h3 className="text-sm font-bold text-surface-900 mb-4">Portfolio by Insurer</h3>
                                        <table className="table">
                                            <thead><tr><th>Insurer</th><th className="text-right">Policies</th><th className="text-right">Premium</th></tr></thead>
                                            <tbody>
                                                {report.summary.insurers.map((ins: any, i: number) => (
                                                    <tr key={i}>
                                                        <td className="font-medium text-surface-900">{ins.name}</td>
                                                        <td className="text-right">{ins.count}</td>
                                                        <td className="text-right font-medium text-emerald-600">₹{ins.premium.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="card card-body">
                                        <h3 className="text-sm font-bold text-surface-900 mb-4">Portfolio by Vehicle</h3>
                                        <table className="table">
                                            <thead><tr><th>Vehicle Type</th><th className="text-right">Policies</th><th className="text-right">Premium</th></tr></thead>
                                            <tbody>
                                                {report.summary.vehicles.map((veh: any, i: number) => (
                                                    <tr key={i}>
                                                        <td className="font-medium text-surface-900">{formatVehicleClass(veh.name)}</td>
                                                        <td className="text-right">{veh.count}</td>
                                                        <td className="text-right font-medium text-emerald-600">₹{veh.premium.toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ) : report.grouped ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="card card-body">
                                    <p className="text-sm font-bold text-surface-900 mb-4">Volume by {report.groupLabel}</p>
                                    <BarChartRow
                                        data={report.data}
                                        nameKey="name"
                                        valueKey={
                                            source === 'payments' ? 'amountSum' :
                                            source === 'claims' ? 'billSum' :
                                            'totalPremiumSum'
                                        }
                                        label={
                                            source === 'payments' ? 'Amount (₹)' :
                                            source === 'claims' ? 'Claim Amount (₹)' :
                                            'Premium (₹)'
                                        }
                                    />
                                </div>
                                <div className="card card-body">
                                    <p className="text-sm font-bold text-surface-900 mb-4">Distribution by {report.groupLabel}</p>
                                    <PolicyPieChart
                                        data={report.data}
                                        nameKey="name"
                                        valueKey="count"
                                    />
                                </div>
                            </div>
                        ) : (
                            report.chartsData && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {report.chartsData.policyType && report.chartsData.policyType.length > 0 && (
                                        <div className="card card-body">
                                            <p className="text-sm font-bold text-surface-900 mb-4">Breakdown by Policy Type</p>
                                            <PolicyPieChart
                                                data={report.chartsData.policyType}
                                                nameKey="name"
                                                valueKey="count"
                                            />
                                        </div>
                                    )}
                                    {report.chartsData.status && report.chartsData.status.length > 0 && (
                                        <div className="card card-body">
                                            <p className="text-sm font-bold text-surface-900 mb-1">
                                                {source === 'offers' ? 'Offers & Discounts by Insurer' : 'Analytics by Status'}
                                            </p>
                                            <CompanyBarChart
                                                data={report.chartsData.status}
                                                nameKey="name"
                                                valueKey={source === 'offers' ? 'offerSum' : source === 'payments' ? 'amountSum' : source === 'claims' ? 'claimSum' : source === 'followups' ? 'count' : 'totalPremiumSum'}
                                                label={source === 'offers' ? 'Discounts Given (₹)' : source === 'payments' ? 'Amount (₹)' : source === 'claims' ? 'Claim Amount (₹)' : source === 'followups' ? 'Follow-ups' : 'Premium (₹)'}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        )}

                        {/* Sub-Tab Navigation for Customer Statement */}
                        {isSnapshot && (
                            <div className="flex border-b border-surface-200 mt-6 mb-2">
                                <button
                                    onClick={() => setSubTab('policies')}
                                    className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${subTab === 'policies'
                                            ? 'border-primary-600 text-primary-600'
                                            : 'border-transparent text-surface-500 hover:text-surface-800'
                                        }`}
                                >
                                    📋 Policies Written ({report.total})
                                </button>
                                <button
                                    onClick={() => setSubTab('claims')}
                                    className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${subTab === 'claims'
                                            ? 'border-primary-600 text-primary-600'
                                            : 'border-transparent text-surface-500 hover:text-surface-800'
                                        }`}
                                >
                                    ⚠️ Claims Filed ({report.claims?.length || 0})
                                </button>
                                <button
                                    onClick={() => setSubTab('expiring')}
                                    className={`py-2.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${subTab === 'expiring'
                                            ? 'border-primary-600 text-primary-600'
                                            : 'border-transparent text-surface-500 hover:text-surface-800'
                                        }`}
                                >
                                    ⏳ Expiring Soon (60 Days) ({report.expiring?.length || 0})
                                </button>
                            </div>
                        )}

                        {isSnapshot ? (
                            subTab === 'claims' ? (
                                <ReportTable
                                    data={(report.claims || []).map((c: any) => ({
                                        ...c,
                                        vehicleNumber: c.policyType?.toLowerCase() === 'motor' ? c.vehicleNumber : c.productName
                                    }))}
                                    columns={[
                                        { key: 'claimNumber', label: 'Claim No' },
                                        { key: 'policyNumber', label: 'Policy No' },
                                        { key: 'vehicleNumber', label: 'Vehicle / Detail' },
                                        { key: 'claimDate', label: 'Claim Date' },
                                        { key: 'billAmount', label: 'Bill Amount (₹)' },
                                        { key: 'claimAmount', label: 'Claim Settled Amount (₹)' },
                                        { key: 'status', label: 'Status' },
                                    ]}
                                />
                            ) : subTab === 'expiring' ? (
                                <ReportTable
                                    data={(report.expiring || []).map((e: any) => ({
                                        ...e,
                                        vehicleNo: e.policyType?.toLowerCase() === 'motor' ? e.vehicleNo : e.productName,
                                        vehicleClass: e.policyType?.toLowerCase() === 'motor' ? e.vehicleClass : '—'
                                    }))}
                                    columns={[
                                        { key: 'policyNumber', label: 'Policy No' },
                                        { key: 'companyName', label: 'Insurer' },
                                        { key: 'vehicleClass', label: 'Vehicle Class' },
                                        { key: 'vehicleNo', label: 'Vehicle / Detail' },
                                        { key: 'expiryDate', label: 'Expiry Date' },
                                        { key: 'daysRemaining', label: 'Days Left' },
                                    ]}
                                />
                            ) : (
                                <ReportTable
                                    data={report.data}
                                    columns={(report.columns || []).filter((c: Column) => !hiddenColumns.includes(c.key))}
                                />
                            )
                        ) : (
                            <ReportTable
                                data={report.data}
                                columns={(report.columns || []).filter((c: Column) => !report.grouped ? !hiddenColumns.includes(c.key) : true)}
                            />
                        )}

                        {/* Pagination for flat data */}
                        {!report.grouped && source !== 'customer-snapshot' && report.totalPages > 1 && (
                            <Pagination
                                page={page}
                                totalPages={report.totalPages}
                                onPageChange={setPage}
                            />
                        )}
                    </div>
                )
            ) : null}
        </div>
    );
};

export default ReportBuilderTab;
