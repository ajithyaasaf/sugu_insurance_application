import { Request, Response } from 'express';
import { ActivityService } from './activity.service';

const activityService = new ActivityService();

export class ActivityController {
    async getActivities(req: Request, res: Response) {
        try {
            const userId = req.user!.userId;
            const role = req.user!.role;

            if (role === 'staff') {
                return res.status(403).json({ error: 'Access denied: Staff members are not permitted to view activity logs.' });
            }

            const result = await activityService.getActivities(userId, role, req.query);
            res.json(result);
        } catch (err: any) {
            console.error('[ActivityController] error fetching activities:', err);
            res.status(500).json({ error: 'Failed to fetch activity logs' });
        }
    }

    async getSummary(req: Request, res: Response) {
        try {
            const userId = req.user!.userId;
            const role = req.user!.role;

            if (role === 'staff') {
                return res.status(403).json({ error: 'Access denied: Staff members are not permitted to view activity summary.' });
            }

            const summary = await activityService.getSummary(userId, role);
            res.json(summary);
        } catch (err: any) {
            console.error('[ActivityController] error fetching summary:', err);
            res.status(500).json({ error: 'Failed to fetch activity summary' });
        }
    }

    async exportActivities(req: Request, res: Response) {
        try {
            const userId = req.user!.userId;
            const role = req.user!.role;

            if (role === 'staff') {
                return res.status(403).json({ error: 'Access denied: Staff members are not permitted to export activity logs.' });
            }

            const result = await activityService.getActivities(userId, role, { ...req.query, limit: 1000 });
            
            // Format CSV
            const rows = result.data.map((item: any) => ({
                Date: item.createdAt,
                User: item.user?.name || 'System',
                Role: item.userRole,
                Action: item.action,
                Category: item.entityType,
                Title: item.title,
                Description: item.description || '',
            }));

            res.json({ data: rows });
        } catch (err: any) {
            console.error('[ActivityController] error exporting activities:', err);
            res.status(500).json({ error: 'Failed to export activity logs' });
        }
    }
}
