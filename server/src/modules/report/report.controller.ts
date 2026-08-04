import { Request, Response, NextFunction } from 'express';
import { reportService } from './report.service';
import { sendSuccess } from '../../utils/apiResponse';

export class ReportController {

    // POST /api/reports/generate
    async generate(req: Request, res: Response, next: NextFunction) {
        try {
            const { source, filters, groupBy, page = 1, limit = 50 } = req.body;
            const data = await reportService.generateReport(req.user!.userId, req.user!.role, {
                source, filters, groupBy, page, limit,
            });
            sendSuccess({ res, statusCode: 200, message: 'Report generated', data });
        } catch (e: any) { next(e); }
    }

    // GET /api/reports/dashboard
    async dashboard(req: Request, res: Response, next: NextFunction) {
        try {
            const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
            const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;
            const data = await reportService.getDashboardReport(req.user!.userId, req.user!.role, { dateFrom, dateTo });
            sendSuccess({ res, statusCode: 200, message: 'Dashboard analytics', data });
        } catch (e: any) { next(e); }
    }

    // GET /api/reports/financial-years
    async financialYears(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await reportService.getFinancialYears(req.user!.userId, req.user!.role);
            sendSuccess({ res, statusCode: 200, message: 'Financial years', data });
        } catch (e: any) { next(e); }
    }

    // POST /api/reports/export
    async exportReport(req: Request, res: Response, next: NextFunction) {
        try {
            const { source, filters, groupBy, format, columns, title } = req.body;

            // Fetch ALL data (no pagination for export)
            const result = await reportService.generateReport(req.user!.userId, req.user!.role, {
                source, filters, groupBy, page: 1, limit: 10000,
            });

            if (source === 'customer-snapshot-full') {
                const fileTitle = title || `${result?.summary?.customerName || 'Customer'}_Portfolio_Statement`;
                if (format === 'xlsx') {
                    const buffer = await reportService.exportCustomerSnapshotXlsx(result, fileTitle);
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', `attachment; filename="${fileTitle}.xlsx"`);
                    res.send(buffer);
                } else {
                    const buffer = await reportService.exportCustomerSnapshotPdf(result, fileTitle);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="${fileTitle}.pdf"`);
                    res.send(buffer);
                }
                return;
            }

            let reportData = result.data || [];
            let reportColumns = columns
                ? columns.map((key: string) => (result.columns || []).find((c: any) => c.key === key)).filter(Boolean)
                : result.columns || [];

            if ((source === 'policies' || source === 'policies-expired') && format === 'xlsx') {
                const typeLower = (filters?.policyType || '').toLowerCase();
                if (typeLower === 'health' || typeLower === 'life') {
                    reportColumns = [
                        { key: 'startDate', label: 'Start Date' },
                        { key: 'expiryDate', label: 'Expiry Date' },
                        { key: 'policyNumber', label: 'Policy No.' },
                        { key: 'customerName', label: 'Customer' },
                        { key: 'policyType', label: 'Type' },
                        { key: 'productName', label: 'Product Name' },
                        { key: 'sumInsured', label: 'Sum Insured (₹)' },
                        { key: 'premiumAmount', label: 'Premium (Net) (₹)' },
                        { key: 'tax', label: 'Tax (₹)' },
                        { key: 'totalPremium', label: 'Total Premium (₹)' },
                        { key: 'companyName', label: 'Company' },
                        { key: 'customerPhone', label: 'Phone' },
                        { key: 'policyOrigin', label: 'Origin' },
                        { key: 'dealerName', label: 'Dealer' }
                    ];
                    if (source === 'policies-expired') {
                        reportColumns.push({ key: 'ncbPercentage', label: 'NCB (%)' });
                    }
                } else {
                    reportColumns = [
                        { key: 'startDate', label: 'Start Date' },
                        { key: 'expiryDate', label: 'Expiry Date' },
                        { key: 'policyNumber', label: 'Policy No.' },
                        { key: 'customerName', label: 'Customer' },
                        { key: 'make', label: 'Make' },
                        { key: 'model', label: 'Model' },
                        { key: 'vehicleNumber', label: 'Vehicle No.' },
                        { key: 'vehicleClass', label: 'Vehicle Class' },
                        { key: 'od', label: 'OD Premium (₹)' },
                        { key: 'tp', label: 'TP Premium (₹)' },
                        { key: 'premiumAmount', label: 'Premium (Net) (₹)' },
                        { key: 'tax', label: 'Tax (₹)' },
                        { key: 'totalPremium', label: 'Total Premium (₹)' },
                        { key: 'companyName', label: 'Company' },
                        { key: 'customerPhone', label: 'Phone' },
                        { key: 'policyOrigin', label: 'Origin' },
                        { key: 'dealerName', label: 'Dealer' }
                    ];
                    if (source === 'policies-expired') {
                        reportColumns.push({ key: 'ncbPercentage', label: 'NCB (%)' });
                    }
                }
            }

            if (format === 'xlsx') {
                const buffer = await reportService.exportXlsx(reportData, reportColumns, title);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${title || 'report'}.xlsx"`);
                res.send(buffer);
            } else {
                const buffer = await reportService.exportPdf(reportData, reportColumns, title, filters, source);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${title || 'report'}.pdf"`);
                res.send(buffer);
            }
        } catch (e: any) { next(e); }
    }
}

export const reportController = new ReportController();
