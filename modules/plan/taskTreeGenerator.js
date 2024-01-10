const { prepareTaskTreeQuery, prepareTaskTreeConfirmationQuery } = require('./llmQueries.js');
const { queryLlmWithJsonCheck, iterateLlmQuery } = require('../../llmService.js');
const { TaskTreeGeneratorSystemPrompt } = require('./systemPrompts.js');

async function generateTaskTree(taskDescription, summary, roughPlan) {
  const query = prepareTaskTreeQuery(taskDescription, JSON.stringify(summary), roughPlan);
  const response = await queryLlmWithJsonCheck([{role: 'system', content: TaskTreeGeneratorSystemPrompt}, {role: 'user', content: query}]);

  // Confirm response
  const confirmationResponse = await confirmTaskTreeWithLlm(response, taskDescription, summary, roughPlan, TaskTreeGeneratorSystemPrompt);
  return confirmationResponse;
}

async function confirmTaskTreeWithLlm(taskTree, taskDescription, summary, roughPlan, systemPrompt) {
  let currentTaskTree = taskTree;
  // Prepare the query to confirm the rough plan
  const initialConfirmationQuery = prepareTaskTreeConfirmationQuery(taskTree, taskDescription, JSON.stringify(summary), roughPlan);

  async function refineTaskTreeQueryFunction(llmResponse) {
    if (llmResponse != {}) {
      currentTaskTree = llmResponse;
    }
    return prepareTaskTreeConfirmationQuery(llmResponse, taskDescription, JSON.stringify(summary), roughPlan);
  }

  function isTaskTreeSufficientFunction(llmResponse) {
    // Check if GPT's response is "ok", indicating the rough plan is sufficient
    return llmResponse != {};
  }

  // Use iterateLlmQuery for the iterative confirmation process
  await iterateLlmQuery(initialConfirmationQuery, refineTaskTreeQueryFunction, isTaskTreeSufficientFunction, systemPrompt, queryLlmWithJsonCheck);
  return currentTaskTree;
}

module.exports = {
  generateTaskTree
};