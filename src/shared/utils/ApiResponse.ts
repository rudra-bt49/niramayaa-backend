import { IApiResponse } from "../../types/global.types";

export class ApiResponse<T = any> {
    static success<T>(data: T, message: string = "Success", statusCode: number = 200): IApiResponse<T> {
        return {
            success: true,
            message,
            data,
            statusCode,
        };
    }

    static error(message: string = "Error", statusCode: number = 500, error?: string): IApiResponse<null> {
        return {
            success: false,
            message,
            error,
            statusCode,
        };
    }
}
