import { Request, Response, NextFunction } from "express";
import { ApiResponse } from "../shared/utils/ApiResponse";

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[Error] ${req.method} ${req.url}:`, err);

    res.status(statusCode).json(
        ApiResponse.error(
            message,
            statusCode,
            process.env.NODE_ENV === 'development' ? err.stack : undefined
        )
    );
};
