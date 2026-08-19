import prisma from '../../utils/prisma';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Prisma } from '@prisma/client';
import { buildStatusFilter, mapPolicyStatus, getStartOfTodayIST, mapPaymentStatus, getStartOfDayIST, getEndOfDayIST, getStartOfMonthIST } from '../../utils/date';
import type { ReportSource, ReportGroupBy } from './report.schema';
import { ownerFilter } from '../../utils/rbac';

// ─── Types ───────────────────────────────────────────────

interface ReportFilters {
    companyId?: string;
    companyIds?: string | string[];
    dealerId?: string;
    customerId?: string;
    policyType?: string;
    vehicleClass?: string;
    status?: string;
    policyOrigin?: string;
    dateFrom?: string;
    dateTo?: string;
}

interface GenerateParams {
    source: ReportSource;
    filters?: ReportFilters;
    groupBy?: ReportGroupBy;
    page: number;
    limit: number;
}

interface ExportParams {
    source: ReportSource;
    filters?: ReportFilters;
    groupBy?: ReportGroupBy;
    format: 'xlsx' | 'pdf';
    columns?: string[];
    title?: string;
}

// ─── Column definitions per source ───────────────────────

const SOURCE_COLUMNS: Record<string, { key: string; label: string }[]> = {
    policies: [
        { key: 'policyNumber', label: 'Policy No.' },
        { key: 'customerName', label: 'Customer' },
        { key: 'customerPhone', label: 'Phone' },
        { key: 'companyName', label: 'Company' },
        { key: 'policyType', label: 'Type' },
        { key: 'make', label: 'Make' },
        { key: 'model', label: 'Model' },
        { key: 'vehicleNumber', label: 'Vehicle No.' },
        { key: 'vehicleClass', label: 'Vehicle Class' },
        { key: 'od', label: 'OD Premium (₹)' },
        { key: 'tp', label: 'TP Premium (₹)' },
        { key: 'premiumAmount', label: 'Premium (Net) (₹)' },
        { key: 'tax', label: 'Tax (₹)' },
        { key: 'totalPremium', label: 'Total Premium (₹)' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'expiryDate', label: 'Expiry Date' },
        { key: 'status', label: 'Status' },
        { key: 'policyOrigin', label: 'Origin' },
    ],
    'policies-expired': [
        { key: 'policyNumber', label: 'Policy No.' },
        { key: 'customerName', label: 'Customer' },
        { key: 'customerPhone', label: 'Phone' },
        { key: 'companyName', label: 'Company' },
        { key: 'policyType', label: 'Type' },
        { key: 'make', label: 'Make' },
        { key: 'model', label: 'Model' },
        { key: 'vehicleNumber', label: 'Vehicle No.' },
        { key: 'vehicleClass', label: 'Vehicle Class' },
        { key: 'od', label: 'OD Premium (₹)' },
        { key: 'tp', label: 'TP Premium (₹)' },
        { key: 'premiumAmount', label: 'Premium (Net) (₹)' },
        { key: 'tax', label: 'Tax (₹)' },
        { key: 'totalPremium', label: 'Total Premium (₹)' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'expiryDate', label: 'Expiry Date' },
        { key: 'status', label: 'Status' },
        { key: 'policyOrigin', label: 'Origin' },
        { key: 'ncbPercentage', label: 'NCB (%)' },
    ],
    payments: [
        { key: 'startDate', label: 'Start Date' },
        { key: 'customerName', label: 'Customer' },
        { key: 'policyNumber', label: 'Policy No.' },
        { key: 'vehicleNumber', label: 'Vehicle No.' },
        { key: 'vehicleClass', label: 'Vehicle Class' },
        { key: 'paidAmount', label: 'Paid (₹)' },
        { key: 'pendingAmount', label: 'Pending (₹)' },
        { key: 'amount', label: 'Premium (₹)' },
        { key: 'dealerName', label: 'Dealer' },
        { key: 'dueDate', label: 'Due Date' },
        { key: 'companyName', label: 'Company' },
        { key: 'status', label: 'Status' },
    ],
    claims: [
        { key: 'claimDate', label: 'Claim Intimation Date' },
        { key: 'claimNumber', label: 'Claim No.' },
        { key: 'customerName', label: 'Customer' },
        { key: 'policyNumber', label: 'Policy No.' },
        { key: 'vehicleNumber', label: 'Vehicle No.' },
        { key: 'make', label: 'Make' },
        { key: 'vehicleClass', label: 'Vehicle Class' },
        { key: 'companyName', label: 'Company' },
        { key: 'billAmount', label: 'Bill Amount (₹)' },
        { key: 'status', label: 'Status' },
        { key: 'reason', label: 'Reason' },
        { key: 'claimAmount', label: 'Claim Settled Amount' },
        { key: 'surveyorName', label: 'Surveyor / TPA' },
        { key: 'surveyorPhone', label: 'Surveyor / TPA Phone' },
        { key: 'workshopName', label: 'Workshop / Hospital' },
    ],
    customers: [
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'address', label: 'Address' },
        { key: 'totalPolicies', label: 'Total Policies' },
        { key: 'totalPremium', label: 'Total Premium (₹)' },
        { key: 'createdAt', label: 'Added On' },
    ],
    followups: [
        { key: 'customerName', label: 'Customer' },
        { key: 'customerPhone', label: 'Phone' },
        { key: 'policyNumber', label: 'Policy No.' },
        { key: 'vehicleNumber', label: 'Vehicle No.' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'expiryDate', label: 'Expiry Date' },
        { key: 'nextFollowUpDate', label: 'Follow-up Date' },
        { key: 'status', label: 'Status' },
        { key: 'notes', label: 'Notes' },
    ],
    offers: [
        { key: 'customerName', label: 'Customer' },
        { key: 'policyNumber', label: 'Policy No.' },
        { key: 'companyName', label: 'Company' },
        { key: 'grossPremium', label: 'Gross Premium (₹)' },
        { key: 'offerAmount', label: 'Offer Discount (₹)' },
        { key: 'customerPayable', label: 'Net Payable (₹)' },
        { key: 'createdAt', label: 'Offer Date' },
        { key: 'notes', label: 'Notes' },
    ],
};

function getColumnsForSource(source: string, policyType?: string): { key: string; label: string }[] {
    const defaultCols = SOURCE_COLUMNS[source] || [];
    if (!policyType || policyType === 'motor') {
        return defaultCols;
    }

    const typeLower = policyType.toLowerCase();
    if (typeLower === 'health' || typeLower === 'life') {
        if (source === 'policies') {
            return [
                { key: 'policyNumber', label: 'Policy No.' },
                { key: 'customerName', label: 'Customer' },
                { key: 'customerPhone', label: 'Phone' },
                { key: 'companyName', label: 'Company' },
                { key: 'policyType', label: 'Type' },
                { key: 'productName', label: 'Product Name' },
                { key: 'sumInsured', label: 'Sum Insured (₹)' },
                { key: 'premiumAmount', label: 'Premium (Net) (₹)' },
                { key: 'tax', label: 'Tax (₹)' },
                { key: 'totalPremium', label: 'Total Premium (₹)' },
                { key: 'startDate', label: 'Start Date' },
                { key: 'expiryDate', label: 'Expiry Date' },
                { key: 'status', label: 'Status' },
                { key: 'policyOrigin', label: 'Origin' },
            ];
        }
        if (source === 'policies-expired') {
            return [
                { key: 'policyNumber', label: 'Policy No.' },
                { key: 'customerName', label: 'Customer' },
                { key: 'customerPhone', label: 'Phone' },
                { key: 'companyName', label: 'Company' },
                { key: 'policyType', label: 'Type' },
                { key: 'productName', label: 'Product Name' },
                { key: 'sumInsured', label: 'Sum Insured (₹)' },
                { key: 'premiumAmount', label: 'Premium (Net) (₹)' },
                { key: 'tax', label: 'Tax (₹)' },
                { key: 'totalPremium', label: 'Total Premium (₹)' },
                { key: 'startDate', label: 'Start Date' },
                { key: 'expiryDate', label: 'Expiry Date' },
                { key: 'status', label: 'Status' },
                { key: 'policyOrigin', label: 'Origin' },
                { key: 'ncbPercentage', label: 'NCB (%)' },
            ];
        }
        if (source === 'payments') {
            return [
                { key: 'startDate', label: 'Start Date' },
                { key: 'customerName', label: 'Customer' },
                { key: 'policyNumber', label: 'Policy No.' },
                { key: 'productName', label: 'Product Name' },
                { key: 'paidAmount', label: 'Paid (₹)' },
                { key: 'pendingAmount', label: 'Pending (₹)' },
                { key: 'amount', label: 'Premium (₹)' },
                { key: 'dealerName', label: 'Dealer' },
                { key: 'dueDate', label: 'Due Date' },
                { key: 'companyName', label: 'Company' },
                { key: 'status', label: 'Status' },
            ];
        }
        if (source === 'claims') {
            return [
                { key: 'claimDate', label: 'Claim Intimation Date' },
                { key: 'claimNumber', label: 'Claim No.' },
                { key: 'customerName', label: 'Customer' },
                { key: 'policyNumber', label: 'Policy No.' },
                { key: 'productName', label: 'Product Name' },
                { key: 'companyName', label: 'Company' },
                { key: 'billAmount', label: 'Bill Amount (₹)' },
                { key: 'status', label: 'Status' },
                { key: 'reason', label: 'Reason' },
                { key: 'claimAmount', label: 'Claim Settled Amount' },
                { key: 'surveyorName', label: 'TPA / Claim Officer' },
                { key: 'surveyorPhone', label: 'TPA Phone' },
                { key: 'workshopName', label: 'Hospital Name' },
            ];
        }
        if (source === 'followups') {
            return [
                { key: 'customerName', label: 'Customer' },
                { key: 'customerPhone', label: 'Phone' },
                { key: 'policyNumber', label: 'Policy No.' },
                { key: 'productName', label: 'Product Name' },
                { key: 'startDate', label: 'Start Date' },
                { key: 'expiryDate', label: 'Expiry Date' },
                { key: 'nextFollowUpDate', label: 'Follow-up Date' },
                { key: 'status', label: 'Status' },
                { key: 'notes', label: 'Notes' },
            ];
        }
    }

    return defaultCols;
}


// ─── Helper: build Prisma where clause ───────────────────

function buildPolicyWhere(userId: string, role: string, filters?: ReportFilters) {
    const where: any = { ...ownerFilter(userId, role), deletedAt: null };
    if (filters?.companyId) where.companyId = filters.companyId;
    if (filters?.companyIds) {
        const ids = typeof filters.companyIds === 'string' ? filters.companyIds.split(',') : filters.companyIds;
        where.companyId = { in: ids };
    }
    if (filters?.dealerId === 'direct') {
        where.dealerId = null;
    } else if (filters?.dealerId) {
        where.dealerId = filters.dealerId;
    }
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.policyType) where.policyType = filters.policyType;
    if (filters?.vehicleClass) where.vehicleClass = filters.vehicleClass;
    if (filters?.policyOrigin) where.policyOrigin = filters.policyOrigin;
    if (filters?.status) {
        Object.assign(where, buildStatusFilter(filters.status));
    }
    if (filters?.dateFrom || filters?.dateTo) {
        where.startDate = {};
        if (filters?.dateFrom) where.startDate.gte = getStartOfDayIST(filters.dateFrom);
        if (filters?.dateTo) where.startDate.lte = getEndOfDayIST(filters.dateTo);
    }
    return where;
}

function buildPolicyExpiredWhere(userId: string, role: string, filters?: ReportFilters) {
    const where: any = { ...ownerFilter(userId, role), deletedAt: null };
    if (filters?.companyId) where.companyId = filters.companyId;
    if (filters?.companyIds) {
        const ids = typeof filters.companyIds === 'string' ? filters.companyIds.split(',') : filters.companyIds;
        where.companyId = { in: ids };
    }
    if (filters?.dealerId === 'direct') {
        where.dealerId = null;
    } else if (filters?.dealerId) {
        where.dealerId = filters.dealerId;
    }
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.policyType) where.policyType = filters.policyType;
    if (filters?.vehicleClass) where.vehicleClass = filters.vehicleClass;
    if (filters?.policyOrigin) where.policyOrigin = filters.policyOrigin;
    if (filters?.status) {
        Object.assign(where, buildStatusFilter(filters.status));
    }
    if (filters?.dateFrom || filters?.dateTo) {
        where.expiryDate = {};
        if (filters?.dateFrom) where.expiryDate.gte = getStartOfDayIST(filters.dateFrom);
        if (filters?.dateTo) where.expiryDate.lte = getEndOfDayIST(filters.dateTo);
    }
    return where;
}

