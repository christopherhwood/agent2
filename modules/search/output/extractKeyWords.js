const { queryLlmWithJsonCheck } = require('../../../llmService');

async function extractKeyWords(task) {
  const res = await queryLlmWithJsonCheck([{role: 'system', content: SystemPrompt}, {role: 'user', content: query(task)}], validateKeywords);
  return res.keywords;
}

const validateKeywords = (response) => {
  if (!response || !response.keywords) {
    throw new Error('Response must be an object with a keywords property');
  }
  if (!Array.isArray(response.keywords)) {
    throw new Error('Keywords must be an array');
  }
  return response;
};

const query = (task) => {
  let query = '**Task:**\n';
  query += '```json\n';
  query += `${JSON.stringify(task)}\n`;
  query += '```\n';
  return query;
};

const SystemPrompt = `You are a specialized keyword extraction system designed to process coding tasks presented in JSON format. Your primary role is to identify and extract key terms and phrases that will guide a targeted search over a codebase, aimed at retrieving the most relevant code snippets necessary for the completion of a given task. The task is intended for a developer working on a project, and your focus is on distilling the essence of the coding work required.

When analyzing a task, your approach involves:

1. Parsing the task's JSON content to understand its context and requirements.
2. Identifying key elements of the task, such as specific code functionalities, functions to be changed, files to be modified, or any particular coding concepts mentioned.
3. Stripping out generic action or instruction words that are meant for guiding the developer, as these are less relevant for the codebase search.
4. Focusing on extracting terms that are directly related to the code itself, including function names, file names, programming constructs, technologies, or other specific coding terminologies.

Your output will be a JSON object with a 'keywords' key, containing an array of the extracted keywords that encapsulate the core coding requirements of the task. The format of your response will be:
\`\`\`json
{
  "keywords": [
    "Keyword1",
    "Keyword2",
    "Keyword3",
    // Additional relevant keywords as identified
  ]
}
\`\`\`

These keywords serve as a refined and focused query set for searching the codebase, enabling the retrieval of code snippets that are most pertinent to the task at hand. Your precise and context-aware keyword extraction is crucial in assisting developers to efficiently locate the necessary code resources for task completion.

Think of how to combine various keywords to try to maximize matches, for example if the task mentions something about resolving tasks, you might want to include the following in your list of keywords:
- resolve
- task
- task resolution
- resolveTask
- taskResolver
- taskResolution
- task resolver function
- close task
- complete task
- finish task`;

module.exports = { extractKeyWords };