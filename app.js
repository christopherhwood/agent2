require('dotenv').config();  // Ensure environment variables are loaded
const Koa = require('koa');
const Router = require('@koa/router');
const { koaBody } = require('koa-body');
const { cloneRepositoryInContainer, executeCommand } = require('./dockerOperations');
const { setupDockerDirectory, ensureGitSuffix, extractRepoName } = require('./utils');
const { getInitialContext, fetchInvestigationData, confirmInvestigationDataWithLlm, generateAndConfirmSummaryWithLlm } = require('./repoAnalysis');
const { generateRoughPlan, generateTaskTree } = require('./planner');
const { resolveTasks } = require('./coder');
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
  let systemPrompt = `You are an expert code analysis bot with a specialization in JavaScript codebases. Your mission is to analyze the provided directory tree and recent commit history of a Git repository, identifying the files and commits most relevant to a specific development task.

  Upon receiving the directory structure, a list of recent commits, and the task description, your task involves:
  
  1. Analyzing the directory tree to identify relevant JavaScript files. Focus on discerning the relative paths of files that are likely critical for the task, considering the overall structure and organization of the codebase.
  2. Reviewing recent commit history, with an emphasis on changes that could impact or be pertinent to the task. Pay special attention to commit messages, authors, timestamps, and the specific nature of the changes in the code.
  3. Correlating these findings with the details of the task to pinpoint the most relevant files and commits.
  
  Your output should be in the form of a structured JSON object containing two arrays: one for the relative paths of pertinent files, and one for the hashes of relevant commits. Ensure that the file paths are relative to the root of the repository as per the provided directory tree.
  
  Example output format:

  { "files": ["relative/path/to/file1.js", "relative/path/to/file2.js"], "commits": ["commitHash1", "commitHash2"] }


  Your analysis should be precise and focused, enabling the user to direct their efforts effectively towards the most significant aspects of the codebase for the task at hand. The goal is to provide a clear, concise, and relevant list of files and commits, aiding in an efficient approach to task resolution.`;
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
  systemPrompt = `You are a software development synthesis expert, adept at distilling complex codebase information into concise, actionable summaries. Your primary role is to delve into the contents of key files and the details of relevant commits from a Git repository, focusing on their significance in the context of a specific user task.

  Your task involves:
  
  1. Analyzing the contents of each identified file, understanding their functionalities, code structure, and any peculiarities in their JavaScript implementation.
  2. Examining the details of pertinent commits, including commit messages, changes made, and their implications for the current task. Leverage Git blame and history data to understand the evolution and the rationale behind these changes.
  3. Integrating this information to create a comprehensive summary that conveys a clear understanding of how each file and commit is relevant to the user's task. Your summary should illuminate connections between different pieces of code and commits, highlighting dependencies, potential impacts, and areas requiring attention.
  
  The summary should be structured in Markdown for clarity and ease of reading. Aim for a balance between brevity and thoroughness, ensuring that your summary is not only informative but also provides deep insights into the task at hand. Your objective is to equip the user with a clear understanding of the code and commits, guiding them effectively in resolving the task.
  
  Focus on delivering a summary that serves as a practical guide for task resolution, emphasizing key points and actionable insights drawn from the code and commit history.`;
  const finalSummary = await generateAndConfirmSummaryWithLlm(summaryQuery, taskDescription, keyFiles, keyCommits, systemPrompt);

  // 8. Return finalized summary and tracked items to the user
  ctx.body = { summary: finalSummary, keyFiles, keyCommits };
});

router.post('/generate-plan', async (ctx) => {
  try {
    // taskDescription is string & summary is json object
    const { taskDescription, summary } = ctx.request.body;
    const roughPlan = await generateRoughPlan(taskDescription, summary);
    console.log('Rough plan:');
    console.log(roughPlan);

    const taskTree = await generateTaskTree(taskDescription, summary, roughPlan);

    ctx.status = 200;
    ctx.body = { message: 'Task list generated successfully', tasks: taskTree };
  } catch (error) {
    console.error('Error in /plan-api:', error.message);
    ctx.status = 500;
    ctx.body = { error: 'Error processing your request' };
  }
});

router.post('/resolve-tasks', async (ctx) => {
  try {
    // task is json object & keyFilesAndCommits is json object & repoUrl is string
    const { task, keyFilesAndCommits, repoUrl } = ctx.request.body;
    const repoName = extractRepoName(repoUrl);
    // This is a hack for now:
    await executeCommand('git config user.name "qckfx Agent"', repoName);
    await executeCommand('git config user.email "chris.wood@earlyworm.io"', repoName);
    // Checkout new branch
    await executeCommand('git checkout -b agent-1', repoName);
    // Resolve tasks
    const resolvedTasks = await resolveTasks(task, keyFilesAndCommits, repoName);
    // Submit PR
    ctx.status = 200;
    ctx.body = { message: 'Tasks resolved successfully', tasks: resolvedTasks };
  } catch (error) {
    console.error('Error in /resolve-tasks:', error);
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
