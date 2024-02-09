// Import necessary modules
const request = require('supertest');
const app = require('../app');



// Test suite for API endpoints
describe('API Endpoints Test Suite', () => {
  // Test for task deep dive generation
  describe('POST /generate-task-deep-dive', () => {
    it('should require both taskDescription and repositorySummary', async () => {
      const response = await request(app)
        .post('/generate-task-deep-dive')
        .send({ taskDescription: 'Sample task' }); // Missing repositorySummary
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('Both taskDescription and repositorySummary are required');
    });

    it('should generate a deep dive for a valid request', async () => {
      const response = await request(app)
        .post('/generate-task-deep-dive')
        .send({ taskDescription: 'Sample task', repositorySummary: {} });
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('deepDiveResult');
    });
  });

  // Test for refactored plan generation process
  describe('POST /generate-plan', () => {
    it('should require taskDeepDive parameter', async () => {
      const response = await request(app)
        .post('/generate-plan')
        .send({ taskDescription: 'Sample task', gitRepoUrl: 'https://example.com/repo.git', summary: {} }); // Missing taskDeepDive
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe('"taskDeepDive" is a required parameter');
    });

    it('should generate a plan for a valid request', async () => {
      const response = await request(app)
        .post('/generate-plan')
        .send({ taskDescription: 'Sample task', gitRepoUrl: 'https://example.com/repo.git', summary: {}, taskDeepDive: {} });
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('message', 'Task list generated successfully');
      expect(response.body).toHaveProperty('tasks');
    });
  });
});

