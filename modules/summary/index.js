const { queryLlm } = require('../../llmService');
const { getRepoContext } = require('./codePicker');
const { analyzeRepo } = require('./analyzeRepo');

async function generateSummary(repoName) {
  // Analyze repo and generate summary.
  const repoContext = await getRepoContext(repoName);
  const repoAnalysis = await analyzeRepo(repoName);
  console.log('repoAnalysis:');
  console.log(repoAnalysis);

  const query = prepareRepoSummaryQueryFromRepoAnalysis(repoName, repoContext, repoAnalysis);
  const repoSummary = await queryLlm([{role: 'system', content: RepoSummarizerSystemPrompt}, {role: 'user', content: query}]);
  return repoSummary;
}

function prepareRepoSummaryQueryFromRepoAnalysis(repoName, repoContext, repoAnalysis) {
  let query = `# Repository Name\n${repoName}\n\n`;
  query += `## Repository Context\n### Directory Tree\n\`\`\`\n${repoContext.directoryTree}\n\`\`\`\n`;
  query += `### Recent Commits\n\`\`\`\n${repoContext.recentCommits}\n\`\`\`\n\n`;

  query += '## File Analysis\n';
  for (const file of repoAnalysis) {
    query += `### File Name: ${file.fileName}\n`;
    if (file.dependencies.local.length > 0 || file.dependencies.external.length > 0) {
      query += '#### File Dependencies\n';
      if (file.dependencies.local.length > 0) {
        query += `  - **Local Dependencies:** ${file.dependencies.local.join(', ')}\n`;
      }
      if (file.dependencies.external.length > 0) {
        query += `  - **External Dependencies:** ${file.dependencies.external.join(', ')}\n`;
      }
    }
    if (file.functions.length > 0) {
      query += '#### File Functions\n';
      for (const func of file.functions) {
        query += `  - ${func.name}(${func.parameters.join(', ')})\n`;
      }
    }
  }

  query += '## Repository Summary Request\n';
  query += 'Based on the above analysis, please provide a summary of the repository. ';
  query += 'The summary should explain what the repository does at a high level. ';
  query += 'It should include references to key files and functions. ';
  query += 'It should also include references to any external dependencies. ';
  query += 'Please use Markdown formatting to enhance readability and structure. ';
  return query;
}

const RepoSummarizerSystemPrompt = `You are a Repository Summary Generator, tasked with creating a comprehensive summary of a software repository. Your input is a detailed analysis of the repository, including its name, context, and an in-depth file analysis. Your role is to synthesize this information into a clear, high-level summary.

Upon receiving the repository analysis:

1. Review the repository name and the provided context, which includes the directory tree and recent commits. These elements give an overview of the repository's structure and recent changes.

2. Examine the file analysis section, detailing each file's name, local and external dependencies, and functions. This section offers insights into the repository's components and their interrelationships.

3. Create a summary that encapsulates what the repository does at a high level. Focus on explaining the repository's purpose, functionality, and key features.

4. Highlight key files and functions in your summary. Reference these elements to illustrate how they contribute to the repository's overall functionality.

5. Include references to any external dependencies, explaining their role and significance within the repository.

6. Use Markdown formatting to enhance the readability and structure of your summary. Employ headings, lists, and code blocks where appropriate to organize information clearly and effectively.

Your output will be a Markdown-formatted document that provides a clear, structured summary of the repository. This summary should serve as an accessible guide to understanding the repository's purpose, key components, and how they work together to achieve the repository's goals.`;

module.exports = { generateSummary };
