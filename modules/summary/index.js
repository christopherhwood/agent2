const { generateSummaryFromImportantCode } = require('./summaryGenerator');
const { pickImportantCodeFromRepoForTask } = require('./codePicker');

async function generateSummary(repoName, taskDescription) {
  const fileCodeMap = await pickImportantCodeFromRepoForTask(repoName, taskDescription);
  console.log('fileCodeMap:');
  console.log(fileCodeMap);
  const summary = await generateSummaryFromImportantCode(taskDescription, repoName, fileCodeMap);
  return { summary, fileCodeMap };
}

module.exports = { generateSummary };
