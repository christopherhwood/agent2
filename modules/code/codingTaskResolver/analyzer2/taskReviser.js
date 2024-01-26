const { queryLlmWithJsonCheck } = require('../../../../llmService');

// This reviews the original task to determine if we should continue with the original task or abandon it and create a new task
async function decideToContinue(task, issues, diff) {
  const query = createQuery(task, issues, diff);
  const response = await queryLlmWithJsonCheck([{role: 'system', content: SystemPrompt}, {role: 'user', content: query}], validateJson);
  console.log(`Decision to continue\nTask: ${task.title}\nResponse: ${JSON.stringify(response)}`);
  return response.decision === 'continue';
}

const validateJson = (json) => {
  if (!json.decision || (json.decision !== 'continue' && json.decision !== 'abandon')) {
    throw new Error('Invalid decision');
  }
  return json;
};

const createQuery = (task, issues, diff) => {
  let query = `# ${task.title}\n`;
  query += `${task.description}\n\n`;
  query += '## Diff\n';
  query += '```\n';
  query += `${diff}\n`;
  query += '```\n\n';
  query += '## Issues\n';
  for (const issue of issues) {
    query += `### ${issue.title}\n`;
    query += `${issue.body}\n\n`;
  }
  query += '## Request\n';
  query += 'Review the task, the diff, and the identified issues. ';
  query += 'In light of the issues raised, determine if the original task still makes sense to continue iterating on or if it should be abandoned and rethought. ';
  query += 'Reply with your decision using the json format {decision: \'abandon\' or \'continue\', message: \'\'} ';
  return query;
};

const SystemPrompt = `You are a Task Continuation System, responsible for determining if a given task should be continued or abandoned. Your input includes the original task, the code changes made in response to this task, and any issues identified during the code review process. Your goal is to decide if the original task still makes sense to continue iterating on or if it should be abandoned and rethought.

Tasks that should be abandoned include tasks where the requested changes do not make sense given the current code structure and the work required to make the changes would require significant refactoring or considerable improvisation outside of what the task entails. Tasks that should be continued include tasks where the requested changes are still valid and the issues identified are minor and can be easily resolved.

Communicate your decision using json format {decision: 'abandon' or 'continue', message: ''}. Use the message field to explain your decision. Anything in the decision field besides 'abandon' or 'continue' is invalid.

Think carefully about your decision and the implications of abandoning a task. Abandoning a task means that the developer will not be able to complete the task as originally requested. This may result in the developer having to create a new task to replace the abandoned task. This may also result in the developer having to make significant changes to the codebase to accommodate the abandoned task. Abandoning a task should be a last resort. Only abandon a task if you are confident that the requested changes do not make sense given the current code structure and the work required to make the changes would require significant refactoring or considerable improvisation outside of what the task entails.`;

module.exports = { decideToContinue };