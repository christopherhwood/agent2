const { queryLlmWithJsonCheck } = require('../../llmService.js');

async function generateTaskTree(taskDescription, summary, answers, roughPlan) {
  const query = prepareTaskTreeQuery(taskDescription, summary, answers, roughPlan);
  const response = await queryLlmWithJsonCheck([{role: 'system', content: TaskTreeGeneratorSystemPrompt}, {role: 'user', content: query}]);

  return response;
}

function prepareTaskTreeQuery(taskDescription, summary, answers, roughPlan) {
  let answerList = '';
  for (const answer of answers) {
    answerList += `  - ${answer.question}\n`;
    answerList += `    - ${answer.answer}\n`;
  }
  return `
      Create a JSON-structured list of coding tasks based on the following Markdown-formatted inputs:
  
      1. Rough Text Plan (in Markdown):
         \`\`\`markdown
         ${roughPlan}
         \`\`\`
  
      2. Original Task Description:
         ${taskDescription}
  
      3. Summary of the Codebase (in Markdown):
         \`\`\`markdown
         ${summary}
         \`\`\`

      4. Tips for the Task:
          ${answerList}
  
      Analyze the rough text plan, which details the coding strategy for a developer in a pre-setup environment, leading to a pull request. This plan, along with the task description and codebase summary, are your guides.
  
      Your task is to dissect this plan into individual, actionable coding tasks, each formatted as a JSON object. Include in each task: a unique identifier, title, detailed description, pseudocode, dependencies, and completion criteria.
  
      Ensure that each task is comprehensive and self-contained, equipped with all the information necessary for independent execution by a developer. The aim is to create a clear, structured series of tasks that accurately follow the plan and are aligned with the project's goals, as outlined in the Markdown-formatted inputs.
  
      Structure your response as a JSON file containing a list of these tasks, formatted for straightforward implementation in the coding process.
    `;
}

const TaskTreeGeneratorSystemPrompt = `You are a Task Structuring Expert, tasked with transforming a detailed coding plan into a JSON-structured list of tasks. Your objective is to convert the narrative-style plan, crafted for a developer working in a pre-setup environment and culminating in a PR submission, into a structured, actionable format. Each task in this format should be clear, discrete, and focused on coding.

Upon receiving the coding plan:

1. Break down the plan into individual coding tasks, each task representing a specific coding action or a related set of coding actions.

2. Structure each task as a JSON object in the following format:
   \`\`\`json
   {
     "taskId": "unique identifier",
     "title": "concise task title",
     "description": "detailed explanation of the task, including specific steps and methodologies",
     "pseudocode": "pseudocode outlining the coding logic and structure required for the task",
     "dependencies": ["list of taskIds this task depends on, if any"],
     "completionCriteria": "criteria for validating the task's completion"
   }
    \`\`\`
    
3. Include comprehensive details in each task, such as specific code snippets, file references, or commands essential for task execution.

4. Arrange the tasks in a logical sequence, considering their dependencies and the overall flow of the development process.
    
5. Clearly indicate tasks that involve importing new dependencies, providing instructions for these imports.
    
6. For each task, specify how the developer can self-validate its completion, considering the isolated nature of the work environment.

Your final output will be a JSON file in the format {tasks: [task1, task2]} containing a list of well-defined, structured coding tasks. This file will act as a clear, actionable roadmap for developers, guiding them through each step of the coding process with precision and clarity.`;

module.exports = {
  generateTaskTree
};