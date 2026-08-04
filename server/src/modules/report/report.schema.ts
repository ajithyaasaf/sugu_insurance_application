import { z } from 'zod';

// ─── Allowed enums ───────────────────────────────────────
export const ReportSource = z.enum([
    'policies',
    'policies-expired',
    'payments',
    'claims',
    'customers',
    'followups',
    'customer-snapshot',
    'customer-snapshot-claims',
    'customer-snapshot-expiring',
    'customer-snapshot-full',
    'offers',
]);
export type ReportSource = z.infer<typeof ReportSource>;

export const ReportGroupBy = z.enum([
    'company',
    'dealer',
    'policyType',
    'vehicleClass',
    'status',
    'month',
    'policyOrigin',
    'customer',
]);
export type ReportGroupBy = z.infer<typeof ReportGroupBy>;

export const ExportFormat = z.enum(['xlsx', 'pdf']);
export type ExportFormat = z.infer<typeof ExportFormat>;

// ─── Shared filter object ────────────────────────────────
const filtersSchema = z.object({
    companyId:    z.string().uuid().optional(),
    companyIds:   z.union([z.string(), z.array(z.string())]).optional(),
    dealerId:     z.union([z.string().uuid(), z.literal('direct')]).optional(),
    customerId:   z.string().uuid().optional(),
    policyType:   z.string().optional(),
    vehicleClass: z.string().optional(),
    status:       z.string().optional(),
    policyOrigin: z.string().optional(),
    dateFrom:     z.string().optional(),   // ISO date string
    dateTo:       z.string().optional(),
}).strict().optional();

// ─── POST /api/reports/generate ──────────────────────────
export const reportGenerateSchema = z.object({
    body: z.object({
        source:   ReportSource,
        filters:  filtersSchema,
        groupBy:  ReportGroupBy.optional(),
        page:     z.number().int().min(1).default(1),
        limit:    z.number().int().min(1).max(500).default(50),
    }),
});

// ─── POST /api/reports/export ────────────────────────────
export const reportExportSchema = z.object({
    body: z.object({
        source:   ReportSource,
        filters:  filtersSchema,
        groupBy:  ReportGroupBy.optional(),
        format:   ExportFormat,
        columns:  z.array(z.string()).optional(),
        title:    z.string().optional(),
    }),
});
