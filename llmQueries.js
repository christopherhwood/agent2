/**
 * Prepares a query for GPT-4 to suggest files and commits for investigation.
 * 
 * @param {string} taskDescription - The user-provided description of the task.
 * @param {object} context - The context from the repository, including directory tree and recent commits.
 * @returns {string} - The formulated query for GPT-4.
 */
function prepareInvestigationQuery(taskDescription, context) {
  let query = `## Task Description\n${taskDescription}\n\n`;

  // Add context about the repository with Markdown formatting
  query += '## Repository Context\n';
  query += `### Directory Tree\n\`\`\`\n${context.directoryTree}\n\`\`\`\n`;
  query += `### Recent Commits\n\`\`\`\n${context.recentCommits}\n\`\`\`\n\n`;

  // Ask GPT-4 for specific files and commits to investigate
  query += 'Based on the above task description and repository context, ';
  query += 'which files and commits should be focused on for investigation? ';
  query += 'Please use JSON for your response, in the format \n```\n{files: [], commits: []}\n```';

  return query;
}


/**
 * Prepares a query for GPT to confirm the sufficiency of investigation data.
 *
 * This function constructs a query that combines the task description, 
 * repository context (directory tree and recent commits), and the current 
 * investigation data (files and commits already identified). The query asks 
 * GPT whether the provided information is sufficient to complete the task. 
 * If not, GPT is prompted to suggest additional files or commits that should 
 * be investigated. The response format requested from GPT is JSON, 
 * specifying files and commits.
 *
 * @param {string} taskDescription - A description of the task provided by the user.
 * @param {object} context - The context of the repository, including directory tree 
 *                           and recent commits. This should have properties 
 *                           'directoryTree' and 'recentCommits'.
 * @param {object} investigationData - The current investigation data. This should be 
 *                                     an object with properties 'files' and 'commits', 
 *                                     which are arrays of objects with details about 
 *                                     the respective files and commits.
 * @returns {string} - A string representing the formulated GPT query.
 */
function prepareConfirmationQuery(taskDescription, context, investigationData) {
  let query = `## Task Description\n${taskDescription}\n\n`;
  query += `## Repository Context\n### Directory Tree\n\`\`\`\n${context.directoryTree}\n\`\`\`\n`;
  query += `### Recent Commits\n\`\`\`\n${context.recentCommits}\n\`\`\`\n\n`;

  // Include detailed information about each file with Markdown formatting
  query += '## Current Investigation Data\n### Files\n';
  investigationData.files.forEach(file => {
    query += `- **File Name:** ${file.name}\n`;
    query += `  - **Git Blame:**\n\`\`\`\n${file.blame}\n\`\`\`\n`;
    query += `  - **Git History:**\n\`\`\`\n${file.history}\n\`\`\`\n`;
  });

  // Include detailed information about each commit with Markdown formatting
  query += '### Commits\n';
  investigationData.commits.forEach(commit => {
    query += `- **Commit Hash:** ${commit.hash}\n`;
    query += `  - **Commit Details:**\n\`\`\`\n${commit.details}\n\`\`\`\n`;
  });

  query += '## Confirmation\n';
  query += 'Is this information sufficient to complete the task? ';
  query += 'If not, what additional files or commits should be investigated? ';
  query += 'Please respond in JSON format with `{files: [], commits: []}`. ';
  query += 'If no additional files or commits are needed, respond with `{files: [], commits: []}`.';

  return query;
}



module.exports = {
  prepareInvestigationQuery,
  prepareConfirmationQuery
};
