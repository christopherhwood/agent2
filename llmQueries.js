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

/**
 * Prepares a query to summarize the investigation data in relation to the task description,
 * using Markdown for formatting and recommending the inclusion of code snippets and commit hashes.
 *
 * @param {string} taskDescription - The original task description provided by the user.
 * @param {array} keyFiles - Array of key files relevant to the task.
 * @param {array} keyCommits - Array of key commits relevant to the task.
 * @returns {string} - The formulated summary query for GPT.
 */
function prepareSummaryQuery(taskDescription, keyFiles, keyCommits) {
  let query = `## Task Description\n${taskDescription}\n\n`;

  // Add details about the key files and commits with Markdown formatting
  query += '## Key Investigation Data\n';
  query += '### Files\n';
  keyFiles.forEach(file => {
    query += `- **File Name:** ${file.name}\n`;
    query += `  - **Git Blame:**\n\`\`\`\n${file.blame}\n\`\`\`\n`;
    query += `  - **Git History:**\n\`\`\`\n${file.history}\n\`\`\`\n`;
  });
  query += '### Commits\n';
  keyCommits.forEach(commit => {
    query += `- **Commit Hash:** ${commit.hash}\n`;
    query += `  - **Details:**\n\`\`\`\n${commit.details}\n\`\`\`\n`;
  });

  // Specific instructions for the summary
  query += '## Summary Request\n';
  query += 'Based on the task description and the key investigation data above, ';
  query += 'please provide a comprehensive summary. The summary should: \n';
  query += '- Focus on the relevance of the identified files and commits to the task.\n';
  query += '- Include code snippets and commit hashes where relevant for context.\n';
  query += '- Use Markdown formatting to enhance readability and structure.\n';
  query += '- Be concise yet informative, highlighting crucial insights.\n';

  return query;
}

function prepareSummaryConfirmationQuery(summary, taskDescription, keyFiles, keyCommits) {
  let query = `## Summary for Confirmation\n${summary}\n\n`;
  query += `## Task Description\n${taskDescription}\n\n`;

  // Include detailed information about key files
  query += '## Key Files Involved in the Task\n';
  keyFiles.forEach(file => {
    query += `- **File Name:** ${file.name}\n`;
    // Assuming file.blame and file.history are available here as well
    query += `  - **Git Blame:**\n\`\`\`\n${file.blame}\n\`\`\`\n`;
    query += `  - **Git History:**\n\`\`\`\n${file.history}\n\`\`\`\n`;
  });

  // Include detailed information about key commits
  query += '## Key Commits Involved in the Task\n';
  keyCommits.forEach(commit => {
    // Assuming commit.details is available here
    query += `- **Commit Hash:** ${commit.hash}\n`;
    query += `  - **Commit Details:**\n\`\`\`\n${commit.details}\n\`\`\`\n`;
  });

  query += '## Confirmation Request\n';
  query += 'Examine the above summary. Determine if it is sufficient and accurate for the task description and the key investigation data. ';
  query += 'If it is sufficient, respond with "ok". If not, make edits where needed and provide a revised summary.';
  query += 'Revised summaries must be complete and not reference the previous summary.\n\n';
  query += 'DO NOT say things like "The provided summary is...". Instead, just provide the revised summary.';
  query += 'A revised summary should: \n';
  query += '- Focus on the relevance of the identified files and commits to the task.\n';
  query += '- Include code snippets and commit hashes where relevant for context.\n';
  query += '- Use Markdown formatting to enhance readability and structure.\n';
  query += '- Be concise yet informative, highlighting crucial insights.\n';

  return query;
}

function prepareRoughPlanQuery(taskDescription, summary) {
  let query = `## Task Description\n${taskDescription}\n\n`;
  query += `## Summary\n${summary}\n\n`;

  query += '## Rough Plan Request\n';
  query += 'Based on the task description and summary above, ';
  query += 'please provide a rough plan for completing the task. ';
  query += 'The plan should include a list of steps to follow, ';
  query += 'as well as any additional information that would be helpful. ';
  query += 'DO NOT include tasks like reviewing files that are already attached. Instead, distill the keypoints from those files into the plan. ';
  query += 'DO NOT include setting up the environment or cloning the repo. ';
  query += 'DO NOT include committing changes, deployment, code review, or documentation. ';
  query += 'Use Markdown formatting to enhance readability and structure.';

  return query;
}

function prepareRoughPlanConfirmationQuery(roughPlan, taskDescription, summary) {
  let query = `## Rough Plan for Confirmation\n${roughPlan}\n\n`;
  query += `## Task Description\n${taskDescription}\n\n`;
  query += `## Summary\n${summary}\n\n`;

  query += '## Confirmation Request\n';
  query += 'Examine the above rough plan. Determine if it is sufficient and accurate for the task description and the summary. ';
  query += 'Ensure the plan DOES NOT mention anything about environment setup or cloning the repo. ';
  query += 'Ensure the plan DOES NOT mention anything about committing changes, deployment, code review, or documentation. ';
  query += 'If it is sufficient, respond with "ok". If not, make edits where needed and provide a revised plan. ';
  query += 'Revised plans must be complete and not reference the previous plan.\n\n';
  query += 'DO NOT say things like "The provided rough plan is...". Instead, just provide the revised plan.';
  query += 'A revised plan should: \n';
  query += '- Include a list of steps to follow.\n';
  query += '- Include any additional information that would be helpful.\n';
  query += '- Use Markdown formatting to enhance readability and structure.\n';

  return query;
}


module.exports = {
  prepareInvestigationQuery,
  prepareConfirmationQuery,
  prepareSummaryQuery,
  prepareSummaryConfirmationQuery,
  prepareRoughPlanQuery,
  prepareRoughPlanConfirmationQuery
};
