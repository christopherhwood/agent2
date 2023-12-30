require('dotenv').config();  // Ensure environment variables are loaded
const Koa = require('koa');
const Router = require('@koa/router');
const { koaBody } = require('koa-body');
const { cloneRepositoryInContainer } = require('./dockerOperations');
const { setupDockerDirectory, ensureGitSuffix } = require('./utils');

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

router.prefix('/api');

// Apply the /api prefix to all routes
app.use(router.routes(), router.allowedMethods());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

