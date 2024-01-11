const Coder = require('./coder');
const { recursivelyResolveTasks } = require('./taskResolver');

async function resolveTasks(topTask, repoName) {
  const coder = new Coder(repoName, topTask);
  await recursivelyResolveTasks(topTask, coder);
}

module.exports = {
  resolveTasks
};