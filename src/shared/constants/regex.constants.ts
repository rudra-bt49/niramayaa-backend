export const REGEX = {
    NAME: /^[A-Za-z\s]+$/,
    PHONE: /^[6-9]\d{9}$/,
    PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};
