const { queryLlm } = require('../../llmService.js');

async function generateRoughPlan(taskDescription, summary, answers) {

  const query = prepareRoughPlanQuery(taskDescription, summary, answers);
  const response = await queryLlm([{role: 'system', content: RoughPlannerSystemPrompt}, {role: 'user', content: query}]);

  return response;
  // Below is commented out for now, might use later. 
  // Confirm response
  // const confirmationResponse = await confirmRoughPlanWithLlm(response, taskDescription, summary, answers, RoughPlannerSystemPrompt);
  // return confirmationResponse;
}

// async function confirmRoughPlanWithLlm(roughPlan, taskDescription, summary, answers, systemPrompt) {
//   let currentRoughPlan = roughPlan;
//   // Prepare the query to confirm the rough plan
//   const initialConfirmationQuery = prepareRoughPlanConfirmationQuery(roughPlan, taskDescription, summary, answers);

//   async function refineRoughPlanQueryFunction(llmResponse) {
//     if (!llmResponse.includes('ok') && llmResponse.length < 10) {
//       currentRoughPlan = llmResponse;
//     }
//     return prepareRoughPlanConfirmationQuery(llmResponse, taskDescription, summary, answers);
//   }

//   function isRoughPlanSufficientFunction(llmResponse) {
//     // Check if GPT's response is "ok", indicating the rough plan is sufficient
//     return llmResponse.includes('ok') && llmResponse.length < 10;
//   }

//   // Use iterateLlmQuery for the iterative confirmation process
//   await iterateLlmQuery(initialConfirmationQuery, refineRoughPlanQueryFunction, isRoughPlanSufficientFunction, systemPrompt, queryLlm);
//   return currentRoughPlan;
// }

function prepareRoughPlanQuery(taskDescription, summary, answers) {
  let query = `## Task Description\n${taskDescription}\n\n`;
  query += `## Summary\n${summary}\n\n`;
  query += '## Tips\n';
  for (const answer of answers) {
    query += `  - ${answer.question}\n`;
    query += `    - ${answer.answer}\n`;
  }

  query += '## Rough Plan Request\n';
  query += 'Based on the task description and summary above, ';
  query += 'please provide a rough plan for completing the task. ';
  query += 'The plan should include a list of steps to follow, ';
  query += 'as well as any additional information that would be helpful. ';
  query += 'DO NOT include tasks like reviewing files that are already attached. Instead, distill the keypoints from those files into the plan. ';
  query += 'DO NOT include setting up the environment or cloning the repo. ';
  query += 'DO NOT include committing changes, deployment, code review, or documentation. ';
  query += 'Use Markdown formatting to enhance readability and structure.';

  return query;
}

// function prepareRoughPlanConfirmationQuery(roughPlan, taskDescription, summary, answers) {
//   let query = `## Rough Plan for Confirmation\n${roughPlan}\n\n`;
//   query += `## Task Description\n${taskDescription}\n\n`;
//   query += `## Summary\n${summary}\n\n`;
//   query += '## Tips\n';
//   for (const answer of answers) {
//     query += `  - ${answer.question}\n`;
//     query += `    - ${answer.answer}\n`;
//   }

//   query += '## Confirmation Request\n';
//   query += 'Examine the above rough plan. Determine if it is sufficient and accurate for the task description and the summary. ';
//   query += 'Ensure the plan DOES NOT mention anything about environment setup or cloning the repo. ';
//   query += 'Ensure the plan DOES NOT mention anything about committing changes, deployment, code review, or documentation. ';
//   query += 'If it is sufficient, respond with "ok". If not, make edits where needed and provide a revised plan. ';
//   query += 'Revised plans will overwrite previous plans, and as such they must not refer to previous summary contents in any way.\n\n';
//   query += 'A revised plan should: \n';
//   query += '- Include a list of steps to follow.\n';
//   query += '- Include any additional information that would be helpful.\n';
//   query += '- Use Markdown formatting to enhance readability and structure.\n';

//   return query;
// }

const RoughPlannerSystemPrompt = `Your task as an expert software development strategist is to create a detailed coding plan for a junior developer. Assume that the developer's environment is already properly setup. Give instructions to guide on code-writing up until the code is ready to submit for PR. Do NOT include instructions for how to submit the PR. The plan will utilize provided key files, relevant code snippets, and a summary of the codebase, along with the user's original task.

In your plan:

1. Integrate the provided files, code snippets, and task summary with the existing codebase and project objectives to ensure seamless alignment.

2. Include code testing and review best practices within each coding step, suitable for a developer working in isolation. As there will be no external code review, these practices are critical for maintaining code quality.

3. Ensure each step clearly describes how to incorporate new code or modifications without disrupting existing logic. Explicitly outline the integration process of new developments with current functionalities.

4. Be thorough and explicit, covering every detail from the start of coding to being feature complete. Focus on specific actions, methodologies, and reasoning, tailored to the nuances of the existing codebase.

5. Concentrate exclusively on the code-editing process within the pre-setup environment. Assume that the developer's environment has all necessary tools and configurations, unless your plan involves importing new dependencies. Exclude steps unrelated to the coding task, such as environment setup, deployment, PR submission, or post-PR activities.

6. Remind the developer to adhere to code review standards independently. Emphasize self-review processes to identify and address potential issues before submitting the PR.

7. Ensure the task order is logical. Consider dependencies between tasks, as well as the overall flow of the development process.

Your output should be a comprehensive, step-by-step coding guide, clearly detailing the necessary actions, their purpose, and their contribution to the overall project. This plan is designed to empower a developer to independently execute the tasks with confidence, leading to the submission of a high-quality, thoughtful PR.`;

module.exports = {
  generateRoughPlan
};