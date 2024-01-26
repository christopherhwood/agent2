const { queryLlmWithJsonCheck } = require('../../../../llmService');

async function discernFilesToBeEditedAndIntegrated(taskString, keyFiles) {
  return await queryLlmWithJsonCheck([{role: 'system', content: systemPrompt}, {role: 'user', content: query(taskString, keyFiles)}], validateDiscernFilesToBeEditedAndIntegrated);
}

const query = (taskString, keyFiles) => {
  let query = taskString;
  query += '\n\n';
  query += '## Files\n';
  for (const filePath of Object.keys(keyFiles)) {
    query += `**${filePath}**\n`;
    query += '```javascript\n';
    query += `${keyFiles[filePath]}\n`;
    query += '```\n\n';
  }
  return query;
};

const systemPrompt = `You are a discerning analysis system, specifically designed to meticulously evaluate a pre-selected list of key JavaScript files in relation to a given coding task. Your essential role is to further refine this list of files, determining with precision which ones are absolutely necessary either for direct modification or for integration into the task's solution. It's imperative that your evaluation is thorough yet balanced, ensuring that you are neither overly conservative nor excessively liberal in your selections.

Upon being presented with a coding task and a set of identified key JavaScript files, your responsibilities are as follows:

1. Conduct a detailed analysis of the task, fully understanding its specific requirements, goals, and the technical challenges it presents.
2. Examine each file in the provided list with a critical eye, assessing its relevance and potential contribution towards accomplishing the task.
3. Decide which files are crucial for editing to meet the task's objectives (toBeEdited). This may involve identifying files that contain code needing adjustments, updates, or enhancements.
4. Identify files that are essential for integration or importation (toBeImported). These files should contain functions, classes, modules, or other elements that are vital for the task's successful implementation.

Your output will be a carefully curated JSON object, reflecting a strategic and judicious approach to file selection. The format of your response will be:
\`\`\`json
{
  "toBeEdited": [
    "EssentialFileName1.js",
    "EssentialFileName2.js"
    // Additional essential file names as necessary
  ],
  "toBeImported": [
    "EssentialFileName3.js",
    "EssentialFileName4.js"
    // Additional essential file names as necessary
  ]
}
\`\`\``;

const validateDiscernFilesToBeEditedAndIntegrated = (response) => {
  if (!response || !response.toBeEdited || !response.toBeImported) {
    throw new Error('Response must be an object with toBeEdited and toBeImported properties');
  }
  if (!Array.isArray(response.toBeEdited)) {
    response.toBeEdited = [];
  }
  if (!Array.isArray(response.toBeImported)) {
    response.toBeImported = [];
  }
  return response;
};

module.exports = { discernFilesToBeEditedAndIntegrated };