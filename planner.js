const { prepareRoughPlanQuery, prepareRoughPlanConfirmationQuery, prepareTaskTreeQuery, prepareTaskTreeConfirmationQuery } = require('./llmQueries.js');
const { queryLlm, queryLlmWithJsonCheck, iterateLlmQuery } = require('./llmService.js');

async function generateRoughPlan(taskDescription, summary) {
  const systemPrompt = `You are a software development strategist, skilled in translating complex codebase insights into actionable coding plans with a keen eye on the end user experience. Your task is to meticulously examine relevant files and commits from a Git repository, considering the nuances of the project's coding style, structure, best practices in JavaScript, and the impact on the end user. Just focus on the code-writing and DO NOT worry about or include steps for setting up the environment, cloning the repo, committing changes, deployment, code review, documentation, or what happens after the code is written. Utilize the detailed information provided from the repository, such as the provided summary and Git blame and history data, to understand the evolution and current state of the codebase. Incorporate details from the summary and git blame and history data into your plan. DO NOT create tasks to read the code that is already provided. Instead, distill that information into the plan itself.

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

async function generateTaskTree(taskDescription, summary, roughPlan) {
  const systemPrompt = `You are a task structuring specialist, adept at converting high-level plans into detailed, actionable task trees. Your primary function is to analyze the provided rough plan, summary, and original task description to formulate a comprehensive task tree. The tree will guide developers through the coding process, breaking down the tasks into granular steps necessary to complete the project.

  Upon receiving the input, you will distill the essence of the plan into a structured JSON format, with each entry in the format {title: "", description: "", subtasks: []}. The root of this tree represents the overall task, with branches detailing subtasks and leaves representing the most granular actions required, such as inserting code, replacing code, deleting code, or executing specific terminal commands (e.g., npm commands, creating a new file).
  
  Each leaf task in the tree must be detailed, specifying the exact action needed, and should be as atomic as possible, aiming for clarity and precision. Avoid including preliminary setup tasks such as environment setup, repo cloning, or post-completion tasks like committing changes, deployment, code review, documentation, or monitoring in production. Instead, focus the tree on the core development activities that directly contribute to the task's completion.
  
  Your output should be a clear, structured JSON object representing the entire task tree, ready to guide developers through the task with efficiency and clarity.`;
  const query = prepareTaskTreeQuery(taskDescription, summary, roughPlan);
  const response = await queryLlmWithJsonCheck([{role: 'system', content: systemPrompt}, {role: 'user', content: query}]);

  // Confirm response
  const confirmationResponse = await confirmTaskTreeWithLlm(response, taskDescription, summary, roughPlan, systemPrompt);
  return confirmationResponse;
}

async function confirmTaskTreeWithLlm(taskTree, taskDescription, summary, roughPlan, systemPrompt) {
  let currentTaskTree = taskTree;
  // Prepare the query to confirm the rough plan
  const initialConfirmationQuery = prepareTaskTreeConfirmationQuery(taskTree, taskDescription, summary, roughPlan);

  async function refineTaskTreeQueryFunction(llmResponse, currentQuery) {
    if (llmResponse != {}) {
      currentTaskTree = llmResponse;
    }
    return prepareTaskTreeConfirmationQuery(llmResponse, taskDescription, summary, roughPlan);
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
  generateRoughPlan,
  generateTaskTree
};