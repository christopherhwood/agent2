/**
 * Prepares a query for GPT-4 to suggest files for investigation.
 * 
 * @param {string} taskDescription - The user-provided description of the task.
 * @param {object} context - The context from the repository, including directory tree and recent commits.
 * @returns {string} - The formulated query for GPT-4.
 */
function prepareFileSelectionQuery(taskDescription, context) {
  let query = `## Task Description\n${taskDescription}\n\n`;

  // Add context about the repository with Markdown formatting
  query += '## Repository Context\n';
  query += `### Directory Tree\n\`\`\`\n${context.directoryTree}\n\`\`\`\n`;
  query += `### Recent Commits\n\`\`\`\n${context.recentCommits}\n\`\`\`\n\n`;

  // Ask GPT-4 for specific files to investigate
  query += 'Based on the above task description and repository context, ';
  query += 'which files should be focused on for investigation? ';
  query += 'Please use JSON for your response, in the format \n```\n{files: []}\n```';

  return query;
}

/**
 * Prepares a query for GPT to confirm the sufficiency of investigation data.
 *
 * This function constructs a query that combines the task description, 
 * repository context (directory tree and recent commits), and the current 
 * investigation data (files and code already identified). The query asks 
 * GPT whether the provided information is sufficient to complete the task. 
 * If not, GPT is prompted to suggest additional files that should 
 * be investigated. The response format requested from GPT is JSON, 
 * specifying files.
 *
 * @param {string} taskDescription - A description of the task provided by the user.
 * @param {object} context - The context of the repository, including directory tree 
 *                           and recent commits. This should have properties 
 *                           'directoryTree' and 'recentCommits'.
 * @param {object} fileCodeMap - The current investigation data. This should be 
 *                                     a map of filenames to arrays of code 
 *                                     snippets.
 * @returns {string} - A string representing the formulated GPT query.
 */
function prepareFileSelectionConfirmationQuery(taskDescription, context, fileCodeMap) {
  let query = `## Task Description\n${taskDescription}\n\n`;
  query += `## Repository Context\n### Directory Tree\n\`\`\`\n${context.directoryTree}\n\`\`\`\n`;
  query += `### Recent Commits\n\`\`\`\n${context.recentCommits}\n\`\`\`\n\n`;

  // Include detailed information about each file with Markdown formatting
  query += '## Current Investigation Data\n### Files\n';
  Object.keys(fileCodeMap).forEach(file => {
    query += `- **File Name:** ${file}\n`;
    for (const snippet of fileCodeMap[file]) {
      query += `  - **Code Snippet:**\n\`\`\`\n${snippet}\n\`\`\`\n`;
    }
  });

  query += '## Confirmation\n';
  query += 'Is this information sufficient to complete the task? ';
  query += 'If not, what additional files should be investigated? ';
  query += 'Are any of the included files unnecessary? If so, remove them from the list. ';
  query += 'Please respond in JSON format with `{files: []}`. ';

  return query;
}

/**
 * Prepares a query to summarize the investigation data in relation to the task description,
 * using Markdown for formatting and recommending the inclusion of code snippets and commit hashes.
 *
 * @param {string} taskDescription - The original task description provided by the user.
 * @param {array} fileCodeMap - Mapping of file names to arrays of code snippets from the given file.
 * @returns {string} - The formulated summary query for GPT.
 */
function prepareSummaryQuery(taskDescription, fileCodeMap) {
  let query = `## Task Description\n${taskDescription}\n\n`;

  // Add details about the key files and commits with Markdown formatting
  query += '## Key Investigation Data\n';
  query += '### Files\n';
  Object.keys(fileCodeMap).forEach(fileName => {
    query += `- **File Name:** ${fileName}\n`;
    for (const snippet of fileCodeMap[fileName]) {
      query += `  - **Code Snippet:**\n\`\`\`\n${snippet}\n\`\`\`\n`;
    }
  });

  // Specific instructions for the summary
  query += '## Summary Request\n';
  query += 'Based on the task description and the extracted code snippets above, ';
  query += 'please provide a comprehensive summary. The summary should: \n';
  query += '- Focus on the relevance of the identified code to the task.\n';
  query += '- Include quoted code where relevant for context.\n';
  query += '- Include references to source files.\n';
  query += '- Use Markdown formatting to enhance readability and structure.\n';
  query += '- Be concise yet informative, highlighting crucial insights.\n';

  return query;
}

function prepareSummaryConfirmationQuery(summary, taskDescription, fileCodeMap) {
  let query = `## Summary for Revision\n${summary}\n\n`;
  query += `## Task Description\n${taskDescription}\n\n`;

  // Include detailed information about key files
  query += '## Key Code Related to the Task\n';
  Object.keys(fileCodeMap).forEach(fileName => {
    query += `- **File Name:** ${fileName}\n`;
    for (const snippet of fileCodeMap[fileName]) {
      query += `  - **Code Snippet:**\n\`\`\`\n${snippet}\n\`\`\`\n`;
    }
  });

  query += '## Revision Request\n';
  query += 'Examine the above summary. Determine if it needs revisions to be sufficient and accurate for the task description and the key investigation data. ';
  query += 'If it is sufficient, respond with just "ok". If not, make edits where needed and provide a full, complete revised summary.';
  query += 'Revised summaries will overwrite previous summaries, and as such they must not refer to previous summary contents in any way.\n\n';
  query += 'A revised summary should: \n';
  query += '- Focus on the relevance of the identified code to the task.\n';
  query += '- Include code snippets where relevant for context.\n';
  query += '- Include references to source files.\n';
  query += '- Use Markdown formatting to enhance readability and structure.\n';
  query += '- Be concise yet informative, highlighting crucial insights.\n';

  return query;
}

function prepareImportantFunctionQuery(taskDescription, fileContents) {
  let query = `## Task Description\n${taskDescription}\n\n`;
  query += `## File Contents\n\`\`\`\n${fileContents}\n\`\`\`\n\n`;

  query += '## Important Function Request\n';
  query += 'Based on the task description and the file contents above, ';
  query += 'which code snippets from the file should be focused on for investigation? ';
  query += 'Use JSON for your response, in the format \n```\n{code: ["codesnippet1", "codesnippet2"]}\n```'; 

  return query;
}

function prepareImportantFunctionConfirmationQuery(taskDescription, fileContents, code) {
  let query = `## Task Description\n${taskDescription}\n\n`;
  query += `## File Contents\n\`\`\`\n${fileContents}\n\`\`\`\n\n`;
  query += `## Critical Code\n\`\`\`\n${code.join('```\n\n```')}\n\`\`\`\n\n`;
  
  query += '## Confirmation Request\n';
  query += 'Examine the above critical code. Determine if it is sufficient and accurate for the task description and the file contents. ';
  query += 'Reply using json in the format {code: ["codesnippet1", "codesnippet2"]}. ';
  query += 'Make whatever edits are necessary to the existing code snippet list, and return the list of critical code snippets from this file. ';
  return query;
}

module.exports = {
  prepareFileSelectionQuery,
  prepareFileSelectionConfirmationQuery,
  prepareImportantFunctionQuery,
  prepareImportantFunctionConfirmationQuery,
  prepareSummaryQuery,
  prepareSummaryConfirmationQuery,
};