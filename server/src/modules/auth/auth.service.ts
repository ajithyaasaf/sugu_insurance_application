import bcrypt from 'bcryptjs';
import prisma from '../../utils/prisma';
import { generateAccessToken, generateRefreshToken } from '../../utils/jwt';
import { RegisterInput, LoginInput } from './auth.schema';
import { ActivityService } from '../activity/activity.service';

export class AuthService {
    async register(data: RegisterInput) {
        const existing = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (existing) {
            throw Object.assign(new Error('Email already registered'), {
                statusCode: 409,
            });
        }

        const passwordHash = await bcrypt.hash(data.password, 12);

        const user = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                name: data.name,
                role: 'staff', // Force to staff for public registration
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
        });

        const tokens = this.generateTokens(user.id, user.role);

        return { user, ...tokens };
    }

    async login(data: LoginInput) {
        const user = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (!user) {
            throw Object.assign(new Error('Invalid email or password'), {
                statusCode: 401,
            });
        }

        const isValid = await bcrypt.compare(data.password, user.passwordHash);

        if (!isValid) {
            throw Object.assign(new Error('Invalid email or password'), {
                statusCode: 401,
            });
        }

        const tokens = this.generateTokens(user.id, user.role);

        // Record activity log
        ActivityService.logActivity({
            userId: user.id,
            userRole: user.role,
            action: 'LOGIN',
            entityType: 'auth',
            title: `User logged in: ${user.name}`,
            description: `Login successful for ${user.email}`,
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            ...tokens,
        };
    }

    async getProfile(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw Object.assign(new Error('User not found'), { statusCode: 404 });
        }

        return user;
    }

    private generateTokens(userId: string, role: string) {
        const accessToken = generateAccessToken({ userId, role });
        const refreshToken = generateRefreshToken({ userId, role });
        return { accessToken, refreshToken };
    }
}

export const authService = new AuthService();
