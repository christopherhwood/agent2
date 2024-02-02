const { executeTask } = require('./executor/executeTask');
const { updateRepoEmbeddings } = require('../../search/ingestion/traverseRepo');

async function resolveCodingTask(task, problemStatement, repoName) {
  await executeTask(task, problemStatement, repoName);
  await updateRepoEmbeddings(repoName);
}

module.exports = { resolveCodingTask };
