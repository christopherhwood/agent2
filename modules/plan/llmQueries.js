function prepareRoughPlanQuery(taskDescription, summary) {
  let query = `## Task Description\n${taskDescription}\n\n`;
  query += `## Summary\n${summary}\n\n`;

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

function prepareRoughPlanConfirmationQuery(roughPlan, taskDescription, summary) {
  let query = `## Rough Plan for Confirmation\n${roughPlan}\n\n`;
  query += `## Task Description\n${taskDescription}\n\n`;
  query += `## Summary\n${summary}\n\n`;

  query += '## Confirmation Request\n';
  query += 'Examine the above rough plan. Determine if it is sufficient and accurate for the task description and the summary. ';
  query += 'Ensure the plan DOES NOT mention anything about environment setup or cloning the repo. ';
  query += 'Ensure the plan DOES NOT mention anything about committing changes, deployment, code review, or documentation. ';
  query += 'If it is sufficient, respond with "ok". If not, make edits where needed and provide a revised plan. ';
  query += 'Revised plans will overwrite previous plans, and as such they must not refer to previous summary contents in any way.\n\n';
  query += 'A revised plan should: \n';
  query += '- Include a list of steps to follow.\n';
  query += '- Include any additional information that would be helpful.\n';
  query += '- Use Markdown formatting to enhance readability and structure.\n';

  return query;
}

function prepareTaskTreeQuery(taskDescription, summary, roughPlan) {
  return `
      Create a JSON-structured list of coding tasks based on the following Markdown-formatted inputs:
  
      1. Rough Text Plan (in Markdown):
         \`\`\`markdown
         ${roughPlan}
         \`\`\`
  
      2. Original Task Description:
         ${taskDescription}
  
      3. Summary of the Codebase (in JSON):
         \`\`\`json
         ${summary}
         \`\`\`
  
      Analyze the rough text plan, which details the coding strategy for a developer in a pre-setup environment, leading to a pull request. This plan, along with the task description and codebase summary, are your guides.
  
      Your task is to dissect this plan into individual, actionable coding tasks, each formatted as a JSON object. Include in each task: a unique identifier, title, detailed description, pseudocode, dependencies, and completion criteria.
  
      Ensure that each task is comprehensive and self-contained, equipped with all the information necessary for independent execution by a developer. The aim is to create a clear, structured series of tasks that accurately follow the plan and are aligned with the project's goals, as outlined in the Markdown-formatted inputs.
  
      Structure your response as a JSON file containing a list of these tasks, formatted for straightforward implementation in the coding process.
    `;
}

module.exports = {
  prepareRoughPlanQuery,
  prepareRoughPlanConfirmationQuery,
  prepareTaskTreeQuery,
};