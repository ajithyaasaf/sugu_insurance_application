import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import TableSkeleton from '../components/ui/TableSkeleton';
import { formatDate, formatDateTime } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
    HiOutlineClock,
    HiOutlineSearch,
    HiOutlineFilter,
    HiOutlineRefresh,
    HiOutlineDocumentText,
    HiOutlineTrendingUp,
    HiOutlineUsers,
    HiOutlineCreditCard,
    HiOutlineShieldCheck,
    HiOutlinePhone,
    HiOutlineUserGroup,
    HiOutlineKey,
    HiOutlineDownload,
    HiOutlineEye,
    HiOutlineViewList,
    HiOutlineViewGrid,
    HiOutlineChartBar,
    HiOutlineChevronRight,
    HiOutlineCalendar,
} from 'react-icons/hi';

type ViewMode = 'timeline' | 'table' | 'analytics';

interface ActivityItem {
    id: string;
    userId: string;
    userRole: string;
    action: string;
    entityType: string;
    entityId?: string;
    title: string;
    description?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
}

const Activities: React.FC = () => {
    const { user } = useAuth();
    const isStaff = user?.role === 'staff';
    const navigate = useNavigate();

    // Data States
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });

    // Filter States
    const [search, setSearch] = useState('');
    const [entityTypeFilter, setEntityTypeFilter] = useState('all');
    const [actionFilter, setActionFilter] = useState('all');
    const [agentFilter, setAgentFilter] = useState('all');
    const [dateRangePreset, setDateRangePreset] = useState('all');
    const [specificDate, setSpecificDate] = useState('');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('timeline');

    // Selected Activity for Detail Modal
    const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

    // Calculate dates based on preset
    const getDateParams = useCallback(() => {
        if (dateRangePreset === 'specific') {
            return { startDate: specificDate || undefined, endDate: specificDate || undefined };
        }
        if (dateRangePreset === 'custom') {
            return { startDate: customStartDate || undefined, endDate: customEndDate || undefined };
        }
        const now = new Date();
        if (dateRangePreset === 'today') {
            const todayStr = now.toISOString().split('T')[0];
            return { startDate: todayStr, endDate: todayStr };
        }
        if (dateRangePreset === 'yesterday') {
            const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const yestStr = yest.toISOString().split('T')[0];
            return { startDate: yestStr, endDate: yestStr };
        }
        if (dateRangePreset === '7days') {
            const seven = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return { startDate: seven.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
        }
        if (dateRangePreset === 'month') {
            const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return { startDate: firstOfMonth.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
        }
        return {};
    }, [dateRangePreset, specificDate, customStartDate, customEndDate]);

    // Fetch Activities
    const fetchActivities = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const dateParams = getDateParams();
            const res = await api.get('/activities', {
                params: {
                    page,
                    limit: meta.limit,
                    search: search || undefined,
                    entityType: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
                    action: actionFilter !== 'all' ? actionFilter : undefined,
                    agentId: agentFilter !== 'all' ? agentFilter : undefined,
                    ...dateParams,
                },
            });
            setActivities(res.data.data);
            setMeta(res.data.meta);
        } catch {
            toast.error('Failed to fetch activity logs');
        } finally {
            setLoading(false);
        }
    }, [search, entityTypeFilter, actionFilter, agentFilter, getDateParams, meta.limit]);

    // Fetch Summary Metrics
    const fetchSummary = useCallback(async () => {
        try {
            const res = await api.get('/activities/summary');
            setSummary(res.data);
        } catch {
            // non-critical error
        }
    }, []);

    useEffect(() => {
        fetchActivities(1);
        fetchSummary();
    }, [fetchActivities, fetchSummary]);

    // Export CSV handler
    const handleExport = async () => {
        try {
            const dateParams = getDateParams();
            const res = await api.get('/activities/export', {
                params: {
                    search: search || undefined,
                    entityType: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
                    action: actionFilter !== 'all' ? actionFilter : undefined,
                    agentId: agentFilter !== 'all' ? agentFilter : undefined,
                    ...dateParams,
                },
            });

            const exportData = res.data.data || [];
            if (exportData.length === 0) {
                toast.error('No activity data to export');
                return;
            }

            // Generate CSV string
            const headers = Object.keys(exportData[0]).join(',');
            const csvRows = exportData.map((row: any) =>
                Object.values(row)
                    .map((val) => `"${String(val).replace(/"/g, '""')}"`)
                    .join(',')
            );
            const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...csvRows].join('\n');

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `agent_activity_log_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success('Activity log exported successfully!');
        } catch {
            toast.error('Failed to export activity logs');
        }
    };

    // Category styling & icons
    const getCategoryConfig = (type: string) => {
        switch (type.toLowerCase()) {
            case 'policy':
                return {
                    label: 'Policy',
                    badge: 'bg-blue-50 text-blue-700 border-blue-200',
                    icon: <HiOutlineDocumentText className="w-4 h-4 text-blue-600" />,
                    accent: 'bg-blue-500',
                };
            case 'lead':
                return {
                    label: 'Lead',
                    badge: 'bg-purple-50 text-purple-700 border-purple-200',
                    icon: <HiOutlineTrendingUp className="w-4 h-4 text-purple-600" />,
                    accent: 'bg-purple-500',
                };
            case 'customer':
                return {
                    label: 'Customer',
                    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    icon: <HiOutlineUsers className="w-4 h-4 text-indigo-600" />,
                    accent: 'bg-indigo-500',
                };
            case 'payment':
                return {
                    label: 'Payment',
                    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    icon: <HiOutlineCreditCard className="w-4 h-4 text-emerald-600" />,
                    accent: 'bg-emerald-500',
                };
            case 'claim':
                return {
                    label: 'Claim',
                    badge: 'bg-rose-50 text-rose-700 border-rose-200',
                    icon: <HiOutlineShieldCheck className="w-4 h-4 text-rose-600" />,
                    accent: 'bg-rose-500',
                };
            case 'followup':
                return {
                    label: 'Follow-up',
                    badge: 'bg-amber-50 text-amber-800 border-amber-200',
                    icon: <HiOutlinePhone className="w-4 h-4 text-amber-600" />,
                    accent: 'bg-amber-500',
                };
            case 'dealer':
                return {
                    label: 'Dealer',
                    badge: 'bg-teal-50 text-teal-700 border-teal-200',
                    icon: <HiOutlineUserGroup className="w-4 h-4 text-teal-600" />,
                    accent: 'bg-teal-500',
                };
            case 'auth':
                return {
                    label: 'Security & Auth',
                    badge: 'bg-slate-100 text-slate-700 border-slate-300',
                    icon: <HiOutlineKey className="w-4 h-4 text-slate-600" />,
                    accent: 'bg-slate-500',
                };
            default:
                return {
                    label: type,
                    badge: 'bg-surface-100 text-surface-700 border-surface-200',
                    icon: <HiOutlineClock className="w-4 h-4 text-surface-600" />,
                    accent: 'bg-surface-500',
                };
        }
    };

    // Action badge helper
    const getActionBadge = (action: string) => {
        switch (action.toUpperCase()) {
            case 'CREATE':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'UPDATE':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'DELETE':
                return 'bg-rose-100 text-rose-800 border-rose-200';
            case 'CONVERT':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'LOGIN':
            case 'LOGOUT':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            default:
                return 'bg-surface-100 text-surface-800 border-surface-200';
        }
    };

    // Navigation target helper for activity click
    const handleNavigateEntity = (act: ActivityItem) => {
        if (!act.entityType || !act.entityId) return;

        switch (act.entityType.toLowerCase()) {
            case 'policy':
                navigate(`/policies/${act.entityId}`);
                break;
            case 'lead':
                navigate(`/leads`);
                break;
            case 'customer':
                navigate(`/customers`);
                break;
            case 'payment':
                navigate(`/payments`);
                break;
            case 'claim':
                navigate(`/claims`);
                break;
            case 'followup':
                navigate(`/follow-ups`);
                break;
            default:
                break;
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Bar Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-surface-200 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                        <HiOutlineClock className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-surface-900 tracking-tight">Agent Activity & Audit Log</h1>
                        <p className="text-xs text-surface-500">
                            Real-time tracking feed of actions, policy updates, conversions, and client interactions
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* Refresh */}
                    <button
                        onClick={() => fetchActivities(meta.page)}
                        disabled={loading}
                        className="p-2.5 rounded-xl border border-surface-200 hover:bg-surface-50 text-surface-600 transition-colors"
                        title="Refresh Activity Log"
                    >
                        <HiOutlineRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* CSV Export */}
                    <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-surface-200 bg-white text-xs font-semibold text-surface-700 hover:bg-surface-50 transition-colors shadow-xs"
                    >
                        <HiOutlineDownload className="w-4 h-4 text-surface-600" /> Export CSV
                    </button>

                    {/* View Switcher */}
                    <div className="flex bg-surface-100 p-1 rounded-xl text-xs font-semibold">
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                viewMode === 'timeline'
                                    ? 'bg-white text-primary-600 shadow-xs'
                                    : 'text-surface-600 hover:text-surface-900'
                            }`}
                        >
                            <HiOutlineClock className="w-4 h-4" /> Timeline
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                viewMode === 'table'
                                    ? 'bg-white text-primary-600 shadow-xs'
                                    : 'text-surface-600 hover:text-surface-900'
                            }`}
                        >
                            <HiOutlineViewList className="w-4 h-4" /> Audit Table
                        </button>
                        <button
                            onClick={() => setViewMode('analytics')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                viewMode === 'analytics'
                                    ? 'bg-white text-primary-600 shadow-xs'
                                    : 'text-surface-600 hover:text-surface-900'
                            }`}
                        >
                            <HiOutlineChartBar className="w-4 h-4" /> Summary Stats
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Metrics Header */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-white border border-surface-200 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Today's Actions</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <p className="text-2xl font-bold text-surface-900 mt-2">{summary.todayCount || 0}</p>
                        <p className="text-[11px] text-surface-400 mt-0.5">Recorded since midnight</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-surface-200 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">7-Day Velocity</span>
                            <div className="p-1 bg-blue-50 text-blue-600 rounded-lg">
                                <HiOutlineTrendingUp className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-surface-900 mt-2">{summary.weeklyCount || 0}</p>
                        <p className="text-[11px] text-surface-400 mt-0.5">Actions past 7 days</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-surface-200 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Monthly Activity</span>
                            <div className="p-1 bg-purple-50 text-purple-600 rounded-lg">
                                <HiOutlineCalendar className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-surface-900 mt-2">{summary.monthCount || 0}</p>
                        <p className="text-[11px] text-surface-400 mt-0.5">This month total</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-surface-200 shadow-xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Top Category</span>
                            <div className="p-1 bg-amber-50 text-amber-600 rounded-lg">
                                <HiOutlineViewGrid className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-surface-900 mt-2 capitalize">
                            {summary.categoryDistribution?.[0]?.category || 'Policies'}
                        </p>
                        <p className="text-[11px] text-surface-400 mt-0.5">Most frequent action domain</p>
                    </div>
                </div>
            )}

            {/* Filter Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-surface-200 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                    {/* Live Search */}
                    <div className="relative flex-1">
                        <HiOutlineSearch className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
                        <input
                            type="text"
                            placeholder="Search by action title, client name, notes, or policy number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 bg-surface-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        />
                    </div>

                    {/* Preset Date Range Selector */}
                    <div className="flex items-center gap-2">
                        <select
                            value={dateRangePreset}
                            onChange={(e) => setDateRangePreset(e.target.value)}
                            className="px-3 py-2.5 rounded-xl border border-surface-200 bg-white text-xs font-semibold text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        >
                            <option value="all">All Dates</option>
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="specific">Specific Date...</option>
                            <option value="7days">Last 7 Days</option>
                            <option value="month">This Month</option>
                            <option value="custom">Custom Range...</option>
                        </select>

                        {/* Agent Selector for Staff */}
                        {isStaff && summary?.users && (
                            <select
                                value={agentFilter}
                                onChange={(e) => setAgentFilter(e.target.value)}
                                className="px-3 py-2.5 rounded-xl border border-surface-200 bg-white text-xs font-semibold text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            >
                                <option value="all">All Agents/Staff</option>
                                {summary.users.map((u: any) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name} ({u.role})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* Specific Single Date Input */}
                {dateRangePreset === 'specific' && (
                    <div className="flex items-center gap-3 pt-2 border-t border-surface-100">
                        <div className="flex items-center gap-2 text-xs text-surface-600">
                            <span className="font-semibold text-surface-700">Filter Activity Date:</span>
                            <input
                                type="date"
                                value={specificDate}
                                onChange={(e) => setSpecificDate(e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-surface-200 text-xs font-semibold text-surface-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            />
                        </div>
                    </div>
                )}

                {/* Custom Date Inputs if custom range selected */}
                {dateRangePreset === 'custom' && (
                    <div className="flex items-center gap-3 pt-2 border-t border-surface-100">
                        <div className="flex items-center gap-2 text-xs text-surface-600">
                            <span>From:</span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="px-2.5 py-1.5 rounded-lg border border-surface-200 text-xs font-medium"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-surface-600">
                            <span>To:</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="px-2.5 py-1.5 rounded-lg border border-surface-200 text-xs font-medium"
                            />
                        </div>
                    </div>
                )}

                {/* Entity Pills Filter */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-surface-100">
                    <span className="text-xs font-semibold text-surface-500 mr-2 flex items-center gap-1">
                        <HiOutlineFilter className="w-3.5 h-3.5" /> Category:
                    </span>
                    {[
                        { key: 'all', label: 'All Domains' },
                        { key: 'policy', label: 'Policies' },
                        { key: 'lead', label: 'Leads' },
                        { key: 'customer', label: 'Customers' },
                        { key: 'payment', label: 'Payments' },
                        { key: 'claim', label: 'Claims' },
                        { key: 'followup', label: 'Follow-ups' },
                        { key: 'dealer', label: 'Dealers' },
                        { key: 'auth', label: 'Auth & Logins' },
                    ].map((pill) => (
                        <button
                            key={pill.key}
                            onClick={() => setEntityTypeFilter(pill.key)}
                            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                                entityTypeFilter === pill.key
                                    ? 'bg-surface-900 text-white shadow-xs'
                                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                            }`}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            {loading ? (
                <div className="bg-white p-6 rounded-2xl border border-surface-200">
                    <TableSkeleton rows={6} cols={4} />
                </div>
            ) : activities.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-surface-200">
                    <EmptyState
                        message="No activity actions recorded matching your current filter criteria."
                    />
                </div>
            ) : (
                <>
                    {/* VIEW 1: TIMELINE STREAM */}
                    {viewMode === 'timeline' && (
                        <div className="bg-white p-6 rounded-2xl border border-surface-200 shadow-xs relative">
                            {/* Vertical Line */}
                            <div className="absolute left-[39px] sm:left-[47px] top-8 bottom-8 w-0.5 bg-surface-200" />

                            <div className="space-y-6">
                                {activities.map((act) => {
                                    const cfg = getCategoryConfig(act.entityType);
                                    return (
                                        <div key={act.id} className="relative flex items-start gap-4 group">
                                            {/* Icon Node */}
                                            <div
                                                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center z-10 border shadow-xs transition-transform group-hover:scale-105 ${cfg.badge}`}
                                            >
                                                {cfg.icon}
                                            </div>

                                            {/* Content Card */}
                                            <div
                                                onClick={() => setSelectedActivity(act)}
                                                className="flex-1 bg-surface-50/50 hover:bg-surface-50 p-4 rounded-2xl border border-surface-200/80 hover:border-surface-300 transition-all cursor-pointer shadow-2xs"
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-bold text-surface-900">
                                                            {act.title}
                                                        </span>
                                                        <span
                                                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getActionBadge(
                                                                act.action
                                                            )}`}
                                                        >
                                                            {act.action}
                                                        </span>
                                                    </div>

                                                    <span className="text-xs font-medium text-surface-400">
                                                        {formatDateTime(act.createdAt)}
                                                    </span>
                                                </div>

                                                {act.description && (
                                                    <p className="text-xs text-surface-600 line-clamp-2 mt-1">
                                                        {act.description}
                                                    </p>
                                                )}

                                                {/* Actor Footer */}
                                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-200/60 text-[11px] text-surface-500">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-[10px]">
                                                            {(act.user?.name || 'S').charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-semibold text-surface-700">
                                                            {act.user?.name || 'System'}
                                                        </span>
                                                        <span className="capitalize opacity-60">({act.userRole})</span>
                                                    </div>

                                                    {act.entityId && (
                                                        <span
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNavigateEntity(act);
                                                            }}
                                                            className="inline-flex items-center gap-1 text-primary-600 font-semibold hover:underline"
                                                        >
                                                            View Record <HiOutlineChevronRight className="w-3.5 h-3.5" />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* VIEW 2: AUDIT TABLE */}
                    {viewMode === 'table' && (
                        <div className="bg-white rounded-2xl border border-surface-200 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-surface-50 border-b border-surface-200 text-surface-600 font-semibold uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3.5">Timestamp</th>
                                            <th className="px-4 py-3.5">User</th>
                                            <th className="px-4 py-3.5">Category</th>
                                            <th className="px-4 py-3.5">Action</th>
                                            <th className="px-4 py-3.5">Title & Description</th>
                                            <th className="px-4 py-3.5 text-right">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-200 text-surface-800">
                                        {activities.map((act) => {
                                            const cfg = getCategoryConfig(act.entityType);
                                            return (
                                                <tr
                                                    key={act.id}
                                                    onClick={() => setSelectedActivity(act)}
                                                    className="hover:bg-surface-50/80 cursor-pointer transition-colors"
                                                >
                                                    <td className="px-4 py-3 whitespace-nowrap text-surface-500 font-mono text-[11px]">
                                                        {formatDateTime(act.createdAt)}
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-surface-900">
                                                        {act.user?.name || 'System'}
                                                        <span className="block text-[10px] text-surface-400 font-normal capitalize">
                                                            {act.userRole}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-md border font-semibold ${cfg.badge}`}>
                                                            {cfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-md border font-bold uppercase text-[10px] ${getActionBadge(act.action)}`}>
                                                            {act.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 max-w-md">
                                                        <p className="font-semibold text-surface-900 truncate">{act.title}</p>
                                                        <p className="text-[11px] text-surface-500 truncate">{act.description}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button className="p-1.5 rounded-lg text-surface-400 hover:text-primary-600 hover:bg-surface-100 transition-colors">
                                                            <HiOutlineEye className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* VIEW 3: SUMMARY ANALYTICS */}
                    {viewMode === 'analytics' && summary && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-2xl border border-surface-200 shadow-xs space-y-4">
                                <h3 className="text-base font-bold text-surface-900">Activity Distribution by Domain</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {summary.categoryDistribution?.map((cat: any) => {
                                        const cfg = getCategoryConfig(cat.category);
                                        return (
                                            <div key={cat.category} className="p-4 rounded-xl border border-surface-200 bg-surface-50/50 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    {cfg.icon}
                                                    <span className="text-xs font-bold text-surface-800 capitalize">{cfg.label}</span>
                                                </div>
                                                <p className="text-xl font-bold text-surface-900">{cat.count}</p>
                                                <p className="text-[10px] text-surface-400">Total actions logged</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pagination Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-surface-200">
                        <div className="flex items-center gap-2 text-xs text-surface-600 font-medium">
                            <span>Show:</span>
                            <select
                                value={meta.limit}
                                onChange={(e) => {
                                    const newLimit = Number(e.target.value);
                                    setMeta((prev) => ({ ...prev, limit: newLimit, page: 1 }));
                                }}
                                className="px-2.5 py-1 rounded-lg border border-surface-200 bg-white text-xs font-semibold text-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                            >
                                <option value={10}>10 items</option>
                                <option value={20}>20 items</option>
                                <option value={50}>50 items</option>
                                <option value={100}>100 items</option>
                            </select>
                            <span className="text-surface-400">| Total {meta.total} activity logs</span>
                        </div>

                        <Pagination
                            page={meta.page}
                            totalPages={meta.totalPages}
                            onPageChange={(p) => fetchActivities(p)}
                        />
                    </div>
                </>
            )}

            {/* ACTIVITY DETAIL MODAL */}
            <Modal
                isOpen={!!selectedActivity}
                onClose={() => setSelectedActivity(null)}
                title={selectedActivity ? selectedActivity.title : ''}
                size="lg"
            >
                {selectedActivity && (
                    <div className="space-y-4 text-xs text-surface-700">
                        {/* Header Badge Card */}
                        <div className="p-4 rounded-xl border border-surface-200 bg-surface-50 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-surface-500 tracking-wider">
                                    Category: {selectedActivity.entityType}
                                </span>
                                <p className="text-sm font-bold text-surface-900 mt-0.5">{selectedActivity.title}</p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg border font-bold uppercase text-[10px] ${getActionBadge(selectedActivity.action)}`}>
                                {selectedActivity.action}
                            </span>
                        </div>

                        {/* Description */}
                        {selectedActivity.description && (
                            <div className="space-y-1">
                                <p className="font-semibold text-surface-500">Details / Description:</p>
                                <p className="p-3 bg-white border border-surface-200 rounded-xl text-surface-900 font-medium leading-relaxed">
                                    {selectedActivity.description}
                                </p>
                            </div>
                        )}

                        {/* User & Metadata Specs */}
                        <div className="grid grid-cols-2 gap-3 bg-surface-50/80 p-3.5 rounded-xl border border-surface-200">
                            <div>
                                <span className="text-surface-400 font-medium">Performed By:</span>
                                <p className="font-semibold text-surface-900 mt-0.5">{selectedActivity.user?.name || 'System'}</p>
                                <p className="text-[10px] text-surface-500 capitalize">{selectedActivity.userRole}</p>
                            </div>
                            <div>
                                <span className="text-surface-400 font-medium">Timestamp:</span>
                                <p className="font-semibold text-surface-900 mt-0.5">{formatDateTime(selectedActivity.createdAt)}</p>
                                <p className="text-[10px] text-surface-500 font-mono">{selectedActivity.createdAt}</p>
                            </div>
                        </div>

                        {/* Raw JSON Snapshot Metadata */}
                        {selectedActivity.metadata && (
                            <div className="space-y-1">
                                <p className="font-semibold text-surface-500">Metadata Payload / Snapshot:</p>
                                <pre className="p-3 bg-surface-900 text-surface-100 rounded-xl overflow-x-auto text-[11px] font-mono leading-normal">
                                    {JSON.stringify(selectedActivity.metadata, null, 2)}
                                </pre>
                            </div>
                        )}

                        {/* Action Link */}
                        {selectedActivity.entityId && (
                            <div className="flex justify-end pt-2 border-t border-surface-200">
                                <button
                                    onClick={() => {
                                        const act = selectedActivity;
                                        setSelectedActivity(null);
                                        handleNavigateEntity(act);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-primary-600 text-white font-semibold text-xs hover:bg-primary-700 transition-colors inline-flex items-center gap-1.5"
                                >
                                    Navigate to Target Record <HiOutlineChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Activities;
