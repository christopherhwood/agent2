const { prepareTaskTreeQuery } = require('./llmQueries.js');
const { queryLlmWithJsonCheck } = require('../../llmService.js');
const { TaskTreeGeneratorSystemPrompt } = require('./systemPrompts.js');

async function generateTaskTree(taskDescription, summary, roughPlan) {
  const query = prepareTaskTreeQuery(taskDescription, JSON.stringify(summary), roughPlan);
  const response = await queryLlmWithJsonCheck([{role: 'system', content: TaskTreeGeneratorSystemPrompt}, {role: 'user', content: query}]);

  return response;
}

module.exports = {
  generateTaskTree
};