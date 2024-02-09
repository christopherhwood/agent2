const fs = require('fs');
const Koa = require('koa');
const Router = require('@koa/router');
const { OpenAI } = require('openai');
const { koaBody } = require('koa-body');
const { cloneRepositoryInContainer, executeCommand } = require('./dockerOperations');
const { ensureGitSuffix, extractRepoName } = require('./utils');
const { generateSummary } = require('./modules/summary');
const { generatePlan } = require('./modules/plan');
const { resolveTasks } = require('./modules/code');
const { getRepoContext } = require('./modules/summary/codePicker');
const { updateRepoEmbeddings } = require('./modules/search/ingestion/traverseRepo');
const { genTaskDeepDive } = require('./modules/plan/taskDeepDiver');
const { pickCodeContext } = require('./modules/search/output');


const openai = new OpenAI(process.env.OPENAI_API_KEY);

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
  const { gitRepoUrl } = ctx.request.body;
  const repoName = extractRepoName(gitRepoUrl);
  const summary = await generateSummary(repoName);
  ctx.body = { message: 'Repo analysis completed successfully', summary: summary };
});

router.post('/generate-plan', async (ctx) => {
  try {
    // taskDescription is string & summary is json object
    const { taskDescription, gitRepoUrl, summary, taskDeepDive } = ctx.request.body;
    if (!taskDeepDive) {
      ctx.status = 400;
      ctx.body = { error: '"taskDeepDive" is a required parameter' };
      return;
    }
    const repoName = extractRepoName(gitRepoUrl);
    const repoContext = await getRepoContext(repoName);
    const taskTree = await generatePlan(taskDescription, repoName, repoContext, summary, taskDeepDive);
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
    // task is json object & repoUrl is string
    const { tasks, repoUrl, problemStatement } = ctx.request.body;
    const repoName = extractRepoName(repoUrl);
    // This is a hack for now:
    await executeCommand('git config user.name "qckfx Agent"', repoName);
    await executeCommand('git config user.email "chris.wood@earlyworm.io"', repoName);
    // Checkout new branch
    await executeCommand('git checkout -b agent-1', repoName);

    // Re-index the repo
    await updateRepoEmbeddings(repoName);
    // Resolve tasks
    const resolvedTasks = await resolveTasks(tasks, problemStatement, repoName);
    // Submit PR
    ctx.status = 200;
    ctx.body = { message: 'Tasks resolved successfully', tasks: resolvedTasks };
  } catch (error) {
    console.error('Error in /resolve-tasks:', error);
    ctx.status = 500;
    ctx.body = { error: 'Error processing your request' };
  }
});

router.post('/debug-only-send-payload', async (ctx) => {
  try {
    const { payloadPath } = ctx.request.body;
    const payload = fs.readFileSync(payloadPath, 'utf8');
    const jsonPayload = JSON.parse(payload);
    const res = await openai.chat.completions.create(jsonPayload);
    console.log(JSON.stringify(res));
    ctx.body = res;
    ctx.status = 200;
  } catch (err) {
    console.error(err);
  }
});

router.post('/debug-only-search-code', async (ctx) => {
  try {
    const { query, problemStatement, excludedFiles, repoUrl } = ctx.request.body;
    const repoName = extractRepoName(repoUrl);
    await updateRepoEmbeddings(repoName);
    const context = await pickCodeContext(query, problemStatement, repoName, excludedFiles, true);
    return ctx.response.body = context;
  } catch (err) {
    console.error(err);
  }
});

// New API endpoint to generate a deep dive into a task
router.post('/generate-task-deep-dive', async (ctx) => {
  try {
    const { taskDescription, repositorySummary } = ctx.request.body;
    if (!taskDescription || !repositorySummary) {
      ctx.status = 400;
      ctx.body = { error: 'Both taskDescription and repositorySummary are required' };
      return;
    }
    const result = await genTaskDeepDive(taskDescription, repositorySummary);
    ctx.status = 200;
    ctx.body = { deepDiveResult: result };
  } catch (error) {
    console.error('Error in /generate-task-deep-dive:', error);
    ctx.status = 500;
    ctx.body = { error: 'Error processing your request' };
  }
});

router.prefix('/api');

// Apply the /api prefix to all routes
app.use(router.routes(), router.allowedMethods());

module.exports = app;
