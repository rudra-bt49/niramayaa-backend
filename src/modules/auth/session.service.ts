import prisma from "../../prisma/prisma";
import { hashUtil } from "../../shared/utils/hash.util";

export const sessionService = {
    /**
     * Checks if a user has an active session.
     */
    hasActiveSession: async (userId: string): Promise<boolean> => {
        const activeSession = await prisma.user_session.findFirst({
            where: {
                user_id: userId,
                is_active: true,
            },
        });
        return !!activeSession;
    },

    /**
     * Invalidates all active sessions for a user.
     */
    invalidateAllSessions: async (userId: string): Promise<void> => {
        await prisma.user_session.updateMany({
            where: {
                user_id: userId,
                is_active: true,
            },
            data: {
                is_active: false,
            },
        });
    },

    /**
     * Creates a new session for a user.
     */
    createSession: async (userId: string, refreshToken: string, deviceId?: string, deviceName?: string): Promise<void> => {
        const refreshTokenHash = hashUtil.hashString(refreshToken);

        await prisma.user_session.createMany({
            data: [{
                user_id: userId,
                refresh_token_hash: refreshTokenHash,
                device_id: deviceId,
                device_name: deviceName || "Unknown Device",
                is_active: true,
            }],
            skipDuplicates: true
        });
    },

    /**
     * Invalidates a specific session matching the user and their exact refresh token hash.
     */
    invalidateSession: async (userId: string, refreshToken: string): Promise<void> => {
        const refreshTokenHash = hashUtil.hashString(refreshToken);

        const session = await prisma.user_session.findFirst({
            where: {
                user_id: userId,
                refresh_token_hash: refreshTokenHash,
                is_active: true
            }
        });

        if (!session) {
            const error: any = new Error("Session not found or already logged out");
            error.statusCode = 404;
            throw error;
        }

        await prisma.user_session.update({
            where: { id: session.id },
            data: { is_active: false }
        });
    },

    /**
     * Validates a session based on the refresh token.
     */
    validateSession: async (refreshToken: string): Promise<boolean> => {
        const refreshTokenHash = hashUtil.hashString(refreshToken);
        const session = await prisma.user_session.findUnique({
            where: { refresh_token_hash: refreshTokenHash },
        });

        return !!(session && session.is_active);
    },
};
