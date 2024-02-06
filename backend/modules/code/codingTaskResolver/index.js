const { updateRepoEmbeddings } = require('../../search/ingestion/traverseRepo');
const { executeTask } = require('./executor/executeTask');

async function resolveCodingTask(task, problemStatement, repoName) {
  await executeTask(task, problemStatement, repoName);
  await updateRepoEmbeddings(repoName);
}

module.exports = { resolveCodingTask };
