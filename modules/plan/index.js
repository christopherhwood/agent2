const { genTaskDeepDive } = require('./taskDeepDiver.js');
const ProblemTracer = require('./problemTracer.js');
const { genPRD } = require('./productBrainstormer.js');
const { genImplementationPlan } = require('./implementationPlanner.js');

async function generatePlan(taskDescription, repoName, repoContext, summary) {
  const taskDeepDive = await genTaskDeepDive(taskDescription, summary);
  console.log('taskDeepDive:\n', taskDeepDive);
  const problemTracer = new ProblemTracer(taskDescription, taskDeepDive, summary, repoContext.directoryTree, repoName);
  const problemStatement = await problemTracer.traceProblem();
  console.log('problemStatement:\n', problemStatement);
  const prd = await genPRD(taskDescription, taskDeepDive, problemStatement);
  console.log('prd:\n', prd);
  const implementationPlan = await genImplementationPlan(taskDescription, taskDeepDive, problemStatement, prd);
  console.log('implementationPlan:\n', implementationPlan);
  return implementationPlan.steps;
}

module.exports = {
  generatePlan
};