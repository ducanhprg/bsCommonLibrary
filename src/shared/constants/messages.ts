export const MessageType = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
} as const;

export const MessageCode = {
    // Authentication
    AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
    AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
    AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
    AUTH_ACCOUNT_INACTIVE: 'AUTH_ACCOUNT_INACTIVE',
    AUTH_MISSING_USERNAME: 'AUTH_MISSING_USERNAME',
    AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
    AUTH_MISSING_TENANT_INFO: 'AUTH_MISSING_TENANT_INFO',

    // Common Actions
    CREATED_SUCCESS: 'CREATED_SUCCESS',
    UPDATED_SUCCESS: 'UPDATED_SUCCESS',
    DELETED_SUCCESS: 'DELETED_SUCCESS',
    RETRIEVED_SUCCESS: 'RETRIEVED_SUCCESS',
    NOT_FOUND: 'NOT_FOUND',
    LIST_RETRIEVED: 'LIST_RETRIEVED',
    DETAIL_RETRIEVED: 'DETAIL_RETRIEVED',

    // Validation
    VALIDATION_REQUIRED_FIELDS: 'VALIDATION_REQUIRED_FIELDS',
    VALIDATION_INVALID_ID: 'VALIDATION_INVALID_ID',
    VALIDATION_INVALID_FILTER: 'VALIDATION_INVALID_FILTER',
    VALIDATION_INVALID_STATUS: 'VALIDATION_INVALID_STATUS',

    // System
    SYSTEM_ERROR: 'SYSTEM_ERROR',
    SYSTEM_UNAUTHORIZED: 'SYSTEM_UNAUTHORIZED',
    SYSTEM_FORBIDDEN: 'SYSTEM_FORBIDDEN',
    SYSTEM_NOT_FOUND: 'SYSTEM_NOT_FOUND',
    SYSTEM_BAD_REQUEST: 'SYSTEM_BAD_REQUEST'
} as const;

export const Messages = {
    [MessageCode.AUTH_LOGIN_SUCCESS]: {
        type: MessageType.SUCCESS,
        message: 'Login successful'
    },
    [MessageCode.AUTH_LOGIN_FAILED]: {
        type: MessageType.ERROR,
        message: 'Login failed'
    },
    [MessageCode.AUTH_INVALID_CREDENTIALS]: {
        type: MessageType.ERROR,
        message: 'Invalid credentials'
    },
    [MessageCode.AUTH_ACCOUNT_INACTIVE]: {
        type: MessageType.ERROR,
        message: 'Account is not active'
    },
    [MessageCode.AUTH_MISSING_USERNAME]: {
        type: MessageType.ERROR,
        message: 'Username header is required'
    },
    [MessageCode.AUTH_USER_NOT_FOUND]: {
        type: MessageType.ERROR,
        message: 'User not found in Redis'
    },
    [MessageCode.AUTH_MISSING_TENANT_INFO]: {
        type: MessageType.ERROR,
        message: 'Tenant database information not found in user data'
    },

    // Common Action Messages
    [MessageCode.CREATED_SUCCESS]: {
        type: MessageType.SUCCESS,
        message: '{resource} created successfully'
    },
    [MessageCode.UPDATED_SUCCESS]: {
        type: MessageType.SUCCESS,
        message: '{resource} updated successfully'
    },
    [MessageCode.DELETED_SUCCESS]: {
        type: MessageType.SUCCESS,
        message: '{resource} deleted successfully'
    },
    [MessageCode.RETRIEVED_SUCCESS]: {
        type: MessageType.SUCCESS,
        message: '{resource} retrieved successfully'
    },
    [MessageCode.NOT_FOUND]: {
        type: MessageType.ERROR,
        message: '{resource} not found'
    },
    [MessageCode.LIST_RETRIEVED]: {
        type: MessageType.SUCCESS,
        message: '{resource} list retrieved successfully'
    },
    [MessageCode.DETAIL_RETRIEVED]: {
        type: MessageType.SUCCESS,
        message: '{resource} details retrieved successfully'
    },

    // Validation Messages
    [MessageCode.VALIDATION_REQUIRED_FIELDS]: {
        type: MessageType.ERROR,
        message: 'Missing required fields: {fields}'
    },
    [MessageCode.VALIDATION_INVALID_ID]: {
        type: MessageType.ERROR,
        message: 'Invalid {resource} ID'
    },
    [MessageCode.VALIDATION_INVALID_FILTER]: {
        type: MessageType.ERROR,
        message: 'Invalid filter format'
    },
    [MessageCode.VALIDATION_INVALID_STATUS]: {
        type: MessageType.ERROR,
        message: 'Invalid status'
    },

    // System Messages
    [MessageCode.SYSTEM_ERROR]: {
        type: MessageType.ERROR,
        message: 'Internal server error'
    },
    [MessageCode.SYSTEM_UNAUTHORIZED]: {
        type: MessageType.ERROR,
        message: 'Unauthorized'
    },
    [MessageCode.SYSTEM_FORBIDDEN]: {
        type: MessageType.ERROR,
        message: 'Forbidden'
    },
    [MessageCode.SYSTEM_NOT_FOUND]: {
        type: MessageType.ERROR,
        message: 'Resource not found'
    },
    [MessageCode.SYSTEM_BAD_REQUEST]: {
        type: MessageType.ERROR,
        message: 'Bad request'
    }
} as const; 