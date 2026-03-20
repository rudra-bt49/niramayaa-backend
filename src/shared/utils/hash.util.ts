import crypto from "crypto";

export const hashUtil = {
    /**
     * Hashes a string using SHA-256.
     * Useful for storing refresh token hashes in the database.
     */
    hashString: (str: string): string => {
        return crypto.createHash("sha256").update(str).digest("hex");
    },
};
