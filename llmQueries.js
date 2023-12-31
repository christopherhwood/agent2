/**
 * Prepares a query for GPT-4 to suggest files and commits for investigation.
 * 
 * @param {string} taskDescription - The user-provided description of the task.
 * @param {object} context - The context from the repository, including directory tree and recent commits.
 * @returns {string} - The formulated query for GPT-4.
 */
function prepareInvestigationQuery(taskDescription, context) {
  // Start by describing the task
  let query = `Task Description: ${taskDescription}\n\n`;

  // Add context about the repository
  query += `Repository Context:\nDirectory Tree:\n${context.directoryTree}\n`;
  query += `Recent Commits:\n${context.recentCommits}\n\n`;

  // Ask GPT-4 for specific files and commits to investigate
  query += 'Based on the above task description and repository context, ';
  query += 'which files and commits should be focused on for investigation? ';
  query += 'Use json for your response, in the format {files: [], commits: []}.';

  return query;
}

module.exports = {
  prepareInvestigationQuery
};
