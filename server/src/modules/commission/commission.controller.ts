import { Request, Response, NextFunction } from 'express';
import { commissionService } from './commission.service';
import { sendSuccess, sendError } from '../../utils/apiResponse';
import { reportService } from '../report/report.service';

export class CommissionController {
    async getPending(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await commissionService.getPending(req.user!.userId, req.user!.role);
            sendSuccess({ res, statusCode: 200, message: 'Pending commissions fetched', data: result });
        } catch (err) { next(err); }
    }

    async getStats(req: Request, res: Response, next: NextFunction) {
        try {
            const { dealerId, periodStart, periodEnd, companyId, companyIds } = req.query;
            if (!dealerId || !periodStart || !periodEnd) {
                return next(Object.assign(new Error('Missing query params'), { statusCode: 400 }));
            }
            const result = await commissionService.getStats(req.user!.userId, req.user!.role, {
                dealerId: dealerId as string,
                periodStart: periodStart as string,
                periodEnd: periodEnd as string,
                companyId: companyId as string | undefined,
                companyIds: (companyIds as string | string[] | undefined)
            });
            sendSuccess({ res, statusCode: 200, message: 'Commission stats fetched', data: result });
        } catch (err) { next(err); }
    }

    async preview(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await commissionService.preview(req.user!.userId, req.user!.role, req.body);
            sendSuccess({ res, statusCode: 200, message: 'Commission preview calculated', data: result });
        } catch (err) { next(err); }
    }

    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await commissionService.create(req.user!.userId, req.user!.role, req.body);
            sendSuccess({ res, statusCode: 201, message: 'Commission record saved', data: result });
        } catch (err) { next(err); }
    }

    async findAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { dealerId, status, dateFrom, dateTo, companyId, companyIds } = req.query;
            const result = await commissionService.findAll(
                req.user!.userId,
                dealerId as string | undefined,
                status as string | undefined,
                dateFrom as string | undefined,
                dateTo as string | undefined,
                companyId as string | undefined,
                (companyIds as string | string[] | undefined)
            );
            sendSuccess({ res, statusCode: 200, message: 'Commission records fetched', data: result });
        } catch (err) { next(err); }
    }

    async exportExcel(req: Request, res: Response, next: NextFunction) {
        try {
            const { dealerId, status, dateFrom, dateTo, companyId, companyIds } = req.body;
            const history = await commissionService.findAll(
                req.user!.userId,
                dealerId as string | undefined,
                status as string | undefined,
                dateFrom as string | undefined,
                dateTo as string | undefined,
                companyId as string | undefined,
                companyIds as string | string[] | undefined
            );

            if (!history.length) {
                sendError({ res, statusCode: 400, message: 'No records found to export' });
                return;
            }

            const data = history.map(c => ({
                dealerName: (c as any).dealer?.name || 'Unknown',
                companyName: (c as any).company?.name || 'All',
                period: `${c.periodStart ? c.periodStart.toISOString().split('T')[0] : ''} - ${c.periodEnd ? c.periodEnd.toISOString().split('T')[0] : ''}`,
                odPercentage: `${c.odPercentage || 0}%`,
                tpPercentage: `${c.tpPercentage || 0}%`,
                totalPolicies: (c as any)._count?.commissionPolicies || 0,
                totalCommission: `Rs. ${(Number(c.totalCommission) || 0).toFixed(2)}`,
                status: (c.status || '').toUpperCase(),
                notes: c.notes || ''
            }));

            const cols = [
                { key: 'dealerName', label: 'Dealer Name' },
                { key: 'companyName', label: 'Company' },
                { key: 'period', label: 'Processing Period' },
                { key: 'odPercentage', label: 'OD %' },
                { key: 'tpPercentage', label: 'TP %' },
                { key: 'totalPolicies', label: 'Total Policies' },
                { key: 'totalCommission', label: 'Total Commission' },
                { key: 'status', label: 'Status' },
                { key: 'notes', label: 'Notes' },
            ];

            const buffer = await reportService.exportXlsx(data, cols, 'Commission History Report');

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=Commission_History.xlsx`);
            res.send(buffer);
        } catch (err) { next(err); }
    }

    async findById(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await commissionService.findById(req.user!.userId, req.params.id as string);
            sendSuccess({ res, statusCode: 200, message: 'Commission record fetched', data: result });
        } catch (err) { next(err); }
    }

    async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await commissionService.bulkUpdateStatus(req.user!.userId, req.body);
            sendSuccess({ res, statusCode: 200, message: 'Commissions updated', data: result });
        } catch (err) { next(err); }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await commissionService.update(
                req.user!.userId,
                req.params.id as string,
                req.body
            );
            sendSuccess({ res, statusCode: 200, message: 'Commission record updated', data: result });
        } catch (err) { next(err); }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            await commissionService.delete(req.user!.userId, req.params.id as string);
            sendSuccess({ res, statusCode: 200, message: 'Commission record deleted' });
        } catch (err) { next(err); }
    }
}

export const commissionController = new CommissionController();
