import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    HiOutlineViewGrid,
    HiOutlineUserGroup,
    HiOutlineUsers,
    HiOutlineDocumentText,
    HiOutlineCreditCard,
    HiOutlineShieldCheck,
    HiOutlinePhone,
    HiOutlineLogout,
    HiOutlineMenu,
    HiOutlineX,
    HiOutlineTrendingUp,
    HiOutlineChartBar,
    HiOutlineCalculator,
} from 'react-icons/hi';

import GlobalSearch from '../components/ui/GlobalSearch';
import ExpiringBanner from '../components/ui/ExpiringBanner';

const navItems = [
    { to: '/', icon: HiOutlineViewGrid, label: 'Dashboard' },
    { to: '/leads', icon: HiOutlineTrendingUp, label: 'Leads' },
    { to: '/customers', icon: HiOutlineUsers, label: 'Customers' },
    { to: '/policies', icon: HiOutlineDocumentText, label: 'Policies' },
    { to: '/payments', icon: HiOutlineCreditCard, label: 'Payments' },
    { to: '/claims', icon: HiOutlineShieldCheck, label: 'Claims' },
    { to: '/follow-ups', icon: HiOutlinePhone, label: 'Follow-ups' },
    { to: '/dealers', icon: HiOutlineUserGroup, label: 'Dealers' },
    { to: '/commissions', icon: HiOutlineCalculator, label: 'Commissions' },
    { to: '/reports', icon: HiOutlineChartBar, label: 'Reports' },
];

const AppLayout: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen overflow-hidden bg-surface-50">
            {/* Overlay for mobile */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-900 text-white 
          transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-surface-700/50">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center">
                                <HiOutlineShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-base font-bold tracking-tight">InsureCRM</h1>
                                <p className="text-[10px] text-surface-400 uppercase tracking-widest">Pro</p>
                            </div>
                        </div>
                        <button
                            className="lg:hidden text-surface-400 hover:text-white"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                        {navItems
                            .filter(item => {
                                if (user?.role === 'staff') {
                                    return !['/commissions'].includes(item.to);
                                }
                                return true;
                            })
                            .map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.to === '/'}
                                    onClick={() => setSidebarOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                                            ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                                            : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                                        }`
                                    }
                                >
                                    <item.icon className="w-5 h-5 flex-shrink-0" />
                                    {item.label}
                                </NavLink>
                            ))}
                    </nav>

                    {/* User */}
                    <div className="px-3 py-4 border-t border-surface-700/50">
                        <div className="flex items-center gap-3 px-3 py-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-primary-600/20 flex items-center justify-center text-primary-400 text-sm font-bold">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                                <p className="text-xs text-surface-400 capitalize">{user?.role}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium 
                text-surface-400 hover:bg-red-600/10 hover:text-red-400 transition-all duration-200"
                        >
                            <HiOutlineLogout className="w-5 h-5" />
                            Logout
                        </button>

                        {/* Attribution */}
                        <div className="mt-6 px-3 text-center opacity-40 hover:opacity-100 transition-opacity duration-300">
                            <p className="text-[9px] text-surface-500 uppercase tracking-[0.2em] font-medium">
                                Designed & Developed by
                            </p>
                            <p className="text-[10px] text-surface-300 mt-0.5 font-semibold">Ajith</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* <ExpiringBanner /> */}
                {/* Top bar */}
                <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-surface-200">
                    <div className="flex items-center gap-4 lg:gap-0">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-xl text-surface-600 hover:bg-surface-100 lg:hidden"
                        >
                            <HiOutlineMenu className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 max-w-md mx-4">
                        <GlobalSearch />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:block text-right">
                            <p className="text-sm font-medium text-surface-900">{user?.name}</p>
                            <p className="text-[10px] text-surface-500 uppercase tracking-wider">{user?.role}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-primary-600/10 flex items-center justify-center text-primary-600 font-bold text-xs">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AppLayout;
