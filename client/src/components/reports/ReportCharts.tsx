import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer,
    Cell, PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';
import { HiOutlineTrendingUp } from 'react-icons/hi';
import { formatCurrency, formatShortCurrency } from '../../utils/format';

export const BarChartRow: React.FC<{
    data: any[],
    nameKey: string,
    valueKey: string,
    label: string,
    limit?: number
}> = ({ data, nameKey, valueKey, label, limit }) => {
    if (!data?.length) return null;
    const maxVal = Math.max(...data.map((d: any) => d[valueKey] || 0), 1);
    const displayData = limit ? data.slice(0, limit) : data;
    return (
        <div className="space-y-2.5 mt-2">
            {displayData.map((item: any, i: number) => (
                <div key={item[nameKey] || item.id || i} className="group">
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-surface-700 font-medium truncate mr-2 capitalize">
                            {item[nameKey] || 'N/A'}
                            {item.count !== undefined && (
                                <span className="text-[11px] text-primary-600 font-bold lowercase ml-1.5 whitespace-nowrap">
                                    ({item.count} {item.count === 1 ? 'policy' : 'policies'})
                                </span>
                            )}
                        </span>
                        <span className="text-surface-500 font-medium whitespace-nowrap">
                            {typeof item[valueKey] === 'number' && label.includes('₹')
                                ? formatCurrency(item[valueKey])
                                : item[valueKey]}
                        </span>
                    </div>
                    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${Math.max((item[valueKey] / maxVal) * 100, 2)}%`,
                                background: `linear-gradient(90deg, 
                                    hsl(${240 - i * 25}, 70%, 55%), 
                                    hsl(${240 - i * 25}, 70%, 65%))`,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

export const CompanyBarChart: React.FC<{ data: any[], nameKey: string, valueKey: string, label?: string }> = ({ data, nameKey, valueKey, label = 'Premium' }) => {
    if (!data?.length) return null;

    const chartData = data.slice(0, 8).map(d => ({
        name: String(d[nameKey] || 'N/A'),
        value: Number(d[valueKey]) || 0,
        count: d.count !== undefined ? Number(d.count) : undefined,
    }));

    return (
        <div className="h-64 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 500 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }}
                        tickFormatter={(val) => formatShortCurrency(val).replace('₹', '').trim()}
                        width={45}
                    />
                    <RechartsTooltip
                        cursor={{ fill: '#F9FAFB' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const count = payload[0].payload.count;
                                const showCount = count !== undefined && count > 0;
                                return (
                                    <div className="bg-white px-3 py-2 shadow-lg shadow-surface-900/5 rounded-xl border border-surface-100">
                                        <p className="text-xs font-bold text-surface-900 mb-0.5">{payload[0].payload.name}</p>
                                        {showCount && (
                                            <p className="text-[11px] text-primary-600 font-bold mb-1">
                                                ({count} {count === 1 ? 'policy' : 'policies'})
                                            </p>
                                        )}
                                        <p className="text-sm font-semibold text-primary-600">
                                            {formatCurrency(payload[0].value as number)} {label}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                        {chartData.map((_, index) => (
                            <Cell key={index} fill={`hsl(${240 - index * 6}, 70%, 60%)`} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export const PolicyPieChart: React.FC<{ data: any[], nameKey: string, valueKey: string }> = ({ data, nameKey, valueKey }) => {
    if (!data?.length) return null;

    const chartData = data.map(d => ({
        name: String(d[nameKey] || 'N/A'),
        value: Number(d[valueKey]) || 0,
    }));

    const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

    return (
        <div className="h-64 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <RechartsTooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-white px-3 py-2 shadow-lg rounded-xl border border-surface-100">
                                        <p className="text-xs font-bold text-surface-900 mb-1">{payload[0].payload.name}</p>
                                        <p className="text-sm font-semibold text-surface-600">
                                            {payload[0].value} Policies
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        iconType="circle" 
                        wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}
                        formatter={(value, entry: any) => {
                            const count = entry?.payload?.value || 0;
                            return (
                                <span className="text-surface-700 capitalize">
                                    {value}
                                    <span className="text-[11px] text-primary-600 font-bold ml-1.5">
                                        ({count} {count === 1 ? 'policy' : 'policies'})
                                    </span>
                                </span>
                            );
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export const TrendAreaChart: React.FC<{
    data: any[],
    nameKey: string,
    valueKey: string,
    label?: string
}> = ({ data, nameKey, valueKey, label = 'Premium' }) => {
    if (!data?.length) return null;

    if (data.length === 1) {
        const singleMonth = data[0];
        const val = Number(singleMonth[valueKey]) || 0;
        const avgPremium = singleMonth.count > 0 ? Math.round(val / singleMonth.count) : 0;
        
        return (
            <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-indigo-50/50 to-primary-50/30 border border-primary-100/50 flex flex-col justify-between h-64">
                <div className="flex items-start justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600/80">Monthly Performance Summary</span>
                        <h4 className="text-base font-extrabold text-surface-900 mt-1">{singleMonth[nameKey]}</h4>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center border border-primary-100/40 text-primary-600">
                        <HiOutlineTrendingUp className="w-5 h-5" />
                    </div>
                </div>
                
                <div className="my-2">
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wide">Total Premium</span>
                    <p className="text-3xl font-black text-surface-900 mt-0.5 tracking-tight">
                        {formatCurrency(singleMonth[valueKey])}
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary-100/20">
                    <div>
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wide">Policies Generated</span>
                        <p className="text-sm font-bold text-surface-700 mt-0.5">
                            {singleMonth.count} {singleMonth.count === 1 ? 'policy' : 'policies'}
                        </p>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wide">Avg. Premium / Policy</span>
                        <p className="text-sm font-bold text-surface-700 mt-0.5">
                            {formatCurrency(avgPremium)}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // The trend comes in descending order (newest first).
    // For a trend chart, we want to show it in chronological order (oldest first).
    // So we slice and reverse.
    const chartData = [...data].reverse().map(d => ({
        name: String(d[nameKey] || 'N/A'),
        value: Number(d[valueKey]) || 0,
    }));

    return (
        <div className="h-64 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }}
                        tickFormatter={(val) => formatShortCurrency(val).replace('₹', '').trim()}
                        width={45}
                    />
                    <RechartsTooltip
                        cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '4 4' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-white px-3 py-2 shadow-lg shadow-surface-900/5 rounded-xl border border-surface-100">
                                        <p className="text-xs font-bold text-surface-900 mb-1">{payload[0].payload.name}</p>
                                        <p className="text-sm font-semibold text-primary-600">
                                            {formatCurrency(payload[0].value as number)} {label}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#4F46E5"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#trendGradient)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

