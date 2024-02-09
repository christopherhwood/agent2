require('../__mocks__/llmService');
require('../__mocks__/mongoose');
require('dotenv').config();
const mongoose = require('mongoose');
const request = require('supertest');
const { connectDB, disconnectDB } = require('../modules/db/db');

// Test suite for API endpoints
describe('API Endpoints Test Suite', () => {
  let server;

  beforeAll(async () => {
    await connectDB();
    const app = require('../app');
    server = app.listen();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDB();
    return new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });
  // Test for task deep dive generation
  describe('POST /api/generate-task-deep-dive', () => {
    it('should require both taskDescription and repositorySummary', async () => {
      const response = await request(server)
        .post('/api/generate-task-deep-dive')
        .send({ taskDescription: 'Sample task' }); // Missing repositorySummary
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Both taskDescription and repositorySummary are required');
    });

    it('should generate a deep dive for a valid request', async () => {
      const response = await request(server)
        .post('/api/generate-task-deep-dive')
        .send({ taskDescription: 'Sample task', repositorySummary: {} });
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('deepDiveResult');
    });
  });

  // Test for refactored plan generation process
  describe('POST /api/generate-plan', () => {
    it('should require taskDeepDive parameter', async () => {
      const response = await request(server)
        .post('/api/generate-plan')
        .send({ taskDescription: 'Sample task', gitRepoUrl: 'https://example.com/repo.git', summary: {} }); // Missing taskDeepDive
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('"taskDeepDive" is a required parameter');
    });
  });
});

