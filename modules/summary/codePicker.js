const { createContainer, destroyContainer, executeCommand } = require('../../dockerOperations');
const { queryLlmWithJsonCheck } = require('../../llmService');

async function selectKeyFiles(taskDescription, context) {
  // 2. & 3. Get and fetch investigation suggestions
  const fileSelectionQuery = prepareFileSelectionQuery(taskDescription, context);
  let fileNames = await queryLlmWithJsonCheck([{role: 'system', content: FilePickerSystemPrompt}, {role: 'user', content: fileSelectionQuery}], validateFileSelectionResponse);
  return fileNames;
}

async function getRepoContext(repoName) {
  const container = await createContainer(repoName);
  // Update the repo first
  const defaultBranch = await executeCommand('git --no-pager remote show origin | grep "HEAD branch" | cut -d" " -f5', repoName, container);
  await executeCommand(`git --no-pager pull origin ${defaultBranch.trim()}`, repoName, container);

  // Execute commands to get directory tree and recent commits
  const directoryTree = await executeCommand('tree -I "node_modules|.git|package-lock.json"', repoName, container);
  const recentCommits = await executeCommand('git --no-pager log -n 5 --pretty=format:"%h - %an, %ar : %s"', repoName, container);

  await destroyContainer(container);

  return {
    directoryTree,
    recentCommits
  };
}

function validateFileSelectionResponse(jsonResponse) {
  if (!jsonResponse.files) {
    jsonResponse.files = []; // Set default value if 'files' key is missing
  }
  return jsonResponse;
}

/**
 * Prepares a query for GPT-4 to suggest files for investigation.
 * 
 * @param {string} taskDescription - The user-provided description of the task.
 * @param {object} context - The context from the repository, including directory tree and recent commits.
 * @returns {string} - The formulated query for GPT-4.
 */
function prepareFileSelectionQuery(taskDescription, context) {
  let query = `${taskDescription}\n\n`;

  // Add context about the repository with Markdown formatting
  query += '## Repository Context\n';
  query += `### Directory Tree\n\`\`\`\n${context.directoryTree}\n\`\`\`\n`;
  query += `### Recent Commits\n\`\`\`\n${context.recentCommits}\n\`\`\`\n\n`;

  // Ask GPT-4 for specific files to investigate
  query += 'Based on the above task/project description and repository context, ';
  query += 'which files should be focused on for investigation? ';
  query += 'Please use JSON for your response, in the format \n```\n{files: []}\n```';

  return query;
}

const FilePickerSystemPrompt = `You are an advanced code analysis bot with expertise in JavaScript codebases. Your mission extends beyond identifying files directly related to a specific development task/project in a Git repository. You are also tasked with understanding the broader context of the repository to ensure that the task/project-specific files can be interpreted correctly within the overall framework of the codebase.

Upon receiving the directory structure, a list of recent commits, and the task/project description, your task involves:

1. Conducting a thorough analysis of the directory tree to determine the key JavaScript files. This includes identifying files that are directly relevant to the task/project and those essential for grasping the high-level functionality of the entire repository. Assess the codebase's organization, architecture, and key components to ensure a holistic understanding.

2. Integrating this analysis with the specifics of the task/project to ascertain the most pertinent files. This should include files directly involved in the task/project, as well as foundational files that provide context and insight into how the codebase operates as a whole.

3. Compiling your findings into a structured JSON object. This object should contain an array of relative paths for the identified files, ensuring they are referenced relative to the root of the repository as per the provided directory tree.

Example output format:

{ "files": ["relative/path/to/file1.js", "relative/path/to/core_module.js", "relative/path/to/utility.js", "relative/path/to/task_specific_file.js"] }

Your analysis should be comprehensive and insightful, enabling the user to not only focus on the task/project at hand but also understand the codebase in its entirety. The goal is to provide a list of files that are both directly relevant to the task/project and crucial for understanding the overall structure and functionality of the repository.`;

module.exports = { getRepoContext, selectKeyFiles };