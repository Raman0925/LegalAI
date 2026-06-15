const COUNTRY_CODE_SCHEMA = {
  type: 'string',
  pattern: '^\\+[1-9][0-9]{0,3}$',
};

const PHONE_NUMBER_SCHEMA = {
  type: 'string',
  pattern: '^[0-9]{7,15}$',
};

export const registerValidator = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      format: 'email',
    },
    countryCode: COUNTRY_CODE_SCHEMA,
    phoneNumber: PHONE_NUMBER_SCHEMA,
    pin: {
      type: 'string',
      minLength: 4,
      maxLength: 6,
    },
  },
  required: ['email', 'countryCode', 'phoneNumber', 'pin'],
  additionalProperties: false,
};

export const loginValidator = {
  type: 'object',
  properties: {
    countryCode: COUNTRY_CODE_SCHEMA,
    phoneNumber: PHONE_NUMBER_SCHEMA,
    pin: {
      type: 'string',
      minLength: 4,
      maxLength: 6,
    },
  },
  required: ['countryCode', 'phoneNumber', 'pin'],
  additionalProperties: false,
};

export const refreshTokenValidator = {
  type: 'object',
  properties: {
    headers: {
      type: 'object',
      properties: {
        authorization: {
          type: 'string',
          pattern: '^Bearer .+',
        },
      },
      required: ['authorization'],
    },
  },
};

export const registerResponseSchema = {
  type: 'object',
  properties: {
    accountHolder: {
      type: 'object',
      properties: {
        _id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        countryCode: { type: 'string' },
        phoneNumber: { type: 'string' },
        isKYCVerified: { type: 'boolean' },
        streak: {
          type: 'object',
          properties: {
            current: { type: 'number' },
            longest: { type: 'number' },
            lastActivityDate: { type: ['string', 'null'], format: 'date-time' },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
  },
  required: ['accountHolder', 'accessToken', 'refreshToken'],
};

export const loginResponseSchema = {
  type: 'object',
  properties: {
    accountHolder: {
      type: 'object',
      properties: {
        _id: { type: 'string' },
        email: { type: 'string', format: 'email' },
        countryCode: { type: 'string' },
        phoneNumber: { type: 'string' },
        isKYCVerified: { type: 'boolean' },
        streak: {
          type: 'object',
          properties: {
            current: { type: 'number' },
            longest: { type: 'number' },
            lastActivityDate: { type: ['string', 'null'], format: 'date-time' },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
  },
  required: ['accountHolder', 'accessToken', 'refreshToken'],
};

export const refreshResponseSchema = {
  type: 'object',
  properties: {
    accessToken: { type: 'string' },
  },
  required: ['accessToken'],
};

export const errorResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'number' },
    error: { type: 'string' },
    message: { type: 'string' },
  },
};