function buildPaymentWhere(userId: string, role: string, filters?: ReportFilters) {
    const where: any = { ...ownerFilter(userId, role) };
    const todayIST = getStartOfTodayIST();

    if (filters?.status) {
        if (filters.status === 'overdue') {
            where.status = { in: ['pending', 'partial'] };
            where.dueDate = { lt: todayIST };
        } else if (filters.status === 'pending') {
            where.status = { in: ['pending', 'partial', 'overdue'] };
        } else {
            where.status = filters.status;
        }
    }

    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.dateFrom || filters?.dateTo) {
        where.dueDate = {};
        if (filters?.dateFrom) where.dueDate.gte = getStartOfDayIST(filters.dateFrom);
        if (filters?.dateTo) where.dueDate.lte = getEndOfDayIST(filters.dateTo);
    }
    // Join-level filters (company, dealer) — we filter via the policy relation
    if (filters?.companyId || filters?.companyIds || filters?.dealerId || filters?.policyType || filters?.vehicleClass) {
        where.policy = { deletedAt: null };
        if (filters?.companyId) where.policy.companyId = filters.companyId;
        if (filters?.companyIds) {
            const ids = typeof filters.companyIds === 'string' ? filters.companyIds.split(',') : filters.companyIds;
            where.policy.companyId = { in: ids };
        }
        if (filters?.dealerId === 'direct') {
            where.policy.dealerId = null;
        } else if (filters?.dealerId) {
            where.policy.dealerId = filters.dealerId;
        }
        if (filters?.policyType) where.policy.policyType = filters.policyType;
        if (filters?.vehicleClass) where.policy.vehicleClass = filters.vehicleClass;
    }
    return where;
}

function buildClaimWhere(userId: string, role: string, filters?: ReportFilters) {
    const where: any = { ...ownerFilter(userId, role) };
    if (filters?.status) where.status = filters.status;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.dateFrom || filters?.dateTo) {
        where.claimDate = {};
        if (filters?.dateFrom) where.claimDate.gte = getStartOfDayIST(filters.dateFrom);
        if (filters?.dateTo) where.claimDate.lte = getEndOfDayIST(filters.dateTo);
    }
    if (filters?.companyIds || filters?.companyId || filters?.policyType || filters?.vehicleClass) {
        where.policy = { deletedAt: null };
        if (filters?.companyIds) {
            const ids = typeof filters.companyIds === 'string' ? filters.companyIds.split(',') : filters.companyIds;
            where.policy.companyId = { in: ids };
        } else if (filters?.companyId) {
            where.policy.companyId = filters.companyId;
        }
        if (filters?.policyType) where.policy.policyType = filters.policyType;
        if (filters?.vehicleClass) where.policy.vehicleClass = filters.vehicleClass;
    }
    return where;
}

function buildCustomerWhere(userId: string, role: string, filters?: ReportFilters) {
    const where: any = { ...ownerFilter(userId, role), deletedAt: null };
    if (filters?.customerId) where.id = filters.customerId;
    if (filters?.dateFrom || filters?.dateTo) {
        where.createdAt = {};
        if (filters?.dateFrom) where.createdAt.gte = getStartOfDayIST(filters.dateFrom);
        if (filters?.dateTo) where.createdAt.lte = getEndOfDayIST(filters.dateTo);
    }
    return where;
}

function buildFollowUpWhere(userId: string, role: string, filters?: ReportFilters) {
    const where: any = { ...ownerFilter(userId, role) };
    if (filters?.status) where.status = filters.status;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.dateFrom || filters?.dateTo) {
        where.nextFollowUpDate = {};
        if (filters?.dateFrom) where.nextFollowUpDate.gte = getStartOfDayIST(filters.dateFrom);
        if (filters?.dateTo) where.nextFollowUpDate.lte = getEndOfDayIST(filters.dateTo);
    }
    if (filters?.companyIds || filters?.companyId || filters?.policyType) {
        where.policy = { deletedAt: null };
        if (filters?.companyIds) {
            const ids = typeof filters.companyIds === 'string' ? filters.companyIds.split(',') : filters.companyIds;
            where.policy.companyId = { in: ids };
        } else if (filters?.companyId) {
            where.policy.companyId = filters.companyId;
        }
        if (filters?.policyType) where.policy.policyType = filters.policyType;
    }
    return where;
}

function buildOfferWhere(userId: string, role: string, filters?: ReportFilters) {
    const where: any = {
        ...ownerFilter(userId, role),
        policy: { deletedAt: null },
    };
    if (filters?.companyId) where.companyId = filters.companyId;
    if (filters?.companyIds) {
        const ids = typeof filters.companyIds === 'string' ? filters.companyIds.split(',') : filters.companyIds;
        where.companyId = { in: ids };
    }
    if (filters?.dateFrom || filters?.dateTo) {
        where.createdAt = {};
        if (filters?.dateFrom) where.createdAt.gte = getStartOfDayIST(filters.dateFrom);
        if (filters?.dateTo) where.createdAt.lte = getEndOfDayIST(filters.dateTo);
    }
    if (filters?.customerId) where.policy.customerId = filters.customerId;
    if (filters?.policyType) where.policy.policyType = filters.policyType;
    if (filters?.vehicleClass) where.policy.vehicleClass = filters.vehicleClass;
    if (filters?.dealerId === 'direct') {
        where.policy.dealerId = null;
    } else if (filters?.dealerId) {
        where.policy.dealerId = filters.dealerId;
    }
    return where;
}

// ─── Helper: format date for display ─────────────────────

function fmtDate(d: Date | null | undefined): string {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
}

// ─── Service Class ───────────────────────────────────────

export class ReportService {

    // ── Flat data queries (no grouping) ──────────────────

    private async queryCustomerSnapshot(userId: string, role: string, filters?: ReportFilters) {
        if (!filters?.customerId) {
            throw Object.assign(new Error('Customer ID is required for Customer Snapshot'), { statusCode: 400 });
        }

        const dateFrom = filters.dateFrom ? getStartOfDayIST(filters.dateFrom) : undefined;
        const dateTo = filters.dateTo ? getEndOfDayIST(filters.dateTo) : undefined;

        const ow = ownerFilter(userId, role);
        const policyWhere: any = { ...ow, customerId: filters.customerId, deletedAt: null };
        if (dateFrom || dateTo) {
            policyWhere.startDate = {};
            if (dateFrom) policyWhere.startDate.gte = dateFrom;
            if (dateTo) policyWhere.startDate.lte = dateTo;
        }
        if (filters.companyIds) {
            const ids = typeof filters.companyIds === 'string' ? filters.companyIds.split(',') : filters.companyIds;
            policyWhere.companyId = { in: ids };
        } else if (filters.companyId) {
            policyWhere.companyId = filters.companyId;
        }
        if (filters.policyType) policyWhere.policyType = filters.policyType;
        if (filters.vehicleClass) policyWhere.vehicleClass = filters.vehicleClass;

        const claimWhere: any = { ...ow, customerId: filters.customerId };
        if (dateFrom || dateTo) {
            claimWhere.claimDate = {};
            if (dateFrom) claimWhere.claimDate.gte = dateFrom;
            if (dateTo) claimWhere.claimDate.lte = dateTo;
        }
        if (filters.companyIds || filters.companyId || filters.policyType || filters.vehicleClass) {
            claimWhere.policy = { deletedAt: null };
            if (filters.companyIds) {
                const ids = typeof filters.companyIds === 'string' ? filters.companyIds.split(',') : filters.companyIds;
                claimWhere.policy.companyId = { in: ids };
            } else if (filters.companyId) {
                claimWhere.policy.companyId = filters.companyId;
            }
            if (filters.policyType) claimWhere.policy.policyType = filters.policyType;
            if (filters.vehicleClass) claimWhere.policy.vehicleClass = filters.vehicleClass;
        }

        const today = new Date();
        const sixtyDaysFromNow = new Date();
        sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

        const [customer, policies, claims, expiringPolicies] = await Promise.all([
            prisma.customer.findFirst({ where: { id: filters.customerId, ...ow } }),
            prisma.policy.findMany({ 
                where: policyWhere, 
                include: { company: true },
                orderBy: { startDate: 'asc' }
            }),
            prisma.claim.findMany({ 
                where: claimWhere, 
                include: { policy: true },
                orderBy: { claimDate: 'asc' }
            }),
            prisma.policy.findMany({
                where: {
                    customerId: filters.customerId,
                    deletedAt: null,
                    status: 'active',
                    expiryDate: {
                        gte: today,
                        lte: sixtyDaysFromNow
                    }
                },
                include: { company: true },
                orderBy: { expiryDate: 'asc' }
            })
        ]);

        if (!customer) throw new Error("Customer not found");

        const totalPremium = policies.reduce((sum, p) => sum + (p.totalPremium || p.premiumAmount || 0), 0);
        const totalClaimed = claims.reduce((sum, c) => sum + (c.claimAmount || 0), 0);
        const totalBillAmount = claims.reduce((sum, c) => sum + (c.billAmount || 0), 0);

        // Group by Insurer
        const byInsurer = policies.reduce((acc: any, p) => {
            const name = p.company?.name || 'Unknown';
            if (!acc[name]) acc[name] = { name, count: 0, premium: 0 };
            acc[name].count += 1;
            acc[name].premium += (p.totalPremium || p.premiumAmount || 0);
            return acc;
        }, {});

        // Group by Vehicle Class
        const byVehicle = policies.reduce((acc: any, p) => {
            const name = p.vehicleClass || 'Other';
            if (!acc[name]) acc[name] = { name, count: 0, premium: 0 };
            acc[name].count += 1;
            acc[name].premium += (p.totalPremium || p.premiumAmount || 0);
            return acc;
        }, {});

        const summary = {
            customerName: customer.name,
            phone: customer.phone,
            totalPolicies: policies.length,
            totalPremium,
            totalClaims: claims.length,
            totalClaimedAmount: totalBillAmount,
            totalBillAmount: totalClaimed,
            insurers: Object.values(byInsurer),
            vehicles: Object.values(byVehicle)
        };

        const mappedPolicies = policies.map((p: any) => ({
            id: p.id,
            policyNumber: p.policyNumber,
            customerName: customer.name,
            companyName: p.company?.name || '—',
            policyType: p.policyType.charAt(0).toUpperCase() + p.policyType.slice(1),
            productName: p.policyType === 'motor' ? `${p.make || ''} ${p.model || ''}`.trim() || 'Motor' : p.productName || '—',
            sumInsured: p.policyType === 'motor' ? (p.idv || 0) : (p.sumInsured || 0),
            vehicleClass: p.vehicleClass ? p.vehicleClass.replace(/_/g, ' ') : '—',
            vehicleNo: p.vehicleNumber || '—',
            totalPremium: p.totalPremium || p.premiumAmount || 0,
            startDate: fmtDate(p.startDate),
            expiryDate: fmtDate(p.expiryDate),
            status: p.status.charAt(0).toUpperCase() + p.status.slice(1),
        }));

        const mappedClaims = claims.map((c: any) => ({
            id: c.id,
            claimNumber: c.claimNumber || '—',
            policyNumber: c.policy?.policyNumber || '—',
            policyType: c.policy?.policyType || 'motor',
            productName: c.policy?.policyType === 'motor' ? `${c.policy.make || ''} ${c.policy.model || ''}`.trim() || 'Motor' : c.policy?.productName || '—',
            vehicleNumber: c.policy?.vehicleNumber || '—',
            claimDate: fmtDate(c.claimDate),
            claimAmount: c.claimAmount || 0,
            billAmount: c.billAmount || 0,
            status: c.status.charAt(0).toUpperCase() + c.status.slice(1),
            reason: c.reason || '—'
        }));

        const mappedExpiring = expiringPolicies.map((p: any) => {
            const diffTime = p.expiryDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return {
                id: p.id,
                policyNumber: p.policyNumber,
                policyType: p.policyType,
                productName: p.policyType === 'motor' ? `${p.make || ''} ${p.model || ''}`.trim() || 'Motor' : p.productName || '—',
                companyName: p.company?.name || '—',
                vehicleClass: p.vehicleClass ? p.vehicleClass.replace(/_/g, ' ') : '—',
                vehicleNo: p.vehicleNumber || '—',
                expiryDate: fmtDate(p.expiryDate),
                daysRemaining: diffDays > 0 ? `${diffDays} days` : 'Expiring today'
            };
        });

        return {
            columns: [
                { key: 'startDate', label: 'Start Date' },
                { key: 'policyNumber', label: 'Policy Number' },
                { key: 'vehicleNo', label: 'Vehicle No' },
                { key: 'vehicleClass', label: 'Vehicle Class' },
                { key: 'customerName', label: 'Customer' },
                { key: 'companyName', label: 'Insurer' },
                { key: 'totalPremium', label: 'Gross Premium (₹)' }
            ],
            data: mappedPolicies,
            summary,
            claims: mappedClaims,
            expiring: mappedExpiring,
            total: mappedPolicies.length
        };
    }

