const { queryLlmWithJsonCheck } = require('../../../../llmService');

async function generateSpec(task, problemStatement) {
  const res = await queryLlmWithJsonCheck([{role: 'system', content: SystemPrompt}, {role: 'user', content: query(task, problemStatement)}], validateGenerateSpec);
  return res.veryMinimal;
}

const validateGenerateSpec = (response) => {
  if (!response || !response.veryMinimal) {
    throw new Error('Response must be an object with a veryMinimal property');
  }
  return response;
};

const query = (task, problemStatement) => {
  let query = `#${task.title}\n`;
  query += `**Description:** ${task.description}\n`;
  query += `**Coding Work:** ${task.codingWork}\n\n`;
  query += '## Selected Context\n\n';
  for (const context of task.selectedContext) {
    query += `**${context.file}**\n\n`;
    query += '```javascript\n';
    query += `${context.contents}\n`;
    query += '```\n\n';
  }
  query += '## Problem Statement\n\n';
  query += '```markdown\n';
  query += `${problemStatement}\n`;
  query += '```';
  return query;
};

const SystemPrompt = `You are a senior software engineer working on a programming task. You will be provided a task (with a title, description, and coding work), some selected related code snippets from the codebase, and the problem statement of what we're trying to do.

**For Development Tasks:** Your job is to output an engineering spec to resolve this task. Discuss how data will flow, what interfaces look like, and what the new code will do.

**For Testing Tasks:** If the task primarily concerns itself with testing, devise a rough test plan for the team to build and carry out. Focus more on what to test instead of the details of how to write the actual test code. Tests must not be qualitative, the goal is to put in place guardrails to avoid crashes now and in the future. A bad example of a test case is 'verify the response has detailed insights', a good test case would be 'ensure there is a response when valid inputs are used, and ensure there is an error when invalid inputs are entered'. Always try to find a way to suggest a unit or integration test over manual testing.

Justify suggestions to delete, add, or change files. Don't expect the junior engineers to be able to guess your intent. More details here are critical to see your plan carried out correctly. When in doubt, add more detail.

Keep the spec as simple as possible, try to achieve the task with minimal complexity. Interpret and follow the task strictly, don't add any extra functionality that is not required by the task.

**IMPORTANT:** Avoid giving specific code examples. Leave the coding up to the engineers on the project. Just explain in high level terms what the code needs to achieve. Be specific about the requirements and the expected behavior of the code, but don't write the code itself. Make the requirements as focused and minimal as possible to fight scope creep.

The junior engineers take your guidance very literally, so do NOT mention object fields, API parameters, function parameters, etc. unless you are 100% sure that it is correct. Do NOT even give examples of property names unless you are sure they are correct.

Be extremely cautious recommending actions around api endpoints, database queries, or function calls. Any integration point like this should only be altered if absolutely required by the task. And in those cases, do the minimal changes necessary. These parts of the system are the most fragile and the most likely to break.

Use markdown for your spec. Focus the spec on the coding related work. Call out where new files may need to be added, which files should be considered for editing, and whether there is need for integrations with existing internal code or potentially third-party or open source code. When referencing specific files, use paths relative to the root of the repository. Do NOT discuss rollout or manual testing strategies, focus primarily on the coding work to be done and lightly discuss unit or integration test strategies.

Be wary when suggesting to change or delete functions that are currently in use. If you change the function signature, you will need to update all calls to that function. If you change the function body, you will need to ensure that the new code does not break any existing functionality. If you delete a function you will need to ensure all of its call locations are removed from the codebase. It may be easier sometimes to create a new function that accomplishes your goals rather than trying to change an existing function. However, bare in mind that this will increase the amount of code in the codebase and the maintenance burden.

Return 4 different specs, one extremely minimal spec, one minimal spec, one medium-detailed spec, and one extremely detailed spec.\n\nIn your response, just return straight markdown, no need to wrap your response in backticks. Use a json object to indicate which field is which spec, like so: \`{veryMinimal: '', minimal: '', detailed: '', veryDetailed: ''}\`.`;

module.exports = { generateSpec };