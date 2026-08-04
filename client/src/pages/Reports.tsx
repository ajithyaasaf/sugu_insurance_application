import React, { useState } from 'react';
import { 
    HiOutlineChartBar, 
    HiOutlineAdjustments,
    HiOutlineTrendingUp
} from 'react-icons/hi';
import DashboardTab from '../components/reports/DashboardTab';
import ReportBuilderTab from '../components/reports/ReportBuilderTab';
import FinancialYearTab from '../components/reports/FinancialYearTab';
import { useAuth } from '../context/AuthContext';

type TabId = 'dashboard' | 'fy-analytics' | 'builder';

const Reports: React.FC = () => {
    const { user } = useAuth();
    const isStaff = user?.role === 'staff';
    const [activeTab, setActiveTab] = useState<TabId>('dashboard');

    const tabs = [
        { id: 'dashboard' as TabId, label: 'Dashboard', icon: HiOutlineChartBar },
        ...(!isStaff ? [{ id: 'fy-analytics' as TabId, label: 'Financial Year Analytics', icon: HiOutlineTrendingUp }] : []),
        ...(!isStaff ? [{ id: 'builder' as TabId, label: 'Report Builder', icon: HiOutlineAdjustments }] : []),
    ];

    return (
        <div>
            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Reports & Analytics</h1>
                    <p className="text-sm text-surface-500 mt-1">
                        {isStaff 
                            ? "Overview performance insights and operational analytics" 
                            : "Generate insights, compare performance, and export data"}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            {tabs.length > 1 && (
                <div className="flex items-center gap-1 mb-6 p-1 bg-surface-100 rounded-2xl w-full sm:w-fit overflow-x-auto hide-scrollbar">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 min-w-max flex-1 sm:flex-none ${activeTab === tab.id
                                ? 'bg-white text-surface-900 shadow-sm'
                                : 'text-surface-500 hover:text-surface-700'
                                }`}
                        >
                            <tab.icon className="w-4 h-4 shrink-0" />
                            <span className={`${activeTab === tab.id ? 'inline' : 'hidden sm:inline'} whitespace-nowrap`}>
                                {tab.label}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Tab content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'dashboard' && <DashboardTab />}
                {activeTab === 'fy-analytics' && !isStaff && <FinancialYearTab />}
                {activeTab === 'builder' && !isStaff && <ReportBuilderTab />}
            </div>
        </div>
    );
};

export default Reports;
