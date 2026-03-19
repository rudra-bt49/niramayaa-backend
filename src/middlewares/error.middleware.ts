import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../shared/utils/ApiResponse";
import { ApiError } from "../shared/utils/ApiError";

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // Log the full error for developers (with stack)
    console.error(`[Error] ${req.method} ${req.url}:`, err);

    // Mask sensitive errors (Prisma, 500s, or any non-operational error)
    // We check err.name, err.message, and if it's an instance of our custom ApiError
    const isPrismaError = err.name?.startsWith('Prisma') || err.message?.toLowerCase().includes('prisma');
    const isOperational = err instanceof ApiError || err.isOperational;

    if (isPrismaError || (statusCode === 500 && !isOperational)) {
        // Stricter masking: never show raw DB/Internal errors to the user
        message = "An unexpected error occurred. Please try again later.";
    }

    res.status(statusCode).json(
        ApiResponse.error(
            message,
            statusCode,
            process.env.NODE_ENV === 'development' ? err.stack : undefined
        )
    );
};
