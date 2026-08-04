import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess, sendError } from '../../utils/apiResponse';
import { verifyRefreshToken } from '../../utils/jwt';
import { env } from '../../config/env';
import { ActivityService } from '../activity/activity.service';

const isProd = env.NODE_ENV === 'production' || env.CLIENT_URL.includes('pages.dev');

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' as const : 'lax' as const,
    path: '/',
};

export class AuthController {
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { user, accessToken, refreshToken } = await authService.register(
                req.body
            );

            res.cookie('accessToken', accessToken, {
                ...COOKIE_OPTIONS,
                maxAge: 15 * 60 * 1000, // 15 minutes
            });

            res.cookie('refreshToken', refreshToken, {
                ...COOKIE_OPTIONS,
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            });

            sendSuccess({
                res,
                statusCode: 201,
                message: 'Registration successful',
                data: { user, accessToken, refreshToken },
            });
        } catch (error: any) {
            if (error.statusCode) {
                sendError({
                    res,
                    statusCode: error.statusCode,
                    message: error.message,
                });
            } else {
                next(error);
            }
        }
    }

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { user, accessToken, refreshToken } = await authService.login(
                req.body
            );

            res.cookie('accessToken', accessToken, {
                ...COOKIE_OPTIONS,
                maxAge: 15 * 60 * 1000,
            });

            res.cookie('refreshToken', refreshToken, {
                ...COOKIE_OPTIONS,
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });

            sendSuccess({
                res,
                statusCode: 200,
                message: 'Login successful',
                data: { user, accessToken, refreshToken },
            });
        } catch (error: any) {
            if (error.statusCode) {
                sendError({
                    res,
                    statusCode: error.statusCode,
                    message: error.message,
                });
            } else {
                next(error);
            }
        }
    }

    async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const token = req.cookies?.refreshToken;

            if (!token) {
                sendError({ res, statusCode: 401, message: 'No refresh token' });
                return;
            }

            const decoded = verifyRefreshToken(token);
            const { generateAccessToken } = require('../../utils/jwt');
            const newAccessToken = generateAccessToken({
                userId: decoded.userId,
                role: decoded.role,
            });

            res.cookie('accessToken', newAccessToken, {
                ...COOKIE_OPTIONS,
                maxAge: 15 * 60 * 1000,
            });

            sendSuccess({
                res,
                statusCode: 200,
                message: 'Token refreshed',
                data: { accessToken: newAccessToken },
            });
        } catch (error: any) {
            sendError({ res, statusCode: 401, message: 'Invalid refresh token' });
        }
    }

    async logout(req: Request, res: Response) {
        if (req.user) {
            ActivityService.logActivity({
                userId: req.user.userId,
                userRole: req.user.role,
                action: 'LOGOUT',
                entityType: 'auth',
                title: `User logged out`,
                description: `Logout successful`,
            });
        }
        res.clearCookie('accessToken', COOKIE_OPTIONS);
        res.clearCookie('refreshToken', COOKIE_OPTIONS);
        sendSuccess({ res, statusCode: 200, message: 'Logged out' });
    }

    async me(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await authService.getProfile(req.user!.userId);
            sendSuccess({ res, statusCode: 200, message: 'Profile', data: user });
        } catch (error: any) {
            if (error.statusCode) {
                sendError({
                    res,
                    statusCode: error.statusCode,
                    message: error.message,
                });
            } else {
                next(error);
            }
        }
    }
}

export const authController = new AuthController();
