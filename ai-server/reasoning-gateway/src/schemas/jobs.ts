export const getJobSchema = {
  params: {
    type: "object",
    required: ["jobId"],
    properties: {
      jobId: {
        type: "string",
        minLength: 1,
      },
    },
  },
} as const;

export const cancelJobSchema = {
  params: {
    type: "object",
    required: ["jobId"],
    additionalProperties: false,
    properties: {
      jobId: {
        type: "string",
        minLength: 1,
      },
    },
  },
} as const;