    private async queryPolicies(userId: string, role: string, filters?: ReportFilters, page = 1, limit = 50) {
        const where = buildPolicyWhere(userId, role, filters);
        const [rows, total] = await Promise.all([
            prisma.policy.findMany({
                where,
                include: { customer: true, company: true, dealer: true },
                orderBy: { startDate: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.policy.count({ where }),
        ]);

        const data = rows.map(mapPolicyStatus).map((r: any) => ({
            policyNumber: r.policyNumber || '—',
            customerName: r.customer?.name || '—',
            customerPhone: r.customer?.phone || '—',
            companyName: r.company?.name || '—',
            dealerName: r.dealer?.name || 'Direct',
            policyType: r.policyType,
            productName: r.policyType === 'motor' ? `${r.make || ''} ${r.model || ''}`.trim() || 'Motor' : r.productName || '—',
            make: r.make || '—',
            model: r.model || '—',
            vehicleNumber: r.vehicleNumber || '—',
            vehicleClass: r.vehicleClass?.replace(/_/g, ' ') || '—',
            od: r.od || 0,
            tp: r.tp || 0,
            premiumAmount: r.premiumAmount,
            tax: r.tax || 0,
            totalPremium: r.totalPremium || r.premiumAmount,
            sumInsured: r.policyType === 'motor' ? (r.idv || 0) : (r.sumInsured || 0),
            startDate: fmtDate(r.startDate),
            expiryDate: fmtDate(r.expiryDate),
            status: r.status,
            policyOrigin: r.policyOrigin === 'new_vehicle' ? 'New Vehicle'
                : r.policyOrigin === 'external_renewal' ? 'External Renewal'
                    : r.policyOrigin === 'in_system_renewal' ? 'Own Renewal'
                        : 'Fresh',
        }));

        return { data, total, columns: getColumnsForSource('policies', filters?.policyType) };
    }

    private async queryPoliciesExpired(userId: string, role: string, filters?: ReportFilters, page = 1, limit = 50) {
        const where = buildPolicyExpiredWhere(userId, role, filters);
        const [rows, total] = await Promise.all([
            prisma.policy.findMany({
                where,
                include: { customer: true, company: true, dealer: true },
                orderBy: { expiryDate: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.policy.count({ where }),
        ]);

        const data = rows.map(mapPolicyStatus).map((r: any) => ({
            policyNumber: r.policyNumber || '—',
            customerName: r.customer?.name || '—',
            customerPhone: r.customer?.phone || '—',
            companyName: r.company?.name || '—',
            dealerName: r.dealer?.name || 'Direct',
            policyType: r.policyType,
            productName: r.policyType === 'motor' ? `${r.make || ''} ${r.model || ''}`.trim() || 'Motor' : r.productName || '—',
            make: r.make || '—',
            model: r.model || '—',
            vehicleNumber: r.vehicleNumber || '—',
            vehicleClass: r.vehicleClass?.replace(/_/g, ' ') || '—',
            od: r.od || 0,
            tp: r.tp || 0,
            premiumAmount: r.premiumAmount,
            tax: r.tax || 0,
            totalPremium: r.totalPremium || r.premiumAmount,
            sumInsured: r.policyType === 'motor' ? (r.idv || 0) : (r.sumInsured || 0),
            startDate: fmtDate(r.startDate),
            expiryDate: fmtDate(r.expiryDate),
            status: r.status,
            ncbPercentage: r.ncbPercentage !== null && r.ncbPercentage !== undefined ? `${r.ncbPercentage}%` : '0%',
            policyOrigin: r.policyOrigin === 'new_vehicle' ? 'New Vehicle'
                : r.policyOrigin === 'external_renewal' ? 'External Renewal'
                    : r.policyOrigin === 'in_system_renewal' ? 'Own Renewal'
                        : 'Fresh',
        }));

        return { data, total, columns: getColumnsForSource('policies-expired', filters?.policyType) };
    }

    private async queryPayments(userId: string, role: string, filters?: ReportFilters, page = 1, limit = 50) {
        const where = buildPaymentWhere(userId, role, filters);
        const [rows, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    customer: true,
                    policy: {
                        include: {
                            company: true,
                            dealer: true
                        }
                    }
                },
                orderBy: { dueDate: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.payment.count({ where }),
        ]);

        const data = rows.map((r: any) => ({
            customerName: r.customer?.name || '—',
            policyNumber: r.policy?.policyNumber || '—',
            dealerName: r.policy?.dealer?.name || 'Direct',
            vehicleNumber: r.policy?.vehicleNumber || '—',
            startDate: fmtDate(r.policy?.startDate),
            companyName: r.policy?.company?.name || '—',
            paidAmount: r.paidAmount ?? 0,
            pendingAmount: Math.max(0, Number(r.amount ?? 0) - Number(r.paidAmount ?? 0)),
            vehicleClass: r.policy?.vehicleClass?.replace(/_/g, ' ') || '—',
            amount: r.amount,
            dueDate: fmtDate(r.dueDate),
            paidDate: (r.paidAmount > 0 && r.paidDate) ? fmtDate(r.paidDate) : '—',
            status: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '—',
            productName: r.policy?.policyType === 'motor' ? `${r.policy?.make || ''} ${r.policy?.model || ''}`.trim() || 'Motor' : r.policy?.productName || '—',
        }));

        return { data, total, columns: getColumnsForSource('payments', filters?.policyType) };
    }

    private async queryClaims(userId: string, role: string, filters?: ReportFilters, page = 1, limit = 50) {
        const where = buildClaimWhere(userId, role, filters);
        const [rows, total] = await Promise.all([
            prisma.claim.findMany({
                where,
                include: { customer: true, policy: { include: { company: true } } },
                orderBy: { claimDate: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.claim.count({ where }),
        ]);

        const data = rows.map((r: any) => ({
            claimDate: fmtDate(r.claimDate),
            claimNumber: r.claimNumber || '—',
            customerName: r.customer?.name || '—',
            policyNumber: r.policy?.policyNumber || '—',
            vehicleNumber: r.policy?.vehicleNumber || '—',
            make: r.policy?.make || '—',
            vehicleClass: r.policy?.vehicleClass?.replace(/_/g, ' ') || '—',
            companyName: r.policy?.company?.name || '—',
            claimAmount: r.claimAmount,
            status: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '—',
            reason: r.reason || '—',
            billAmount: r.billAmount ?? '—',
            surveyorName: r.surveyorName || '—',
            surveyorPhone: r.surveyorPhone || '—',
            workshopName: r.workshopName || '—',
            productName: r.policy?.policyType === 'motor' ? `${r.policy?.make || ''} ${r.policy?.model || ''}`.trim() || 'Motor' : r.policy?.productName || '—',
        }));

        return { data, total, columns: getColumnsForSource('claims', filters?.policyType) };
    }

    private async queryCustomers(userId: string, role: string, filters?: ReportFilters, page = 1, limit = 50) {
        const where = buildCustomerWhere(userId, role, filters);
        const [rows, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                include: {
                    policies: {
                        where: { deletedAt: null },
                        select: { premiumAmount: true, totalPremium: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.customer.count({ where }),
        ]);

        const data = rows.map((r: any) => ({
            name: r.name,
            phone: r.phone || '—',
            email: r.email || '—',
            address: r.address || '—',
            totalPolicies: r.policies?.length || 0,
            totalPremium: r.policies?.reduce((s: number, p: any) => s + (p.totalPremium || p.premiumAmount || 0), 0) || 0,
            createdAt: fmtDate(r.createdAt),
        }));

        return { data, total, columns: SOURCE_COLUMNS.customers };
    }

    private async queryFollowUps(userId: string, role: string, filters?: ReportFilters, page = 1, limit = 50) {
        const where = buildFollowUpWhere(userId, role, filters);
        const [rows, total] = await Promise.all([
            prisma.followUp.findMany({
                where,
                include: { customer: true, policy: true },
                orderBy: { nextFollowUpDate: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.followUp.count({ where }),
        ]);

        const data = rows.map((r: any) => ({
            customerName: r.customer?.name || '—',
            customerPhone: r.customer?.phone || '—',
            policyNumber: r.policy?.policyNumber || '—',
            vehicleNumber: r.policy?.vehicleNumber || '—',
            startDate: fmtDate(r.policy?.startDate),
            expiryDate: fmtDate(r.policy?.expiryDate),
            nextFollowUpDate: fmtDate(r.nextFollowUpDate),
            status: r.status,
            notes: r.notes || '—',
            productName: r.policy?.policyType === 'motor' ? `${r.policy?.make || ''} ${r.policy?.model || ''}`.trim() || 'Motor' : r.policy?.productName || '—',
        }));

        return { data, total, columns: getColumnsForSource('followups', filters?.policyType) };
    }

    private async queryOffers(userId: string, role: string, filters?: ReportFilters, page = 1, limit = 50) {
        const where = buildOfferWhere(userId, role, filters);
        const [rows, total] = await Promise.all([
            prisma.policyOffer.findMany({
                where,
                include: {
                    policy: { include: { customer: true } },
                    company: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.policyOffer.count({ where }),
        ]);

        const data = rows.map((r: any) => ({
            policyNumber: r.policy?.policyNumber || r.policy?.vehicleNumber || '—',
            customerName: r.policy?.customer?.name || '—',
            customerPhone: r.policy?.customer?.phone || '—',
            companyName: r.company?.name || '—',
            policyType: r.policy?.policyType ? r.policy.policyType.charAt(0).toUpperCase() + r.policy.policyType.slice(1) : 'Motor',
            vehicleNumber: r.policy?.vehicleNumber || '—',
            grossPremium: r.grossPremium,
            offerAmount: r.offerAmount,
            customerPayable: r.customerPayable,
            createdAt: fmtDate(r.createdAt),
            notes: r.notes || '—',
        }));

        return { data, total, columns: SOURCE_COLUMNS.offers };
    }

    private async groupOffers(userId: string, role: string, filters: ReportFilters | undefined, groupBy: ReportGroupBy) {
        const where = buildOfferWhere(userId, role, filters);

        if (groupBy === 'company') {
            const groups = await prisma.policyOffer.groupBy({
                by: ['companyId'],
                where,
                _count: { _all: true },
                _sum: { grossPremium: true, offerAmount: true, customerPayable: true },
            });
            const companyIds = groups.map((g: any) => g.companyId);
            const companies = await prisma.company.findMany({
                where: { id: { in: companyIds } },
                select: { id: true, name: true },
            });

            return {
                grouped: true,
                groupLabel: 'Company',
                columns: [
                    { key: 'name', label: 'Company' },
                    { key: 'count', label: 'Offers Count' },
                    { key: 'grossSum', label: 'Gross Premium (₹)' },
                    { key: 'offerSum', label: 'Total Discounts (₹)' },
                    { key: 'netSum', label: 'Net Customer Payable (₹)' },
                ],
                data: groups.map((g: any) => ({
                    name: companies.find((c) => c.id === g.companyId)?.name || 'Unknown',
                    count: g._count._all,
                    grossSum: g._sum.grossPremium || 0,
                    offerSum: g._sum.offerAmount || 0,
                    netSum: g._sum.customerPayable || 0,
                })).sort((a: any, b: any) => b.offerSum - a.offerSum),
                total: groups.length,
            };
        }

        if (groupBy === 'month') {
            const dateFrom = filters?.dateFrom ? new Date(filters.dateFrom) : undefined;
            const dateTo = filters?.dateTo ? new Date(filters.dateTo + 'T23:59:59.999Z') : undefined;

            const isGlobalRole = ['agent', 'staff', 'admin'].includes(role);
            const ownershipFilter = isGlobalRole
                ? Prisma.sql`1=1`
                : Prisma.sql`o."userId" = ${userId}::uuid`;

            const results: any[] = await prisma.$queryRaw`
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', o."createdAt"), 'Mon YYYY') AS name,
                    COUNT(*)::INT AS count,
                    SUM(o."grossPremium")::FLOAT AS "grossSum",
                    SUM(o."offerAmount")::FLOAT AS "offerSum",
                    SUM(o."customerPayable")::FLOAT AS "netSum"
                FROM "PolicyOffer" o
                WHERE 
                    ${ownershipFilter}
                    ${dateFrom ? Prisma.sql`AND o."createdAt" >= ${dateFrom}` : Prisma.empty}
                    ${dateTo ? Prisma.sql`AND o."createdAt" <= ${dateTo}` : Prisma.empty}
                    ${filters?.companyId ? Prisma.sql`AND o."companyId" = ${filters.companyId}` : Prisma.empty}
                GROUP BY DATE_TRUNC('month', o."createdAt")
                ORDER BY DATE_TRUNC('month', o."createdAt") DESC
            `;

            return {
                grouped: true,
                groupLabel: 'Month',
                columns: [
                    { key: 'name', label: 'Month' },
                    { key: 'count', label: 'Offers Count' },
                    { key: 'grossSum', label: 'Gross Premium (₹)' },
                    { key: 'offerSum', label: 'Total Discounts (₹)' },
                    { key: 'netSum', label: 'Net Customer Payable (₹)' },
                ],
                data: results,
                total: results.length,
            };
        }

        return null;
    }

    // ── Grouped aggregation queries ──────────────────────

    private async queryGrouped(userId: string, role: string, source: ReportSource, filters: ReportFilters | undefined, groupBy: ReportGroupBy) {
        if (source === 'offers') {
            return this.groupOffers(userId, role, filters, groupBy);
        }
        // We only support grouping on policies source for now (most common use case)
        // Other sources can be added the same way
        if (source === 'policies') {
            return this.groupPolicies(userId, role, filters, groupBy);
        }
        if (source === 'policies-expired') {
            return this.groupPolicies(userId, role, filters, groupBy, true);
        }
        if (source === 'payments') {
            return this.groupPayments(userId, role, filters, groupBy);
        }
        if (source === 'claims') {
            return this.groupClaims(userId, role, filters, groupBy);
        }
        // For unsupported combos, fall back to flat data
        return null;
    }

    private async groupPolicies(userId: string, role: string, filters: ReportFilters | undefined, groupBy: ReportGroupBy, useExpiredWhere = false) {
        const where = useExpiredWhere ? buildPolicyExpiredWhere(userId, role, filters) : buildPolicyWhere(userId, role, filters);

        if (groupBy === 'company') {
            const groups = await prisma.policy.groupBy({
                by: ['companyId'],
                where,
                _count: { _all: true },
                _sum: { premiumAmount: true, totalPremium: true },
            });
            const companyIds = groups.map((g: any) => g.companyId);
            const companies = await prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } });
            return {
                grouped: true,
                groupLabel: 'Company',
                columns: [
                    { key: 'name', label: 'Company' },
                    { key: 'count', label: 'Total Policies' },
                    { key: 'premiumSum', label: 'Premium (₹)' },
                    { key: 'totalPremiumSum', label: 'Total Premium (₹)' },
                ],
                data: groups.map((g: any) => ({
                    name: companies.find((c) => c.id === g.companyId)?.name || 'Unknown',
                    count: g._count._all,
                    premiumSum: g._sum.premiumAmount || 0,
                    totalPremiumSum: g._sum.totalPremium || 0,
                })).sort((a: any, b: any) => b.premiumSum - a.premiumSum),
                total: groups.length,
            };
        }

        if (groupBy === 'dealer') {
            const groups = await prisma.policy.groupBy({
                by: ['dealerId'],
                where: { ...where, dealerId: { not: null } },
                _count: { _all: true },
                _sum: { premiumAmount: true, totalPremium: true },
            });
            const dealerIds = groups.map((g: any) => g.dealerId).filter(Boolean) as string[];
            const dealers = await prisma.dealer.findMany({ where: { id: { in: dealerIds } }, select: { id: true, name: true } });
            return {
                grouped: true,
                groupLabel: 'Dealer',
                columns: [
                    { key: 'name', label: 'Dealer' },
                    { key: 'count', label: 'Total Policies' },
                    { key: 'premiumSum', label: 'Premium (₹)' },
                    { key: 'totalPremiumSum', label: 'Total Premium (₹)' },
                ],
                data: groups.map((g: any) => ({
                    name: dealers.find((d) => d.id === g.dealerId)?.name || 'Unknown',
                    count: g._count._all,
                    premiumSum: g._sum.premiumAmount || 0,
                    totalPremiumSum: g._sum.totalPremium || 0,
                })).sort((a: any, b: any) => b.premiumSum - a.premiumSum),
                total: groups.length,
            };
        }

        if (groupBy === 'policyType') {
            const groups = await prisma.policy.groupBy({
                by: ['policyType'],
                where,
                _count: { _all: true },
                _sum: { premiumAmount: true, totalPremium: true },
            });
            return {
                grouped: true,
                groupLabel: 'Policy Type',
                columns: [
                    { key: 'name', label: 'Policy Type' },
                    { key: 'count', label: 'Total Policies' },
                    { key: 'premiumSum', label: 'Premium (₹)' },
                    { key: 'totalPremiumSum', label: 'Total Premium (₹)' },
                ],
                data: groups.map((g: any) => ({
                    name: g.policyType,
                    count: g._count._all,
                    premiumSum: g._sum.premiumAmount || 0,
                    totalPremiumSum: g._sum.totalPremium || 0,
                })).sort((a: any, b: any) => b.premiumSum - a.premiumSum),
                total: groups.length,
            };
        }

        if (groupBy === 'vehicleClass') {
            const groups = await prisma.policy.groupBy({
                by: ['vehicleClass'],
                where: { ...where, vehicleClass: { not: null } },
                _count: { _all: true },
                _sum: { premiumAmount: true, totalPremium: true },
            });
            return {
                grouped: true,
                groupLabel: 'Vehicle Class',
                columns: [
                    { key: 'name', label: 'Vehicle Class' },
                    { key: 'count', label: 'Total Policies' },
                    { key: 'premiumSum', label: 'Premium (₹)' },
                    { key: 'totalPremiumSum', label: 'Total Premium (₹)' },
                ],
                data: groups.map((g: any) => ({
                    name: g.vehicleClass?.replace(/_/g, ' ') || 'N/A',
                    count: g._count._all,
                    premiumSum: g._sum.premiumAmount || 0,
                    totalPremiumSum: g._sum.totalPremium || 0,
                })).sort((a: any, b: any) => b.premiumSum - a.premiumSum),
                total: groups.length,
            };
        }

        if (groupBy === 'status') {
            const groups = await prisma.policy.groupBy({
                by: ['status'],
                where,
                _count: { _all: true },
                _sum: { premiumAmount: true, totalPremium: true },
            });
            return {
                grouped: true,
                groupLabel: 'Status',
                columns: [
                    { key: 'name', label: 'Status' },
                    { key: 'count', label: 'Total Policies' },
                    { key: 'premiumSum', label: 'Premium (₹)' },
                    { key: 'totalPremiumSum', label: 'Total Premium (₹)' },
                ],
                data: groups.map((g: any) => ({
                    name: g.status,
                    count: g._count._all,
                    premiumSum: g._sum.premiumAmount || 0,
                    totalPremiumSum: g._sum.totalPremium || 0,
                })).sort((a: any, b: any) => b.count - a.count),
                total: groups.length,
            };
        }

        if (groupBy === 'policyOrigin') {
            const groups = await prisma.policy.groupBy({
                by: ['policyOrigin'],
                where,
                _count: { _all: true },
                _sum: { premiumAmount: true, totalPremium: true },
            });
            const originLabels: Record<string, string> = {
                new_vehicle: 'New Vehicle',
                fresh: 'Fresh',
                external_renewal: 'External Renewal',
                in_system_renewal: 'Own Renewal',
            };
            return {
                grouped: true,
                groupLabel: 'Policy Origin',
                columns: [
                    { key: 'name', label: 'Origin' },
                    { key: 'count', label: 'Total Policies' },
                    { key: 'premiumSum', label: 'Premium (₹)' },
                    { key: 'totalPremiumSum', label: 'Total Premium (₹)' },
                ],
                data: groups.map((g: any) => ({
                    name: originLabels[g.policyOrigin] || g.policyOrigin,
                    count: g._count._all,
                    premiumSum: g._sum.premiumAmount || 0,
                    totalPremiumSum: g._sum.totalPremium || 0,
                })).sort((a: any, b: any) => b.count - a.count),
                total: groups.length,
            };
        }

        if (groupBy === 'month') {
            const dateFrom = filters?.dateFrom ? new Date(filters.dateFrom) : undefined;
            const dateTo = filters?.dateTo ? new Date(filters.dateTo + 'T23:59:59.999Z') : undefined;

            // Compute ownership filter in JS — avoids invalid ::text cast on a Prisma bind variable
            const isGlobalRole = ['agent', 'staff', 'admin'].includes(role);
            const ownershipFilter = isGlobalRole
                ? Prisma.sql`1=1`
                : Prisma.sql`"userId" = ${userId}::uuid`;

            // Use Raw SQL for efficient grouping in the database
            const results: any[] = await prisma.$queryRaw`
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', "startDate"), 'Mon YYYY') AS name,
                    COUNT(*)::INT AS count,
                    SUM("premiumAmount")::FLOAT AS "premiumSum",
                    SUM(COALESCE("totalPremium", "premiumAmount"))::FLOAT AS "totalPremiumSum"
                FROM "Policy"
                WHERE 
                    ${ownershipFilter}
                    AND "deletedAt" IS NULL
                    ${dateFrom ? Prisma.sql`AND "startDate" >= ${dateFrom}` : Prisma.empty}
                    ${dateTo ? Prisma.sql`AND "startDate" <= ${dateTo}` : Prisma.empty}
                    ${filters?.companyId ? Prisma.sql`AND "companyId" = ${filters.companyId}` : Prisma.empty}
                    ${filters?.dealerId ? Prisma.sql`AND "dealerId" = ${filters.dealerId}` : Prisma.empty}
                    ${filters?.policyType ? Prisma.sql`AND "policyType"::text = ${filters.policyType}` : Prisma.empty}
                GROUP BY DATE_TRUNC('month', "startDate")
                ORDER BY DATE_TRUNC('month', "startDate") DESC
            `;

            return {
                grouped: true,
                groupLabel: 'Month',
                columns: [
                    { key: 'name', label: 'Month' },
                    { key: 'count', label: 'Total Policies' },
                    { key: 'premiumSum', label: 'Premium (₹)' },
                    { key: 'totalPremiumSum', label: 'Total Premium (₹)' },
                ],
                data: results,
                total: results.length,
            };
        }

        return null;
    }

    private async groupPayments(userId: string, role: string, filters: ReportFilters | undefined, groupBy: ReportGroupBy) {
        const where = buildPaymentWhere(userId, role, filters);

        if (groupBy === 'status') {
            const groups = await prisma.payment.groupBy({
                by: ['status'],
                where,
                _count: { _all: true },
                _sum: { amount: true, paidAmount: true },
            });
            return {
                grouped: true,
                groupLabel: 'Payment Status',
                columns: [
                    { key: 'name', label: 'Status' },
                    { key: 'count', label: 'Total Payments' },
                    { key: 'amountSum', label: 'Total Amount (₹)' },
                    { key: 'paidSum', label: 'Paid Amount (₹)' },
                ],
                data: groups.map((g: any) => ({
                    name: g.status,
                    count: g._count._all,
                    amountSum: g._sum.amount || 0,
                    paidSum: g._sum.paidAmount || 0,
                })),
                total: groups.length,
            };
        }

        if (groupBy === 'month') {
            const dateFrom = filters?.dateFrom ? new Date(filters.dateFrom) : undefined;
            const dateTo = filters?.dateTo ? new Date(filters.dateTo + 'T23:59:59.999Z') : undefined;

            // Compute ownership filter in JS — avoids invalid ::text cast on a Prisma bind variable
            const isGlobalRoleP = ['agent', 'staff', 'admin'].includes(role);
            const ownershipFilterP = isGlobalRoleP
                ? Prisma.sql`1=1`
                : Prisma.sql`p."userId" = ${userId}::uuid`;

            const results: any[] = await prisma.$queryRaw`
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', p."dueDate"), 'Mon YYYY') AS name,
                    COUNT(*)::INT AS count,
                    SUM(p."amount")::FLOAT AS "amountSum",
                    SUM(COALESCE(p."paidAmount", 0))::FLOAT AS "paidSum"
                FROM "Payment" p
                ${(filters?.companyId || filters?.dealerId || filters?.policyType) ? Prisma.sql`JOIN "Policy" pol ON p."policyId" = pol."id"` : Prisma.empty}
                WHERE 
                    ${ownershipFilterP}
                    ${dateFrom ? Prisma.sql`AND p."dueDate" >= ${dateFrom}` : Prisma.empty}
                    ${dateTo ? Prisma.sql`AND p."dueDate" <= ${dateTo}` : Prisma.empty}
                    ${filters?.customerId ? Prisma.sql`AND p."customerId" = ${filters.customerId}` : Prisma.empty}
                    ${filters?.companyId ? Prisma.sql`AND pol."companyId" = ${filters.companyId}` : Prisma.empty}
                    ${filters?.dealerId ? Prisma.sql`AND pol."dealerId" = ${filters.dealerId}` : Prisma.empty}
                    ${filters?.policyType ? Prisma.sql`AND pol."policyType"::text = ${filters.policyType}` : Prisma.empty}
                GROUP BY DATE_TRUNC('month', p."dueDate")
                ORDER BY DATE_TRUNC('month', p."dueDate") DESC
            `;

            const columns = [
                { key: 'name', label: 'Month' },
                { key: 'count', label: 'Total Payments' },
                { key: 'amountSum', label: 'Total Amount (₹)' },
                { key: 'paidSum', label: 'Paid Amount (₹)' },
            ];
            return { grouped: true, groupLabel: 'Month', columns, data: results, total: results.length };
        }

        return null;
    }

    private async groupFollowUps(userId: string, role: string, filters: ReportFilters | undefined, groupBy: ReportGroupBy) {
        const where = buildFollowUpWhere(userId, role, filters);
        if (groupBy === 'status') {
            const groups = await prisma.followUp.groupBy({
                by: ['status'],
                where,
                _count: { _all: true },
            });
            return {
                grouped: true,
                groupLabel: 'Follow-up Status',
                columns: [
                    { key: 'name', label: 'Status' },
                    { key: 'count', label: 'Total Follow-ups' },
                ],
                data: groups.map((g: any) => ({
                    name: g.status,
                    count: g._count._all,
                })).sort((a: any, b: any) => b.count - a.count),
                total: groups.length,
            };
        }
        return null;
    }

    private async groupClaims(userId: string, role: string, filters: ReportFilters | undefined, groupBy: ReportGroupBy) {
        const where = buildClaimWhere(userId, role, filters);

        if (groupBy === 'status') {
            const groups = await prisma.claim.groupBy({
                by: ['status'],
                where,
                _count: { _all: true },
                _sum: { claimAmount: true, estimatedAmount: true, billAmount: true },
            });
            return {
                grouped: true,
                groupLabel: 'Status',
                columns: [
                    { key: 'name', label: 'Status' },
                    { key: 'count', label: 'Count' },
                    { key: 'claimSum', label: 'Claim Settled Total (₹)' },
                    { key: 'estimatedSum', label: 'Estimated Total (₹)' },
                    { key: 'billSum', label: 'Bill Total (₹)' },
                ],
                data: groups.map((g: any) => ({
                    name: g.status,
                    count: g._count._all,
                    claimSum: g._sum.claimAmount || 0,
                    estimatedSum: g._sum.estimatedAmount || 0,
                    billSum: g._sum.billAmount || 0,
                })),
                total: groups.length,
            };
        }

        if (groupBy === 'customer') {
            const groups = await prisma.claim.groupBy({
                by: ['customerId'],
                where,
                _count: { _all: true },
                _sum: { claimAmount: true, estimatedAmount: true, billAmount: true },
            });
            const customerIds = groups.map((g: any) => g.customerId);
            const customers = await prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } });
            return {
                grouped: true,
                groupLabel: 'Customer',
                columns: [
                    { key: 'name', label: 'Customer' },
                    { key: 'count', label: 'Total Claims' },
                    { key: 'claimSum', label: 'Claim Settled Total (₹)' },
                    { key: 'estimatedSum', label: 'Estimated Total (₹)' },
                    { key: 'billSum', label: 'Bill Total (₹)' },
                ],
                data: groups.map((g: any) => ({
                    name: customers.find((c) => c.id === g.customerId)?.name || 'Unknown',
                    count: g._count._all,
                    claimSum: g._sum.claimAmount || 0,
                    estimatedSum: g._sum.estimatedAmount || 0,
                    billSum: g._sum.billAmount || 0,
                })).sort((a: any, b: any) => b.claimSum - a.claimSum),
                total: groups.length,
            };
        }

        if (groupBy === 'month') {
            const dateFrom = filters?.dateFrom ? new Date(filters.dateFrom) : undefined;
            const dateTo = filters?.dateTo ? new Date(filters.dateTo + 'T23:59:59.999Z') : undefined;

            const isGlobalRoleC = ['agent', 'staff', 'admin'].includes(role);
            const ownershipFilterC = isGlobalRoleC
                ? Prisma.sql`1=1`
                : Prisma.sql`c."userId" = ${userId}::uuid`;

            const results: any[] = await prisma.$queryRaw`
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', c."claimDate"), 'Mon YYYY') AS name,
                    COUNT(*)::INT AS count,
                    SUM(COALESCE(c."billAmount", c."estimatedAmount", c."claimAmount", 0))::FLOAT AS "billSum",
                    SUM(COALESCE(c."claimAmount", 0))::FLOAT AS "claimSum"
                FROM "Claim" c
                ${(filters?.companyId || filters?.dealerId || filters?.policyType) ? Prisma.sql`JOIN "Policy" pol ON c."policyId" = pol."id"` : Prisma.empty}
                WHERE 
                    ${ownershipFilterC}
                    ${dateFrom ? Prisma.sql`AND c."claimDate" >= ${dateFrom}` : Prisma.empty}
                    ${dateTo ? Prisma.sql`AND c."claimDate" <= ${dateTo}` : Prisma.empty}
                    ${filters?.customerId ? Prisma.sql`AND c."customerId" = ${filters.customerId}` : Prisma.empty}
                    ${filters?.companyId ? Prisma.sql`AND pol."companyId" = ${filters.companyId}` : Prisma.empty}
                    ${filters?.dealerId ? Prisma.sql`AND pol."dealerId" = ${filters.dealerId}` : Prisma.empty}
                    ${filters?.policyType ? Prisma.sql`AND pol."policyType"::text = ${filters.policyType}` : Prisma.empty}
                GROUP BY DATE_TRUNC('month', c."claimDate")
                ORDER BY DATE_TRUNC('month', c."claimDate") DESC
            `;

            const columns = [
                { key: 'name', label: 'Month' },
                { key: 'count', label: 'Total Claims' },
                { key: 'billSum', label: 'Claimed Amount (₹)' },
                { key: 'claimSum', label: 'Settled Amount (₹)' },
            ];
            return { grouped: true, groupLabel: 'Month', columns, data: results, total: results.length };
        }

        return null;
    }

    // ── Public API ───────────────────────────────────────

    async generateReport(userId: string, role: string, params: GenerateParams) {
        const { source, filters, groupBy, page, limit } = params;

        // If groupBy is requested, use aggregation
        if (groupBy) {
            const grouped = await this.queryGrouped(userId, role, source, filters, groupBy);
            if (grouped) return grouped;
        }

        // Flat data query
        const queryMap: Record<string, Function> = {
            policies: () => this.queryPolicies(userId, role, filters, page, limit),
            'policies-expired': () => this.queryPoliciesExpired(userId, role, filters, page, limit),
            payments: () => this.queryPayments(userId, role, filters, page, limit),
            claims: () => this.queryClaims(userId, role, filters, page, limit),
            customers: () => this.queryCustomers(userId, role, filters, page, limit),
            followups: () => this.queryFollowUps(userId, role, filters, page, limit),
            offers: () => this.queryOffers(userId, role, filters, page, limit),
            'customer-snapshot': () => this.queryCustomerSnapshot(userId, role, filters),
            'customer-snapshot-full': () => this.queryCustomerSnapshot(userId, role, filters),
            'customer-snapshot-claims': async () => {
                const res = await this.queryCustomerSnapshot(userId, role, filters);
                return {
                    columns: [
                        { key: 'claimNumber', label: 'Claim No' },
                        { key: 'policyNumber', label: 'Policy No' },
                        { key: 'vehicleNumber', label: 'Vehicle No' },
                        { key: 'claimDate', label: 'Claim Date' },
                        { key: 'billAmount', label: 'Bill Amount (₹)' },
                        { key: 'claimAmount', label: 'Claim Settled Amount (₹)' },
                        { key: 'status', label: 'Status' },
                    ],
                    data: res.claims || [],
                    total: (res.claims || []).length
                };
            },
            'customer-snapshot-expiring': async () => {
                const res = await this.queryCustomerSnapshot(userId, role, filters);
                return {
                    columns: [
                        { key: 'policyNumber', label: 'Policy No' },
                        { key: 'companyName', label: 'Insurer' },
                        { key: 'vehicleClass', label: 'Vehicle Class' },
                        { key: 'vehicleNo', label: 'Vehicle No' },
                        { key: 'expiryDate', label: 'Expiry Date' },
                        { key: 'daysRemaining', label: 'Days Left' },
                    ],
                    data: res.expiring || [],
                    total: (res.expiring || []).length
                };
            }
        };

        const result = await queryMap[source]();

        let chartsData = null;
        if (!groupBy) {
            if (source === 'policies' || source === 'policies-expired') {
                const useExpired = source === 'policies-expired';
                const [statusGroup, typeGroup] = await Promise.all([
                    this.groupPolicies(userId, role, filters, 'status', useExpired),
                    this.groupPolicies(userId, role, filters, 'policyType', useExpired)
                ]);
                chartsData = {
                    status: statusGroup?.data || [],
                    policyType: typeGroup?.data || []
                };
            } else if (source === 'payments') {
                const statusGroup = await this.groupPayments(userId, role, filters, 'status');
                chartsData = {
                    status: statusGroup?.data || []
                };
            } else if (source === 'claims') {
                const statusGroup = await this.groupClaims(userId, role, filters, 'status');
                chartsData = {
                    status: statusGroup?.data || []
                };
            } else if (source === 'followups') {
                const statusGroup = await this.groupFollowUps(userId, role, filters, 'status');
                chartsData = {
                    status: statusGroup?.data || []
                };
            } else if (source === 'offers') {
                const companyGroup = await this.groupOffers(userId, role, filters, 'company');
                chartsData = {
                    status: (companyGroup?.data || []).map((d: any) => ({
                        ...d,
                        totalPremiumSum: d.offerSum || 0,
                    }))
                };
            }
        }

        return {
            grouped: false,
            ...result,
            chartsData,
            page,
            limit,
            totalPages: Math.ceil(result.total / limit),
        };
    }

    // ── Dashboard analytics (pre-computed) ───────────────

    async getDashboardReport(userId: string, role: string, filters?: { dateFrom?: string; dateTo?: string }) {
        // IST-aware month start
        const nowISTStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()); // YYYY-MM-DD
        const [y, m] = nowISTStr.split('-').map(Number);
        const thisMonthStartStr = `${y}-${String(m).padStart(2, '0')}-01`;

        // When the user provides date filters, use those; otherwise default to current month
        const periodFilters: ReportFilters = filters?.dateFrom || filters?.dateTo
            ? filters
            : { dateFrom: thisMonthStartStr };

        const ow = ownerFilter(userId, role);

        // For KPI cards — filter by policy startDate (inception date), NOT createdAt (entry date).
        // Reason: users may enter historical/backdated policies into a newly launched system,
        // which would falsely inflate "This Month" figures if we counted by entry date.
        // Using startDate ensures the dashboard reflects actual business done in the period.
        const kpiWhere: any = { ...ow, deletedAt: null };
        kpiWhere.startDate = {};
        if (periodFilters.dateFrom) kpiWhere.startDate.gte = getStartOfDayIST(periodFilters.dateFrom);
        if (periodFilters.dateTo) kpiWhere.startDate.lte = getEndOfDayIST(periodFilters.dateTo);
        if (Object.keys(kpiWhere.startDate).length === 0) {
            delete kpiWhere.startDate;
        }

        const claimsWhere: any = { ...ow };
        claimsWhere.claimDate = {};
        if (periodFilters.dateFrom) claimsWhere.claimDate.gte = getStartOfDayIST(periodFilters.dateFrom);
        if (periodFilters.dateTo) claimsWhere.claimDate.lte = getEndOfDayIST(periodFilters.dateTo);
        if (Object.keys(claimsWhere.claimDate).length === 0) {
            delete claimsWhere.claimDate;
        }

        const [
            companyPerformance,
            policyTypeBreakdown,
            dealerPerformance,
            monthlyTrend,
            paymentSummary,
            renewalStats,
            periodCount,
            periodPremium,
            vehicleClassPerformance,
            claimsTrend,
            periodClaims,
        ] = await Promise.all([
            // Company-wise performance (filtered)
            this.groupPolicies(userId, role, periodFilters, 'company'),

            // Policy type breakdown (filtered)
            this.groupPolicies(userId, role, periodFilters, 'policyType'),

            // Dealer performance (filtered)
            this.groupPolicies(userId, role, periodFilters, 'dealer'),

            // Monthly premium trend (filtered)
            this.groupPolicies(userId, role, periodFilters, 'month'),

            // Payment collection summary (filtered)
            this.groupPayments(userId, role, periodFilters, 'status'),

            // Renewal stats (all-time — not date-sensitive as a concept)
            prisma.$transaction([
                prisma.policy.count({
                    where: { ...ow, deletedAt: null, parentPolicyId: { not: null } },
                }),
                prisma.policy.count({
                    where: { ...ow, deletedAt: null, status: 'expired' },
                }),
            ]),

            // Period policies count
            prisma.policy.count({ where: kpiWhere }),

            // Period premium total
            prisma.policy.aggregate({
                where: kpiWhere,
                _sum: { premiumAmount: true, totalPremium: true },
            }),

            // Vehicle Class performance (filtered)
            this.groupPolicies(userId, role, periodFilters, 'vehicleClass'),

            // Claims month-wise trend (filtered)
            this.groupClaims(userId, role, periodFilters, 'month'),

            // Claims summary for the period
            prisma.claim.findMany({
                where: claimsWhere,
                select: {
                    id: true,
                    status: true,
                    claimAmount: true,
                    estimatedAmount: true,
                    billAmount: true,
                },
            }),
        ]);

        const [renewedCount, expiredCount] = renewalStats;
        const totalRev = (periodPremium as any)?._sum?.totalPremium || (periodPremium as any)?._sum?.premiumAmount || 0;

        const totalClaimCount = periodClaims.length;
        const totalClaimAmount = periodClaims.reduce((sum: number, c: any) => sum + (c.estimatedAmount || c.claimAmount || c.billAmount || 0), 0);
        const settledClaims = periodClaims.filter((c: any) => c.status === 'settled');
        const settledCount = settledClaims.length;
        const settledAmount = settledClaims.reduce((sum: number, c: any) => sum + (c.claimAmount || c.billAmount || c.estimatedAmount || 0), 0);
        const openClaims = periodClaims.filter((c: any) => c.status === 'filed' || c.status === 'approved');
        const openCount = openClaims.length;
        const openAmount = openClaims.reduce((sum: number, c: any) => sum + (c.estimatedAmount || c.claimAmount || c.billAmount || 0), 0);
        const rejectedClaims = periodClaims.filter((c: any) => c.status === 'rejected');
        const settlementRate = totalClaimCount > 0 ? Math.round((settledCount / totalClaimCount) * 100) : 0;

        return {
            companyPerformance,
            policyTypeBreakdown,
            dealerPerformance,
            monthlyTrend,
            paymentSummary,
            vehicleClassPerformance,
            claimsTrend,
            renewalStats: {
                renewed: renewedCount,
                expired: expiredCount,
                successRate: (renewedCount + expiredCount) > 0
                    ? Math.round((renewedCount / (renewedCount + expiredCount)) * 100)
                    : 0,
            },
            claimsSummary: {
                totalCount: totalClaimCount,
                totalAmount: totalClaimAmount,
                settledCount,
                settledAmount,
                openCount,
                openAmount,
                rejectedCount: rejectedClaims.length,
                settlementRate,
            },
            // Key label for the UI — tells the frontend if it's filtered or default
            periodLabel: (filters?.dateFrom || filters?.dateTo) ? 'Selected Period' : 'This Month',
            thisMonth: {
                policiesAdded: periodCount,
                totalPremium: totalRev,
                netPremium: (periodPremium as any)?._sum?.premiumAmount || 0,
                tax: ((periodPremium as any)?._sum?.totalPremium || 0) - ((periodPremium as any)?._sum?.premiumAmount || 0),
            },
        };
    }

    // ── Export to XLSX ────────────────────────────────────

    async exportXlsx(data: any[], columns: { key: string; label: string }[], title?: string): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'InsureCRM Pro';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(title || 'Report');

        // Header row
        sheet.columns = columns.map((col) => ({
            header: col.label,
            key: col.key,
            width: Math.max(col.label.length + 5, 15),
        }));

        // Style header
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4338CA' },
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 28;

        // Data rows
        for (const row of data) {
            sheet.addRow(row);
        }

        // Style data rows with alternating colors
        for (let i = 2; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);
            row.alignment = { vertical: 'middle' };
            if (i % 2 === 0) {
                row.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5F3FF' },
                };
            }
        }

        // Auto-filter
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: columns.length },
        };

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    // ── Export to PDF ─────────────────────────────────────

    async exportPdf(data: any[], columns: { key: string; label: string }[], title?: string, filters?: any, source?: string): Promise<Buffer> {
        if (source === 'payments') {
            const order = ['startDate', 'customerName', 'policyNumber', 'vehicleNumber', 'vehicleClass', 'companyName', 'dealerName', 'status', 'paidAmount', 'amount', 'pendingAmount'];
            columns = order
                .map(key => columns.find(c => c.key === key))
                .filter((c): c is { key: string; label: string } => !!c);
        }

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Date range formatting
            let dateRangeStr = '';
            if (filters?.dateFrom || filters?.dateTo || filters?.startDate || filters?.endDate) {
                const formatFilterDate = (dStr?: string) => {
                    if (!dStr) return '—';
                    try {
                        const date = new Date(dStr);
                        if (isNaN(date.getTime())) return dStr;
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = date.getFullYear();
                        return `${day}/${month}/${year}`;
                    } catch {
                        return dStr;
                    }
                };

                const startRaw = filters.dateFrom || filters.startDate;
                const endRaw = filters.dateTo || filters.endDate;
                const startFormatted = formatFilterDate(startRaw);
                const endFormatted = formatFilterDate(endRaw);
                dateRangeStr = `Period: ${startFormatted} to ${endFormatted}`;
            }

            // Title
            doc.fontSize(18).font('Helvetica-Bold')
                .fillColor('#1e1b4b')
                .text(title || 'Report', { align: 'center' });
            doc.moveDown(0.2);

            doc.fontSize(9).font('Helvetica')
                .fillColor('#6b7280')
                .text(`Generated on ${new Date().toLocaleDateString('en-IN')} | InsureCRM Pro`, { align: 'center' });

            if (dateRangeStr) {
                doc.moveDown(0.15);
                doc.fontSize(9).font('Helvetica-Bold')
                    .fillColor('#374151')
                    .text(dateRangeStr, { align: 'center' });
            }
            doc.moveDown(0.8);

            // Table
            const sNoCol = { key: 'sNo', label: 'S.No.' };
            const isFullWidthReport = source === 'policies' || source === 'policies-expired' || source === 'payments' || source === 'claims';
            const limitCols = isFullWidthReport ? columns.length : 8;
            let pdfCols = columns.slice(0, limitCols);
            if (source === 'claims') {
                pdfCols = pdfCols.filter(c => c.key !== 'status' && c.key !== 'reason' && c.key !== 'surveyorName' && c.key !== 'surveyorPhone' && c.key !== 'workshopName');
            }
            const visibleCols = [sNoCol, ...pdfCols]; // Prepend S.No.
            const startX = 40;

            // Width allocation: S.No is 35 points wide, others share the rest equally
            const otherColWidth = visibleCols.length > 1
                ? Math.min(((doc.page.width - 80) - 35) / (visibleCols.length - 1), 120)
                : 120;
            const getColWidth = (colKey: string): number => {
                if (source === 'claims') {
                    const widths: Record<string, number> = {
                        sNo: 20,
                        claimDate: 65,
                        claimNumber: 95,
                        customerName: 100,
                        policyNumber: 110,
                        vehicleNumber: 65,
                        make: 50,
                        vehicleClass: 45,
                        companyName: 90,
                        claimAmount: 60,
                        billAmount: 60
                    };
                    return widths[colKey] || otherColWidth;
                }
                if (source === 'payments') {
                    const widths: Record<string, number> = {
                        sNo: 25,
                        startDate: 60,
                        customerName: 100,
                        policyNumber: 115,
                        vehicleNumber: 65,
                        vehicleClass: 45,
                        paidAmount: 55,
                        pendingAmount: 55,
                        amount: 55,
                        dealerName: 65,
                        companyName: 75,
                        status: 45
                    };
                    return widths[colKey] || otherColWidth;
                }
                if (source === 'policies-expired') {
                    const widths: Record<string, number> = {
                        sNo: 25,
                        startDate: 50,
                        expiryDate: 50,
                        customerName: 120,
                        policyNumber: 100,
                        make: 45,
                        model: 45,
                        vehicleNumber: 60,
                        vehicleClass: 45,
                        companyName: 75,
                        customerPhone: 55,
                        totalPremium: 75,
                        ncbPercentage: 30
                    };
                    return widths[colKey] || otherColWidth;
                }
                if (source === 'policies') {
                    const widths: Record<string, number> = {
                        sNo: 25,
                        startDate: 50,
                        customerName: 130,
                        policyNumber: 115,
                        make: 45,
                        model: 45,
                        vehicleNumber: 65,
                        vehicleClass: 45,
                        companyName: 80,
                        customerPhone: 55,
                        totalPremium: 75
                    };
                    return widths[colKey] || otherColWidth;
                }
                return colKey === 'sNo' ? 35 : otherColWidth;
            };

            const isPolicyReport = source === 'policies' || source === 'policies-expired';
            const headerHeight = isPolicyReport ? 28 : 22;

            const drawHeaders = (yCoord: number) => {
                doc.fontSize(8).font('Helvetica-Bold');
                let hX = startX;
                for (const col of visibleCols) {
                    const w = getColWidth(col.key);
                    // Background color for header
                    doc.rect(hX, yCoord, w, headerHeight).fill('#1e1b4b');
                    // Header Border
                    doc.lineWidth(0.2).rect(hX, yCoord, w, headerHeight).stroke('#ffffff');
                    // Replace Rupee symbol with Rs. to avoid PDFKit character rendering issues
                    const labelText = col.label.replace(/₹/g, 'Rs.');
                    // Dynamically calculate height of text to center it perfectly vertically
                    const textHeight = doc.heightOfString(labelText, { width: w - 4 });
                    const yOffset = (headerHeight - textHeight) / 2;
                    // Draw header text centered
                    doc.fillColor('#FFFFFF')
                        .text(labelText, hX + 2, yCoord + yOffset, {
                            width: w - 4,
                            align: 'center'
                        });
                    hX += w;
                }
                doc.y = yCoord + headerHeight;
            };

            // Draw initial headers
            drawHeaders(doc.y);

            // Data rows
            let rowIdx = 0;
            const defaultRowHeight = isPolicyReport ? 22 : 18;
            for (const row of data) {
                // Determine horizontal alignment and columns that can wrap
                const wrapColumns = ['customerName', 'make', 'model', 'companyName', 'policyNumber', 'claimNumber', 'vehicleNumber'];

                // First pass: pre-calculate row height dynamically based on the maximum wrapped text height
                let maxTextHeight = 8;
                for (const col of visibleCols) {
                    const w = getColWidth(col.key);
                    let val = '—';
                    if (col.key === 'sNo') {
                        val = String(rowIdx + 1);
                    } else {
                        val = String(row[col.key] ?? '—');
                        if (typeof row[col.key] === 'number' && (col.key.toLowerCase().includes('premium') || col.key.toLowerCase().includes('amount') || col.key === 'od' || col.key === 'tp' || col.key === 'tax')) {
                            val = row[col.key].toLocaleString('en-IN');
                        }
                    }

                    const isWrapColumn = wrapColumns.includes(col.key);
                    const textHeight = doc.heightOfString(val, {
                        width: w - 8,
                        lineBreak: isWrapColumn
                    });
                    if (textHeight > maxTextHeight) {
                        maxTextHeight = textHeight;
                    }
                }

                const currentRowHeight = Math.max(defaultRowHeight, Math.round(maxTextHeight + 8));

                // Page overflow check (using dynamic row height)
                if (doc.y + currentRowHeight > doc.page.height - 60) {
                    doc.addPage();
                    drawHeaders(40);
                }

                let x = startX;
                const rowY = doc.y; // Fix: lock Y coordinate for this specific row data
                const bgColor = rowIdx % 2 === 0 ? '#F9FAFB' : '#FFFFFF';

                for (const col of visibleCols) {
                    const w = getColWidth(col.key);
                    let val = '—';
                    if (col.key === 'sNo') {
                        val = String(rowIdx + 1);
                    } else {
                        val = String(row[col.key] ?? '—');
                        if (typeof row[col.key] === 'number' && (col.key.toLowerCase().includes('premium') || col.key.toLowerCase().includes('amount') || col.key === 'od' || col.key === 'tp' || col.key === 'tax')) {
                            val = row[col.key].toLocaleString('en-IN');
                        }
                    }

                    // Row background
                    doc.rect(x, rowY, w, currentRowHeight).fill(bgColor);

                    // Cell Border (Darker for visibility)
                    doc.lineWidth(0.2).rect(x, rowY, w, currentRowHeight).stroke('#d1d5db');

                    // Determine horizontal alignment based on data type
                    let align: 'center' | 'left' | 'right' = 'left';
                    if (col.key === 'sNo' || col.key === 'startDate' || col.key === 'expiryDate' || col.key === 'vehicleClass' || col.key === 'ncbPercentage' || col.key === 'customerPhone' || col.key === 'claimDate') {
                        align = 'center';
                    } else if (col.key.toLowerCase().includes('premium') || col.key.toLowerCase().includes('amount') || col.key === 'od' || col.key === 'tp' || col.key === 'tax') {
                        align = 'right';
                    }

                    // Calculate text height for vertical centering in the dynamically expanded row
                    const isWrapColumn = wrapColumns.includes(col.key);
                    const textHeight = doc.heightOfString(val, {
                        width: w - 8,
                        lineBreak: isWrapColumn
                    });
                    const yOffset = (currentRowHeight - textHeight) / 2;

                    doc.font('Helvetica').fontSize(7).fillColor('#374151')
                        .text(val, x + 4, rowY + yOffset, {
                            width: w - 8,
                            align: align,
                            lineBreak: isWrapColumn
                        });

                    x += w;
                }

                // Explicitly step down to the next row safely using the dynamic height
                doc.y = rowY + currentRowHeight;
                rowIdx++;
            }

            // Footer
            doc.moveDown(0.5);

            const isPaymentsReport = title?.includes('Payments') || title?.includes('payments');
            const neededSpace = isPaymentsReport ? 100 : 60;
            if (doc.y > doc.page.height - neededSpace) {
                doc.addPage();
                doc.y = 40;
            }

            const footerY = doc.y;

            // Calculate and display premium total if applicable
            const hasTotalPremium = columns.some(c => c.key === 'totalPremium');

            if (data.length > 0) {
                // Calculate the exact full width of the table
                let tableWidth = 0;
                for (const col of visibleCols) {
                    tableWidth += getColWidth(col.key);
                }

                if (hasTotalPremium) {
                    const totalPremiumSum = data.reduce((sum, row) => {
                        const val = Number(row.totalPremium ?? 0);
                        return sum + (isNaN(val) ? 0 : val);
                    }, 0);

                    // Draw the full-width Total Premium Sum footer bar
                    doc.rect(startX, footerY - 5, tableWidth, 24).fill('#f1f5f9');
                    doc.lineWidth(0.5).rect(startX, footerY - 5, tableWidth, 24).stroke('#cbd5e1');

                    doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e1b4b')
                        .text(`Total Premium: ${totalPremiumSum.toLocaleString('en-IN')}`, startX + tableWidth - 310, footerY + 2, { width: 300, align: 'right' });
                } else if (isPaymentsReport) {
                    const totalPaid = data.reduce((sum, row) => sum + Number(row.paidAmount ?? 0), 0);
                    const totalPending = data.reduce((sum, row) => sum + Number(row.pendingAmount ?? 0), 0);
                    const totalPremium = data.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

                    const cardWidth = 240;
                    const cardHeight = 65;

                    // Draw a standalone summary card on the bottom-left
                    doc.rect(startX, footerY + 5, cardWidth, cardHeight).fill('#f8fafc');
                    doc.lineWidth(0.5).rect(startX, footerY + 5, cardWidth, cardHeight).stroke('#cbd5e1');

                    // Card Title
                    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e1b4b')
                        .text('PAYMENTS SUMMARY', startX + 10, footerY + 12);

                    // Row 1: Total Premium
                    doc.fontSize(8).font('Helvetica').fillColor('#475569')
                        .text('Total Premium:', startX + 10, footerY + 26);
                    doc.font('Helvetica-Bold').fillColor('#1e1b4b')
                        .text(`Rs. ${totalPremium.toLocaleString('en-IN')}`, startX + 100, footerY + 26, { width: cardWidth - 110, align: 'right' });

                    // Row 2: Total Paid
                    doc.fontSize(8).font('Helvetica').fillColor('#475569')
                        .text('Total Paid:', startX + 10, footerY + 38);
                    doc.font('Helvetica-Bold').fillColor('#16a34a')
                        .text(`Rs. ${totalPaid.toLocaleString('en-IN')}`, startX + 100, footerY + 38, { width: cardWidth - 110, align: 'right' });

                    // Row 3: Total Pending (Red, bold, high contrast)
                    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#b91c1c')
                        .text('Total Pending:', startX + 10, footerY + 50);
                    doc.font('Helvetica-Bold').fillColor('#b91c1c')
                        .text(`Rs. ${totalPending.toLocaleString('en-IN')}`, startX + 100, footerY + 50, { width: cardWidth - 110, align: 'right' });
                }
            }

            doc.end();
        });
    }

    async exportCustomerSnapshotXlsx(result: any, title?: string): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'InsureCRM Pro';
        workbook.created = new Date();

        const summary = result.summary || {};

        // ─── Sheet 1: Summary ─────────────────────────────
        const summarySheet = workbook.addWorksheet('Summary');
        summarySheet.views = [{ showGridLines: true }];

        summarySheet.addRow(['CUSTOMER INSURANCE PORTFOLIO STATEMENT']).font = { bold: true, size: 16, color: { argb: 'FF1E1B4B' } };
        summarySheet.addRow([]);

        summarySheet.addRow(['Customer Name:', summary.customerName || '—']).font = { bold: true };
        summarySheet.addRow(['Customer Phone:', summary.phone || '—']).font = { bold: true };
        summarySheet.addRow(['Generated On:', new Date().toLocaleDateString('en-IN')]);
        summarySheet.addRow([]);

        // Metrics Table
        summarySheet.addRow(['Key Portfolio Metrics']).font = { bold: true, size: 12 };
        summarySheet.addRow(['Metric', 'Value']);
        summarySheet.addRow(['Total Policies Written', summary.totalPolicies || 0]);
        summarySheet.addRow(['Total Premium Paid', summary.totalPremium || 0]);
        summarySheet.addRow(['Total Claims Made', summary.totalClaims || 0]);
        summarySheet.addRow(['Total Bill Amount', summary.totalClaimedAmount || 0]);
        summarySheet.addRow(['Total Claim Settled Amount', summary.totalBillAmount || 0]);

        // Style Metrics Table
        const metricsHeaderRow = summarySheet.getRow(8);
        metricsHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        metricsHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
        for (let i = 9; i <= 13; i++) {
            summarySheet.getRow(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
            summarySheet.getRow(i).getCell(2).numFmt = i === 9 || i === 11 ? '#,##0' : '"₹"#,##0';
        }
        summarySheet.addRow([]);

        // Insurer breakdown
        summarySheet.addRow(['Portfolio Share by Insurer']).font = { bold: true, size: 12 };
        summarySheet.addRow(['Insurer', 'Policies', 'Premium']);
        const insurerHeaderRow = summarySheet.getRow(16);
        insurerHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        insurerHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };

        let curInsRow = 17;
        for (const ins of (summary.insurers || [])) {
            summarySheet.addRow([ins.name, ins.count, ins.premium]);
            summarySheet.getRow(curInsRow).getCell(3).numFmt = '"₹"#,##0';
            curInsRow++;
        }
        summarySheet.addRow([]);

        // Vehicle breakdown
        summarySheet.addRow(['Portfolio Share by Vehicle']).font = { bold: true, size: 12 };
        const vehHeaderIdx = curInsRow + 2;
        summarySheet.addRow(['Vehicle Class', 'Policies', 'Premium']);
        const vehHeaderRow = summarySheet.getRow(vehHeaderIdx);
        vehHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        vehHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };

        let curVehRow = vehHeaderIdx + 1;
        for (const veh of (summary.vehicles || [])) {
            summarySheet.addRow([veh.name ? veh.name.replace(/_/g, ' ') : 'Other', veh.count, veh.premium]);
            summarySheet.getRow(curVehRow).getCell(3).numFmt = '"₹"#,##0';
            curVehRow++;
        }

        // ─── Sheet 2: Policies Written ────────────────────
        const policiesSheet = workbook.addWorksheet('Policies Written');
        policiesSheet.columns = [
            { header: 'Policy Number', key: 'policyNumber', width: 25 },
            { header: 'Insurer', key: 'companyName', width: 25 },
            { header: 'Type', key: 'policyType', width: 15 },
            { header: 'Product / Plan Name', key: 'productName', width: 25 },
            { header: 'Vehicle Class', key: 'vehicleClass', width: 20 },
            { header: 'Vehicle No', key: 'vehicleNo', width: 18 },
            { header: 'Sum Insured / IDV', key: 'sumInsured', width: 18 },
            { header: 'Gross Premium', key: 'totalPremium', width: 18 },
            { header: 'Start Date', key: 'startDate', width: 15 },
            { header: 'Expiry Date', key: 'expiryDate', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
        ];
        policiesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        policiesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
        for (const row of result.data || []) {
            policiesSheet.addRow(row);
        }
        for (let i = 2; i <= policiesSheet.rowCount; i++) {
            policiesSheet.getRow(i).getCell(7).numFmt = '"₹"#,##0'; // Sum Insured
            policiesSheet.getRow(i).getCell(8).numFmt = '"₹"#,##0'; // Gross Premium
            if (i % 2 === 0) policiesSheet.getRow(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
        }

        // ─── Sheet 3: Claims Filed ────────────────────────
        const claimsSheet = workbook.addWorksheet('Claims Filed');
        claimsSheet.columns = [
            { header: 'Claim Number', key: 'claimNumber', width: 25 },
            { header: 'Policy Number', key: 'policyNumber', width: 25 },
            { header: 'Vehicle No', key: 'vehicleNumber', width: 18 },
            { header: 'Claim Date', key: 'claimDate', width: 15 },
            { header: 'Bill Amount (₹)', key: 'billAmount', width: 18 },
            { header: 'Claim Settled Amount (₹)', key: 'claimAmount', width: 18 },
            { header: 'Status', key: 'status', width: 15 },
        ];
        claimsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        claimsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE123C' } };
        for (const row of result.claims || []) {
            claimsSheet.addRow(row);
        }
        for (let i = 2; i <= claimsSheet.rowCount; i++) {
            claimsSheet.getRow(i).getCell(5).numFmt = '"₹"#,##0';
            claimsSheet.getRow(i).getCell(6).numFmt = '"₹"#,##0';
            if (i % 2 === 0) claimsSheet.getRow(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
        }

        // ─── Sheet 4: Expiring Soon ───────────────────────
        const expiringSheet = workbook.addWorksheet('Expiring Soon');
        expiringSheet.columns = [
            { header: 'Policy Number', key: 'policyNumber', width: 25 },
            { header: 'Insurer', key: 'companyName', width: 25 },
            { header: 'Type', key: 'policyType', width: 15 },
            { header: 'Product / Plan Name', key: 'productName', width: 25 },
            { header: 'Vehicle Class', key: 'vehicleClass', width: 20 },
            { header: 'Vehicle No', key: 'vehicleNo', width: 18 },
            { header: 'Expiry Date', key: 'expiryDate', width: 15 },
            { header: 'Days Remaining', key: 'daysRemaining', width: 18 },
        ];
        expiringSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        expiringSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
        for (const row of result.expiring || []) {
            expiringSheet.addRow(row);
        }
        for (let i = 2; i <= expiringSheet.rowCount; i++) {
            if (i % 2 === 0) expiringSheet.getRow(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    async exportCustomerSnapshotPdf(result: any, title?: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const summary = result.summary || {};

            // Cover Title
            doc.fontSize(22).font('Helvetica-Bold').fillColor('#1e1b4b').text('INSURANCE PORTFOLIO STATEMENT', { align: 'center' });
            doc.moveDown(0.2);
            doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text('COMPILED BY INSURECRM PRO', { align: 'center' });
            doc.moveDown(1.5);

            // Client Info Box
            doc.rect(40, doc.y, 515, 75).fill('#f8fafc');
            doc.fillColor('#1e1b4b').fontSize(11).font('Helvetica-Bold').text('CLIENT PORTFOLIO INFO', 55, doc.y + 10);
            doc.fillColor('#475569').fontSize(10).font('Helvetica')
                .text(`Customer Name: ${summary.customerName || '—'}`, 55, doc.y + 25)
                .text(`Contact Phone: ${summary.phone || '—'}`, 55, doc.y + 5)
                .text(`Statement Period: ${new Date().toLocaleDateString('en-IN')}`, 55, doc.y + 5);
            doc.moveDown(2);

            // KPI Grid
            const gridY = doc.y + 40;
            const cardWidth = 160;
            const cardHeight = 50;

            // Card 1
            doc.rect(40, gridY, cardWidth, cardHeight).fill('#eff6ff');
            doc.fillColor('#2563eb').fontSize(8).font('Helvetica-Bold').text('TOTAL POLICIES', 50, gridY + 10);
            doc.fillColor('#1e3a8a').fontSize(14).font('Helvetica-Bold').text(String(summary.totalPolicies || 0), 50, gridY + 22);

            // Card 2
            doc.rect(40 + cardWidth + 15, gridY, cardWidth, cardHeight).fill('#ecfdf5');
            doc.fillColor('#059669').fontSize(8).font('Helvetica-Bold').text('TOTAL PREMIUM PAID', 40 + cardWidth + 25, gridY + 10);
            doc.fillColor('#064e3b').fontSize(14).font('Helvetica-Bold').text(`₹${(summary.totalPremium || 0).toLocaleString('en-IN')}`, 40 + cardWidth + 25, gridY + 22);

            // Card 3
            doc.rect(40 + (cardWidth + 15) * 2, gridY, cardWidth, cardHeight).fill('#fff1f2');
            doc.fillColor('#e11d48').fontSize(8).font('Helvetica-Bold').text('TOTAL CLAIMS', 40 + (cardWidth + 15) * 2 + 10, gridY + 10);
            doc.fillColor('#4c0519').fontSize(14).font('Helvetica-Bold').text(String(summary.totalClaims || 0), 40 + (cardWidth + 15) * 2 + 10, gridY + 22);

            doc.y = gridY + 70;

            // Add Insurer Breakdown Table on Page 1
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e1b4b').text('Portfolio Share by Insurer', 40, doc.y);
            doc.moveDown(0.4);

            // Draw table
            let tableY = doc.y;
            doc.rect(40, tableY, 515, 20).fill('#4338ca');
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
                .text('Insurer', 50, tableY + 5)
                .text('Policies', 300, tableY + 5, { width: 80, align: 'right' })
                .text('Gross Premium', 430, tableY + 5, { width: 110, align: 'right' });

            tableY += 20;
            doc.fontSize(9).font('Helvetica').fillColor('#334155');
            for (const ins of (summary.insurers || [])) {
                doc.rect(40, tableY, 515, 18).stroke('#e2e8f0');
                doc.text(ins.name, 50, tableY + 4)
                    .text(String(ins.count), 300, tableY + 4, { width: 80, align: 'right' })
                    .text(`₹${ins.premium.toLocaleString('en-IN')}`, 430, tableY + 4, { width: 110, align: 'right' });
                tableY += 18;
            }

            // ─── PAGE 2: Policies Ledger ─────────────────────
            doc.addPage();
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e1b4b').text('Policies Ledger', 40, 40);
            doc.moveDown(0.5);

            const drawLedgerHeader = (yCoord: number) => {
                doc.rect(40, yCoord, 515, 20).fill('#4338ca');
                doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
                    .text('Policy No', 45, yCoord + 6)
                    .text('Insurer', 150, yCoord + 6)
                    .text('Vehicle / Details', 270, yCoord + 6)
                    .text('Premium', 370, yCoord + 6, { width: 80, align: 'right' })
                    .text('Expiry Date', 470, yCoord + 6, { width: 80, align: 'right' });
                return yCoord + 20;
            };

            let rowY = doc.y;
            rowY = drawLedgerHeader(rowY);

            doc.fontSize(8).font('Helvetica').fillColor('#334155');
            for (const p of result.data || []) {
                if (rowY + 16 > doc.page.height - 40) {
                    doc.addPage();
                    rowY = drawLedgerHeader(40);
                    doc.fontSize(8).font('Helvetica').fillColor('#334155');
                }
                const detailText = p.policyType?.toLowerCase() === 'motor' ? (p.vehicleNo || '—') : (p.productName || '—');
                doc.rect(40, rowY, 515, 16).stroke('#f1f5f9');
                doc.text(p.policyNumber || '—', 45, rowY + 4)
                    .text(p.companyName || '—', 150, rowY + 4)
                    .text(detailText, 270, rowY + 4)
                    .text(`₹${p.totalPremium.toLocaleString('en-IN')}`, 370, rowY + 4, { width: 80, align: 'right' })
                    .text(p.expiryDate || '—', 470, rowY + 4, { width: 80, align: 'right' });
                rowY += 16;
            }

            // ─── PAGE 3: Claims History ──────────────────────
            if ((result.claims || []).length > 0) {
                doc.addPage();
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e1b4b').text('Claims History Statement', 40, 40);
                doc.moveDown(0.5);

                const drawClaimsHeader = (yCoord: number) => {
                    doc.rect(40, yCoord, 515, 20).fill('#be123c');
                    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
                        .text('Claim No', 45, yCoord + 6)
                        .text('Policy No', 150, yCoord + 6)
                        .text('Vehicle / Details', 270, yCoord + 6)
                        .text('Bill Amount (₹)', 360, yCoord + 6, { width: 80, align: 'right' })
                        .text('Settled (₹)', 460, yCoord + 6, { width: 80, align: 'right' });
                    return yCoord + 20;
                };

                let claimRowY = doc.y;
                claimRowY = drawClaimsHeader(claimRowY);

                doc.fontSize(8).font('Helvetica').fillColor('#334155');
                for (const c of result.claims || []) {
                    if (claimRowY + 16 > doc.page.height - 40) {
                        doc.addPage();
                        claimRowY = drawClaimsHeader(40);
                        doc.fontSize(8).font('Helvetica').fillColor('#334155');
                    }
                    const detailText = c.policyType?.toLowerCase() === 'motor' ? (c.vehicleNumber || '—') : (c.productName || '—');
                    doc.rect(40, claimRowY, 515, 16).stroke('#f1f5f9');
                    doc.text(c.claimNumber || '—', 45, claimRowY + 4)
                        .text(c.policyNumber || '—', 150, claimRowY + 4)
                        .text(detailText, 270, claimRowY + 4)
                        .text(c.billAmount != null ? `₹${c.billAmount.toLocaleString('en-IN')}` : '—', 360, claimRowY + 4, { width: 80, align: 'right' })
                        .text(c.claimAmount != null ? `₹${c.claimAmount.toLocaleString('en-IN')}` : '—', 460, claimRowY + 4, { width: 80, align: 'right' });
                    claimRowY += 16;
                }
            }

            // ─── PAGE 4: Expiring Forecast ───────────────────
            if ((result.expiring || []).length > 0) {
                doc.addPage();
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e1b4b').text('Upcoming Expiry & Renewal Forecast', 40, 40);
                doc.moveDown(0.5);

                const drawExpiringHeader = (yCoord: number) => {
                    doc.rect(40, yCoord, 515, 20).fill('#b45309');
                    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
                        .text('Policy No', 45, yCoord + 6)
                        .text('Insurer', 150, yCoord + 6)
                        .text('Vehicle / Details', 270, yCoord + 6)
                        .text('Expiry Date', 370, yCoord + 6)
                        .text('Days Remaining', 470, yCoord + 6, { width: 80, align: 'right' });
                    return yCoord + 20;
                };

                let expRowY = doc.y;
                expRowY = drawExpiringHeader(expRowY);

                doc.fontSize(8).font('Helvetica').fillColor('#334155');
                for (const e of result.expiring || []) {
                    if (expRowY + 16 > doc.page.height - 40) {
                        doc.addPage();
                        expRowY = drawExpiringHeader(40);
                        doc.fontSize(8).font('Helvetica').fillColor('#334155');
                    }
                    const detailText = e.policyType?.toLowerCase() === 'motor' ? (e.vehicleNo || '—') : (e.productName || '—');
                    doc.rect(40, expRowY, 515, 16).stroke('#f1f5f9');
                    doc.text(e.policyNumber || '—', 45, expRowY + 4)
                        .text(e.companyName || '—', 150, expRowY + 4)
                        .text(detailText, 270, expRowY + 4)
                        .text(e.expiryDate || '—', 370, expRowY + 4)
                        .text(e.daysRemaining, 470, expRowY + 4, { width: 80, align: 'right' });
                    expRowY += 16;
                }
            }

            doc.end();
        });
    }

    async getFinancialYears(userId: string, role: string) {
        const range = await prisma.policy.aggregate({
            where: {
                ...ownerFilter(userId, role),
                deletedAt: null
            },
            _min: { startDate: true },
            _max: { startDate: true }
        });

        const minDate = range._min.startDate;
        const maxDate = range._max.startDate;

        // If no data exists, default to current financial year
        if (!minDate || !maxDate) {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth();
            const startYear = currentMonth < 3 ? currentYear - 1 : currentYear;
            const endYear = startYear + 1;
            return [
                {
                    label: `FY ${startYear}-${endYear.toString().slice(-2)}`,
                    dateFrom: `${startYear}-04-01`,
                    dateTo: `${endYear}-03-31`
                }
            ];
        }

        const minYear = minDate.getFullYear();
        const minMonth = minDate.getMonth();
        const startFYYear = minMonth < 3 ? minYear - 1 : minYear;

        const maxYear = maxDate.getFullYear();
        const maxMonth = maxDate.getMonth();
        const endFYYear = maxMonth < 3 ? maxYear - 1 : maxYear;

        const fyears = [];
        for (let y = endFYYear; y >= startFYYear; y--) {
            const nextYearShort = (y + 1).toString().slice(-2);
            const dateFrom = `${y}-04-01`;
            const dateTo = `${y + 1}-03-31`;

            // Calculate aggregate data for this financial year
            const stats = await prisma.policy.aggregate({
                where: {
                    ...ownerFilter(userId, role),
                    deletedAt: null,
                    startDate: {
                        gte: new Date(`${dateFrom}T00:00:00.000Z`),
                        lte: new Date(`${dateTo}T23:59:59.999Z`)
                    }
                },
                _count: { id: true },
                _sum: { totalPremium: true }
            });

            fyears.push({
                label: `FY ${y}-${nextYearShort}`,
                dateFrom,
                dateTo,
                policyCount: stats._count.id || 0,
                totalPremium: stats._sum.totalPremium || 0
            });
        }
        return fyears;
    }
}

export const reportService = new ReportService();