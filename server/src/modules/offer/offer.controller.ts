import { Request, Response, NextFunction } from 'express';
import { offerService } from './offer.service';
import { sendSuccess, sendError } from '../../utils/apiResponse';

const STAFF_BLOCKED_MSG = 'Access denied: Staff members are not permitted to manage offers.';

export class OfferController {
    /** POST /api/offers — Attach offer to a policy (Agent/Admin only) */
    async attach(req: Request, res: Response, next: NextFunction) {
        try {
            if (req.user!.role === 'staff') {
                return sendError({ res, statusCode: 403, message: STAFF_BLOCKED_MSG });
            }
            const offer = await offerService.attachOffer(req.user!.userId, req.user!.role, req.body);
            sendSuccess({ res, statusCode: 201, message: 'Offer attached successfully', data: offer });
        } catch (e: any) {
            e.statusCode ? sendError({ res, statusCode: e.statusCode, message: e.message }) : next(e);
        }
    }

    /** GET /api/offers — Paginated list of all offers (Agent/Admin only) */
    async findAll(req: Request, res: Response, next: NextFunction) {
        try {
            if (req.user!.role === 'staff') {
                return sendError({ res, statusCode: 403, message: STAFF_BLOCKED_MSG });
            }
            const { page, limit, search, companyId, dateFrom, dateTo } = req.query as any;
            const result = await offerService.findAll(
                req.user!.userId,
                req.user!.role,
                +page || 1,
                +limit || 10,
                search,
                companyId,
                dateFrom,
                dateTo,
            );
            sendSuccess({ res, statusCode: 200, message: 'Offers fetched', data: result.data, meta: result.meta });
        } catch (e: any) {
            next(e);
        }
    }

    /** GET /api/offers/summary — Header metric cards (Agent/Admin only) */
    async getSummary(req: Request, res: Response, next: NextFunction) {
        try {
            if (req.user!.role === 'staff') {
                return sendError({ res, statusCode: 403, message: STAFF_BLOCKED_MSG });
            }
            const summary = await offerService.getSummary(req.user!.userId, req.user!.role);
            sendSuccess({ res, statusCode: 200, message: 'Offer summary fetched', data: summary });
        } catch (e: any) {
            next(e);
        }
    }

    /** GET /api/offers/:id — Single offer detail (Agent/Admin only) */
    async findById(req: Request, res: Response, next: NextFunction) {
        try {
            if (req.user!.role === 'staff') {
                return sendError({ res, statusCode: 403, message: STAFF_BLOCKED_MSG });
            }
            const offer = await offerService.findById(req.user!.userId, req.user!.role, req.params.id as string);
            sendSuccess({ res, statusCode: 200, message: 'Offer found', data: offer });
        } catch (e: any) {
            e.statusCode ? sendError({ res, statusCode: e.statusCode, message: e.message }) : next(e);
        }
    }

    /** PUT /api/offers/:id — Update offer amount or notes (Agent/Admin only) */
    async update(req: Request, res: Response, next: NextFunction) {
        try {
            if (req.user!.role === 'staff') {
                return sendError({ res, statusCode: 403, message: STAFF_BLOCKED_MSG });
            }
            const offer = await offerService.updateOffer(req.user!.userId, req.user!.role, req.params.id as string, req.body);
            sendSuccess({ res, statusCode: 200, message: 'Offer updated successfully', data: offer });
        } catch (e: any) {
            e.statusCode ? sendError({ res, statusCode: e.statusCode, message: e.message }) : next(e);
        }
    }

    /** DELETE /api/offers/:id — Remove an offer (Agent/Admin only) */
    async remove(req: Request, res: Response, next: NextFunction) {
        try {
            if (req.user!.role === 'staff') {
                return sendError({ res, statusCode: 403, message: STAFF_BLOCKED_MSG });
            }
            const result = await offerService.removeOffer(req.user!.userId, req.user!.role, req.params.id as string);
            sendSuccess({ res, statusCode: 200, message: result.message });
        } catch (e: any) {
            e.statusCode ? sendError({ res, statusCode: e.statusCode, message: e.message }) : next(e);
        }
    }
}

export const offerController = new OfferController();
