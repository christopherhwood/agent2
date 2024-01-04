require('dotenv').config();  // Ensure environment variables are loaded
const Koa = require('koa');
const Router = require('@koa/router');
const { koaBody } = require('koa-body');
const { cloneRepositoryInContainer } = require('./dockerOperations');
const { setupDockerDirectory, ensureGitSuffix, extractRepoName } = require('./utils');
const { getInitialContext, fetchInvestigationData, confirmInvestigationDataWithLlm, generateAndConfirmSummaryWithLlm } = require('./repoAnalysis');
const { prepareInvestigationQuery, prepareSummaryQuery } = require('./llmQueries');
const { queryLlmWithJsonCheck } = require('./llmService');

setupDockerDirectory();

const app = new Koa();
const router = new Router();

// Middleware for body parsing
app.use(koaBody());

// Error Logging Middleware (example, can be expanded)
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error(error);
    ctx.status = error.status || 500;
    ctx.body = { error: 'Internal Server Error' };
    // Avoid sending error details in production environment
  }
});

// POST endpoint to receive Git repository URL
router.post('/clone-repo', async (ctx) => {
  if (ctx.is('json')) {
    try {
      const { gitRepoUrl, authToken } = ctx.request.body;
            
      if (!gitRepoUrl) {
        ctx.status = 400;
        ctx.body = { error: 'Git repository URL is required' };
        return;
      }

      // Ensure the Git URL has the .git suffix
      const processedGitRepoUrl = ensureGitSuffix(gitRepoUrl);

      // Pass the processed URL to the cloning function
      await cloneRepositoryInContainer(processedGitRepoUrl, authToken);

      ctx.status = 200;
      ctx.body = { message: 'Git repository URL received' };
    } catch (error) {
      console.error('Error in /clone-repo:', error.message);
      ctx.status = 500;
      ctx.body = { error: 'Error processing your request' };
    }
  } else {
    ctx.status = 400;
    ctx.body = { error: 'Request must be in JSON format' };
  }
});

router.post('/analyze-repo', async (ctx) => {
  const { taskDescription, gitRepoUrl } = ctx.request.body;

  // Initialize data structures for tracking key files and commits
  let keyFiles = [];
  let keyCommits = [];

  const repoName = extractRepoName(gitRepoUrl);

  // 1. Get directory tree & recent commits
  const context = await getInitialContext(repoName); 
  console.log(context);

  // 2. & 3. Get and fetch investigation suggestions
  const investigationQuery = prepareInvestigationQuery(taskDescription, context);
  let systemPrompt = 'You are a software development expert tasked with analyzing a Git repository. Based on the provided directory structure and recent commit history, identify key areas and aspects relevant to the user\'s specific task. Provide clear, concise insights into which files or commits are crucial. Your analysis should guide the user in focusing their efforts on the most relevant parts of the code.';
  const investigationSuggestions = await queryLlmWithJsonCheck([{role: 'system', content: systemPrompt}, {role: 'user', content: investigationQuery}], validateInvestigationResponse);
  console.log(investigationSuggestions);

  const investigationData = await fetchInvestigationData(investigationSuggestions, repoName);

  console.log('investigationData:');
  console.log(investigationData);

  // 4. & 5. Initial and iterative confirmation
  const confirmationResponse = await confirmInvestigationDataWithLlm(
    taskDescription, 
    context, 
    investigationData, 
    repoName, 
    systemPrompt
  );

  console.log('confirmationResponse:');
  console.log(confirmationResponse);

  keyFiles = confirmationResponse.files;
  keyCommits = confirmationResponse.commits;

  // 6. & 7. Send deep dive context for summary and confirm summary
  const summaryQuery = prepareSummaryQuery(taskDescription, keyFiles, keyCommits);
  systemPrompt = 'You are a software development expert with a focus on synthesizing complex data into clear summaries. Your task is to analyze key files and commits from a Git repository and provide a comprehensive summary. This summary should integrate the provided information, focusing on the relevance of each file and commit to the user\'s specific task. Use the detailed Git blame and history data to add depth to your summary, ensuring it\'s informative and provides insights into how each piece of data contributes to the overall task. Structure your summary using Markdown for clarity, and be concise yet thorough in your explanation, highlighting the most crucial insights.';
  const finalSummary = await generateAndConfirmSummaryWithLlm(summaryQuery, taskDescription, keyFiles, keyCommits, systemPrompt);

  // 8. Return finalized summary and tracked items to the user
  ctx.body = { summary: finalSummary, keyFiles, keyCommits };
});

router.post('/plan-api', async (ctx) => {
  try {
    const { taskDescription, repoUrl, summary } = ctx.request.body;
    // TODO: Insert logic here to use GPT-4 to generate a task list based on the summary
    // Example: const tasks = await generateTasksUsingGpt4(summary);

    ctx.status = 200;
    ctx.body = { message: 'Task list generated successfully', tasks: [] };
  } catch (error) {
    console.error('Error in /plan-api:', error.message);
    ctx.status = 500;
    ctx.body = { error: 'Error processing your request' };
  }
});

router.prefix('/api');

// Apply the /api prefix to all routes
app.use(router.routes(), router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function validateInvestigationResponse(jsonResponse) {
  if (!jsonResponse.files) {
    jsonResponse.files = []; // Set default value if 'files' key is missing
  }
  if (!jsonResponse.commits) {
    jsonResponse.commits = []; // Set default value if 'commits' key is missing
  }
  return jsonResponse;
}
  