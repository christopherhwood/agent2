const { prepareRoughPlanQuery, prepareRoughPlanConfirmationQuery } = require('./llmQueries.js');
const { queryLlm, iterateLlmQuery } = require('../../llmService.js');
const { RoughPlannerSystemPrompt } = require('./systemPrompts.js');

async function generateRoughPlan(taskDescription, summary) {

  const query = prepareRoughPlanQuery(taskDescription, JSON.stringify(summary));
  const response = await queryLlm([{role: 'system', content: RoughPlannerSystemPrompt}, {role: 'user', content: query}]);

  // Confirm response
  const confirmationResponse = await confirmRoughPlanWithLlm(response, taskDescription, summary, RoughPlannerSystemPrompt);
  return confirmationResponse;
}

async function confirmRoughPlanWithLlm(roughPlan, taskDescription, summary, systemPrompt) {
  let currentRoughPlan = roughPlan;
  // Prepare the query to confirm the rough plan
  const initialConfirmationQuery = prepareRoughPlanConfirmationQuery(roughPlan, taskDescription, JSON.stringify(summary));

  async function refineRoughPlanQueryFunction(llmResponse) {
    if (!llmResponse.includes('ok') && llmResponse.length < 10) {
      currentRoughPlan = llmResponse;
    }
    return prepareRoughPlanConfirmationQuery(llmResponse, taskDescription, JSON.stringify(summary));
  }

  function isRoughPlanSufficientFunction(llmResponse) {
    // Check if GPT's response is "ok", indicating the rough plan is sufficient
    return llmResponse.includes('ok') && llmResponse.length < 10;
  }

  // Use iterateLlmQuery for the iterative confirmation process
  await iterateLlmQuery(initialConfirmationQuery, refineRoughPlanQueryFunction, isRoughPlanSufficientFunction, systemPrompt, queryLlm);
  return currentRoughPlan;
}

module.exports = {
  generateRoughPlan
};