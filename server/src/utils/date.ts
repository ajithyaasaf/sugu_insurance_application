import { PolicyStatus } from '@prisma/client';

/**
 * Returns a Date object representing 00:00:00.000 IST for the 1st day of the current month.
 * Safe to use on UTC servers — uses Intl API to extract the IST year/month reliably.
 */
export const getStartOfMonthIST = (): Date => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    // Day 01 of the current IST month at midnight IST
    return new Date(`${year}-${month}-01T00:00:00.000+05:30`);
};

export const getStartOfTodayIST = (): Date => {
    const now = new Date();
    // Use Intl API to extract IST year, month, day securely across OS timezones
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(now);
    
    // formatToParts gives us an array of {type, value}
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

// By appending +05:30 to T00:00:00, vanilla JS securely parses exactly the UTC equivalent of midnight in IST
    return new Date(`${year}-${month}-${day}T00:00:00.000+05:30`);
};

/**
 * Returns a Date object representing 00:00:00.000 IST for a given date string (YYYY-MM-DD)
 */
export const getStartOfDayIST = (dateStr: string): Date => {
    return new Date(`${dateStr}T00:00:00.000+05:30`);
};

/**
 * Returns a Date object representing 23:59:59.999 IST for a given date string (YYYY-MM-DD)
 */
export const getEndOfDayIST = (dateStr: string): Date => {
    return new Date(`${dateStr}T23:59:59.999+05:30`);
};

export const buildStatusFilter = (status: string) => {
    const todayIST = getStartOfTodayIST();
    if (status === 'active') {
        return { status: 'active' as PolicyStatus, expiryDate: { gte: todayIST } };
    } else if (status === 'expired') {
        return {
            OR: [
                { status: 'expired' as PolicyStatus, expiryDate: { lt: todayIST } },
                { status: 'active' as PolicyStatus, expiryDate: { lt: todayIST } },
                { status: 'active' as PolicyStatus, tpEndDate: { lt: todayIST } }
            ]
        };
    }
    // For 'cancelled' and any other valid status, filter directly
    return { status: status as PolicyStatus };
};

export const mapPolicyStatus = <T extends { status: string, expiryDate?: Date | null, tpEndDate?: Date | null }>(policy: T): T => {
    if (!policy) return policy;
    // Cancelled policies are intentionally cancelled — never auto-flip them to expired
    if (policy.status === 'cancelled') return policy;
    const todayIST = getStartOfTodayIST();
    // If still marked 'active' in the DB but either OD or TP date has passed, report it as expired
    const isOdExpired = !!(policy.expiryDate && policy.expiryDate < todayIST);
    const isTpExpired = !!(policy.tpEndDate && policy.tpEndDate < todayIST);
    if (policy.status === 'active' && (isOdExpired || isTpExpired)) {
        return { ...policy, status: 'expired' };
    }
    return policy;
};

export const mapPaymentStatus = <T extends { status: string, dueDate: Date }>(payment: T): T & { isOverdue: boolean } => {
    if (!payment) return payment as any;
    const todayIST = getStartOfTodayIST();
    // A payment is overdue if it's not 'paid' and the due date has passed.
    const isOverdue = payment.status !== 'paid' && payment.dueDate < todayIST;
    return { ...payment, isOverdue };
};
