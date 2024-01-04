const { prepareRoughPlanQuery, prepareRoughPlanConfirmationQuery } = require('./llmQueries.js');
const { queryLlm, iterateLlmQuery } = require('./llmService.js');

async function generateRoughPlan(taskDescription, summary) {
  const systemPrompt = `You are a software development strategist, skilled in translating complex codebase insights into actionable coding plans with a keen eye on the end user experience. Your task is to meticulously examine relevant files and commits from a Git repository, considering the nuances of the project's coding style, structure, best practices in JavaScript, and the impact on the end user. Just focus on the code-writing and DO NOT worry about setting up the environment, cloning the repo, committing changes, deployment, code review, documentation, or what happens after the code is written. Utilize the detailed information provided from the repository, such as the provided summary and Git blame and history data, to understand the evolution and current state of the codebase. Incorporate details from the summary and git blame and history data into your plan. DO NOT create tasks to read the code that is already provided. Instead, distill that information into the plan itself.

  Based on your analysis, craft a detailed plan of steps needed to complete the given coding task. Your plan should address aspects like variable and route naming, adherence to JavaScript best practices, continuation of the existing coding style, logical file organization within the repository, ensuring testability, implementing efficient logging mechanisms, and enhancing the end user experience.
  
  Format your response as a structured list of steps, each step thoroughly detailed to guide the implementation process. Pay attention to technical specifics, project-specific nuances, and user interface and experience considerations to ensure the plan is not only theoretically sound but also practically applicable and user-friendly. Your output should serve as a comprehensive guide for developers to execute the task seamlessly, respecting the established patterns and standards of the existing codebase, while prioritizing the needs and satisfaction of the end user.`;

  const query = prepareRoughPlanQuery(taskDescription, summary);
  const response = await queryLlm([{role: 'system', content: systemPrompt}, {role: 'user', content: query}]);

  // Confirm response
  const confirmationResponse = await confirmRoughPlanWithLlm(response, taskDescription, summary, systemPrompt);
  return confirmationResponse;
}

async function confirmRoughPlanWithLlm(roughPlan, taskDescription, summary, systemPrompt) {
  let currentRoughPlan = roughPlan;
  // Prepare the query to confirm the rough plan
  const initialConfirmationQuery = prepareRoughPlanConfirmationQuery(roughPlan, taskDescription, summary);

  async function refineRoughPlanQueryFunction(llmResponse, currentQuery) {
    if (!llmResponse.includes('ok') && llmResponse.length < 10) {
      currentRoughPlan = llmResponse;
    }
    return prepareRoughPlanConfirmationQuery(llmResponse, taskDescription, summary);
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