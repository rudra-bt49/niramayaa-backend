import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { ApiResponse } from "../shared/utils/ApiResponse";

export const validate = (schema: z.ZodTypeAny) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const validatedData = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            }) as { body: any; query: any; params: any };
            
            // Only re-assign body. query and params are read-only in Express 5
            req.body = validatedData.body;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json(
                    ApiResponse.error(
                        "Validation Failed",
                        400,
                        error.issues.map((e) => e.message).join(", ")
                    )
                );
            }
            next(error);
        }
    };
};
