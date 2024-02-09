jest.mock('../llmService', () => ({
  queryLlm: jest.fn().mockResolvedValue('test content'),
  queryLlmWithJsonCheck: jest.fn().mockResolvedValue({}),
  queryLlmWTools: jest.fn().mockResolvedValue(''),
  queryLlmWithTools: jest.fn().mockResolvedValue(''),
}));