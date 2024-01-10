const { iterateLlmQuery, queryLlm } = require('../../llmService');
const { prepareSummaryQuery, prepareSummaryConfirmationQuery } = require('./llmQueries');
const { SummarizerSystemPrompt } = require('./systemPrompts');

async function generateSummaryFromImportantCode(taskDescription, repoContext, importantCode) {
  const summaryQuery = prepareSummaryQuery(taskDescription, importantCode);
  const finalSummary = await generateAndConfirmSummaryWithLlm(summaryQuery, taskDescription, importantCode, SummarizerSystemPrompt);
  return finalSummary;
}

async function generateAndConfirmSummaryWithLlm(summaryQuery, taskDescription, keyFiles, systemPrompt) {
  // First, get the initial summary from GPT
  let summaryResponse = await queryLlm([{role: 'system', content: systemPrompt}, {role: 'user', content: summaryQuery}]);
  console.log('initialSummaryResponse:');
  console.log(summaryResponse);

  // Prepare the query to confirm the summary
  const initialConfirmationQuery = prepareSummaryConfirmationQuery(summaryResponse, taskDescription, keyFiles);

  async function refineSummaryQueryFunction(llmResponse) {
    if (!llmResponse.includes('ok') && llmResponse.length < 10) {
      summaryResponse = llmResponse;
    }
    return prepareSummaryConfirmationQuery(llmResponse, taskDescription, keyFiles);
  }

  function isSummarySufficientFunction(llmResponse) {
    // Check if GPT's response is "ok", indicating the summary is sufficient
    return llmResponse.includes('ok') && llmResponse.length < 10;
  }

  // Use iterateLlmQuery for the iterative confirmation process
  await iterateLlmQuery(initialConfirmationQuery, refineSummaryQueryFunction, isSummarySufficientFunction, systemPrompt, queryLlm);
  return summaryResponse;
}

module.exports = {
  generateSummaryFromImportantCode
};