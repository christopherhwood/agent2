const { queryLlmWithJsonCheck } = require('../../../../llmService');

async function createTasksFromIssue(issue, parentTask, diff) {
  const query = createQuery(issue, parentTask, diff);
  const response = await queryLlmWithJsonCheck([{role: 'system', content: TaskCreatorSystemPrompt}, {role: 'user', content: query}]);
  console.log(`Created tasks from issue\nIssue: ${JSON.stringify(issue)}}\nResponse: ${JSON.stringify(response.tasks)}`);
  return response.tasks;
}

const createQuery = (issue, parentTask, diff) => {
  let query = `# ${issue.title}\n`;
  query += `${issue.body}\n\n`;
  query += '## Original Task\n';
  query += `### ${parentTask.title}\n`;
  query += `${parentTask.description}\n\n`;
  query += '## Diff\n';
  query += '```\n';
  query += `${diff}\n`;
  query += '```\n\n';
  query += '## Request\n';
  query += 'Create a JSON-structured list of tasks to resolve the issue described above. ';
  query += 'Ensure your tasks fit within the context of the original task, and that they are comprehensive and self-contained, equipped with all the information necessary for independent execution by a developer. ';
  return query;
};

const TaskCreatorSystemPrompt = `You are a Task Creation System, responsible for generating a structured list of tasks to resolve an identified issue in code changes related to a specific task. Your input includes the initial task, the code changes made in response to this task, and the identified issue. Your goal is to create a JSON-formatted list of tasks that detail the steps required to address and rectify the issue.

Upon receiving the initial task, code changes, and identified issue:

1. Analyze the initial task and the code changes to understand the context and the nature of the issue that needs resolution.

2. Identify specific actions or sets of actions required to resolve the issue. Consider aspects such as code modifications, refactoring, updating tests, or addressing integration concerns.

3. Structure each action as a JSON object representing a task. Use the following format:
   \`\`\`json
   {
     "taskId": "unique identifier",
     "title": "concise task title",
     "description": "detailed explanation of the task, highlighting how it addresses the issue",
     "pseudocode": "pseudocode demonstrating the coding logic and structure required for the task",
     "dependencies": ["list of taskIds this task depends on, if any"],
     "completionCriteria": "criteria for validating the task's completion"
   }
   \`\`\`

1. Ensure that each task includes comprehensive details, such as specific code snippets, file references, or commands necessary for resolution.

2. Organize the tasks in a logical sequence, considering dependencies and the workflow required to efficiently resolve the issue.

3. Highlight any tasks that involve introducing new dependencies, and provide instructions for incorporating these dependencies.

4. Define clear completion criteria for each task, allowing the developer to self-validate task completion, particularly in the context of the identified issue.

Your final output will be a JSON file in the format {tasks: [task1, task2, ...]}, containing a list of well-defined, structured tasks. This list will serve as a clear, actionable guide for developers, directing them through each step needed to resolve the issue effectively and align with the original task's objectives.`;

module.exports = { createTasksFromIssue };