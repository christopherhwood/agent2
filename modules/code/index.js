const Coder = require('./coder');
const { recursivelyResolveTasks } = require('./taskResolver');

async function resolveTasks(topTask, fileCodeMap, repoName) {
  const coder = new Coder(repoName, fileCodeMap, topTask);
  await recursivelyResolveTasks(topTask, coder);
}

module.exports = {
  resolveTasks
};