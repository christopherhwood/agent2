const { queryLlmWithJsonCheck } = require('../../../llmService');

async function rankCode(task, problemStatement, fileContextMap) {
  const res = await queryLlmWithJsonCheck([{role: 'system', content: createRankCodeSystemPrompt(task, problemStatement)}, {role: 'user', content: query(fileContextMap)}], validateSelectedSnippetJson);
  return res.selected;
}

const validateSelectedSnippetJson = (json) => {
  if (!json || !json.selected) {
    throw new Error('Invalid JSON format. Please provide a JSON object with a "selected" key.');
  }
  if (!Array.isArray(json.selected)) {
    throw new Error('Invalid JSON format. The "selected" key must be an array.');
  }
  if (json.selected.length > 4) {
    json.selected = json.selected.slice(0, 4);
  }
  for (const snippet of json.selected) {
    if (!snippet.file || !snippet.codeSnippet) {
      throw new Error('Invalid JSON format. Each snippet must have a "file" and "codeSnippet" property.');
    }
  }
  return json;
};

const query = (fileContextMap) => {
  const snippets = [];
  for (const key of Object.keys(fileContextMap)) {
    for (const snippet of fileContextMap[key]) {
      snippets.push({'file': key, 'codeSnippet': snippet});
    }
  }
  const candidates = {candidates: snippets};
  return `\`\`\`json
  ${JSON.stringify(candidates)}
  \`\`\``;
};

const createRankCodeSystemPrompt = (task, problemStatement) => {
  return `You are an advanced ranking system, specifically designed to evaluate and prioritize code snippets retrieved from a vector search, in the context of a specified coding task. Your responsibility is to analyze a set of code snippets and select the top four that are most likely to be helpful to a developer working on the given task. This task will be defined by a title, description, and specific coding requirements.

  When presented with a task and a problem statement, along with 10 code snippets, your role is to:
  
  1. Thoroughly understand the task, including its title, description, and the coding work that needs to be done.
  2. Carefully examine each of the 10 code snippets to assess their relevance and utility in relation to the task.
  3. Prioritize snippets that are directly related to the task. This includes code that:
     - Is the integration point defined in the task.
     - Is directly referenced in the task.
     - Contains elements that need to be changed or adapted to satisfy the task requirements.
  4. Consider including snippets that might be helpful depending on the developer's approach to solving the task. This includes speculative choices for code that could be integrated or may be related, but is not directly implicated in the task.
  
  Your output will be a JSON-formatted array, listing the top four selected code snippets. It's important to note that you can choose more than one snippet from a single file, but the total number of snippets selected must not exceed four. The format of your response will be:
  \`\`\`json
  {
    "selected": [
      {"file": "FileName1", "codeSnippet": "Selected Code Snippet 1"},
      {"file": "FileName2", "codeSnippet": "Selected Code Snippet 2"},
      {"file": "FileName3", "codeSnippet": "Selected Code Snippet 3"},
      {"file": "FileName4", "codeSnippet": "Selected Code Snippet 4"}
      // Only four snippets are selected
    ]
  }
  \`\`\`
  In selecting these snippets, your aim is to provide the most relevant and practical code that will aid the developer in efficiently addressing the task at hand. Your careful analysis and ranking are vital in streamlining the development process and enhancing productivity.
  
  The task and problem statement are as follows:
  **Task:**
  \`\`\`json
  ${JSON.stringify(task)}
  \`\`\`
  **ProblemStatement:**
  \`\`\`markdown
  ${problemStatement}
  \`\`\``;
};

module.exports = { rankCode };