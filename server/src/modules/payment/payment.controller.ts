import { Request, Response, NextFunction } from 'express';
import { paymentService } from './payment.service';
import { sendSuccess, sendError } from '../../utils/apiResponse';

export class PaymentController {
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const payment = await paymentService.create(req.user!.userId, req.user!.role, req.body);
            sendSuccess({ res, statusCode: 201, message: 'Payment created', data: payment });
        } catch (e: any) { e.statusCode ? sendError({ res, statusCode: e.statusCode, message: e.message }) : next(e); }
    }

    async findAll(req: Request, res: Response, next: NextFunction) {
        try {
            const { page, limit, status, search, dateFrom, dateTo, dealerId, policyNumber, vehicleNumber, vehicleClass } = req.query as any;
            const result = await paymentService.findAll(
                req.user!.userId,
                req.user!.role,
                +page || 1,
                +limit || 20,
                status,
                search,
                dateFrom,
                dateTo,
                dealerId,
                policyNumber,
                vehicleNumber,
                vehicleClass
            );
            sendSuccess({ res, statusCode: 200, message: 'Payments fetched', data: result.data, meta: result.meta });
        } catch (e: any) { next(e); }
    }

    async findById(req: Request, res: Response, next: NextFunction) {
        try {
            const payment = await paymentService.findById(req.user!.userId, req.user!.role, req.params.id as string);
            sendSuccess({ res, statusCode: 200, message: 'Payment found', data: payment });
        } catch (e: any) { e.statusCode ? sendError({ res, statusCode: e.statusCode, message: e.message }) : next(e); }
    }

    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const { payment, message } = await paymentService.update(req.user!.userId, req.user!.role, req.params.id as string, req.body);
            sendSuccess({ res, statusCode: 200, message, data: payment });
        } catch (e: any) { e.statusCode ? sendError({ res, statusCode: e.statusCode, message: e.message }) : next(e); }
    }

    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            await paymentService.delete(req.user!.userId, req.user!.role, req.params.id as string);
            sendSuccess({ res, statusCode: 200, message: 'Payment deleted' });
        } catch (e: any) { e.statusCode ? sendError({ res, statusCode: e.statusCode, message: e.message }) : next(e); }
    }

    async detectOverdue(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await paymentService.detectOverdue(req.user!.userId, req.user!.role);
            sendSuccess({ res, statusCode: 200, message: `${result.updated} overdue payment(s) detected`, data: result });
        } catch (e: any) { next(e); }
    }

    async getUnsettledPayers(req: Request, res: Response, next: NextFunction) {
        try {
            const data = await paymentService.getUnsettledPayers(req.user!.userId, req.user!.role);
            sendSuccess({ res, statusCode: 200, message: 'Unsettled payers fetched', data });
        } catch (e: any) { next(e); }
    }

    async getUnsettledByPayer(req: Request, res: Response, next: NextFunction) {
        try {
            const { payerType, payerValue } = req.query as { payerType: 'dealer' | 'reference', payerValue: string };
            if (!payerType || !payerValue) {
                return sendError({ res, statusCode: 400, message: 'payerType and payerValue are required' });
            }
            const data = await paymentService.getUnsettledByPayer(req.user!.userId, req.user!.role, payerType, payerValue);
            sendSuccess({ res, statusCode: 200, message: 'Unsettled policies fetched', data });
        } catch (e: any) { next(e); }
    }

    async createBatchCollection(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await paymentService.createBatchCollection(req.user!.userId, req.user!.role, req.body);
            sendSuccess({
                res,
                statusCode: 201,
                message: `Batch collection of ₹${result.batch.totalAmount} recorded (Receipt #${result.batch.receiptNo})`,
                data: result
            });
        } catch (e: any) { e.statusCode ? sendError({ res, statusCode: e.statusCode, message: e.message }) : next(e); }
    }

    async getBatches(req: Request, res: Response, next: NextFunction) {
        try {
            const { page, limit, search } = req.query as any;
            const result = await paymentService.getBatches(req.user!.userId, req.user!.role, +page || 1, +limit || 20, search);
            sendSuccess({ res, statusCode: 200, message: 'Batch receipts fetched', data: result.data, meta: result.meta });
        } catch (e: any) { next(e); }
    }

    async getBatchById(req: Request, res: Response, next: NextFunction) {
        try {
            const batch = await paymentService.getBatchById(req.user!.userId, req.user!.role, req.params.id as string);
            sendSuccess({ res, statusCode: 200, message: 'Batch receipt found', data: batch });
        } catch (e: any) { e.statusCode ? sendError({ res, statusCode: e.statusCode, message: e.message }) : next(e); }
    }
}

export const paymentController = new PaymentController();


