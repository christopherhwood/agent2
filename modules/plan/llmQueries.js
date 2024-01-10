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
  let query = `## Task Description\n${taskDescription}\n\n`;
  query += `## Summary\n${summary}\n\n`;
  query += `## Rough Plan\n${roughPlan}\n\n`;

  query += '## Task Tree Request\n';
  query += 'Based on the task description, summary, and rough plan above, ';
  query += 'please provide a task tree for completing the task. ';
  query += 'The task tree should include a list of steps to follow, ';
  query += 'and leaf tasks should be granular to the point of only requiring inserting code, replacing code, deleting code, or executing a terminal command (like npm commands, creating a new file, etc). ';
  query += 'Each leaf task should be as detailed as possible in the description and should explicitly mention whether code should be added, replaced, or deleted or if a terminal command is needed. ';
  query += 'DO NOT include tasks like reviewing files that are already attached. Instead, distill the keypoints from those files into the plan. ';
  query += 'DO NOT include setting up the environment or cloning the repo. ';
  query += 'DO NOT include committing changes, deployment, code review, or documentation. ';
  query += 'Reply using json with the following recursive structure: {title: "", description: "", subtasks: []}.';

  return query;
}

function prepareTaskTreeConfirmationQuery(taskTree, taskDescription, summary, roughPlan) {
  let query = `## Task Tree for Confirmation\n${JSON.stringify(taskTree)}\n\n`;
  query += `## Task Description\n${taskDescription}\n\n`;
  query += `## Summary\n${summary}\n\n`;
  query += `## Rough Plan\n${roughPlan}\n\n`;

  query += '## Confirmation Request\n';
  query += 'Examine the above task tree. Determine if it is sufficient and accurate for the task description, summary, and rough plan. ';
  query += 'Ensure the tree DOES NOT mention anything about environment setup or cloning the repo. ';
  query += 'Ensure the tree DOES NOT mention anything about committing changes, deployment, code review, or documentation. ';
  query += 'If it is sufficient, respond with an empty json object. If not, make edits where needed and provide a revised task tree. ';
  query += 'Revised task trees will overwrite previous task trees, and as such they must not refer to previous task tree contents in any way.\n\n';
  query += 'A revised task tree should: \n';
  query += '- Include a list of steps to follow.\n';
  query += '- Be extremely detailed in the descriptions.\n';
  query += '- Include leaf nodes that are granular to the point of only requiring inserting code, replacing code, deleting code, or executing a terminal command (like npm commands, creating a new file, etc).\n';
  query += '- Explicity mention whether code should be added, replaced, or deleted or if a terminal command is needed.\n';
  query += '- Use json with the following recursive structure: {title: "", description: "", subtasks: []}.\n';

  return query;
}

module.exports = {
  prepareRoughPlanQuery,
  prepareRoughPlanConfirmationQuery,
  prepareTaskTreeQuery,
  prepareTaskTreeConfirmationQuery
};