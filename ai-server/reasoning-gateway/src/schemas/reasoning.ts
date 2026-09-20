export const reasoningSchema = {
  body: {
    type: 'object',
    required: ['messages'],
    additionalProperties: false,
    properties: {
      tier: {
        type: 'string',
        enum: ['local', 'frontier'],
      },
      messages: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['role', 'content'],
          additionalProperties: false,
          properties: {
            role: {
              type: 'string',
              enum: ['system', 'user', 'assistant'],
            },
            content: {
              type: 'string',
              minLength: 1,
            },
          },
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      required: ['jobId', 'status'],
      additionalProperties: false,
      properties: {
        jobId: {
          type: "string",
        },
        status: {
          type: "string",
          enum: ["queued"],
        },
      },
    },

    400: {
      type: 'object',
      required: ['statusCode', 'error', 'message'],
      properties: {
        statusCode: {
          type: 'number',
        },
        error: {
          type: 'string',
        },
        message: {
          type: 'string',
        },
      },
    },
  },
} as const;