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


// const { askRepositoryQuestions } = require('./question');
// const { answerQuestions } = require('./answer');
// const { generateRoughPlan } = require('./roughPlanner.js');
// const { generateTaskTree } = require('./taskTreeGenerator.js');

// async function generatePlan(taskDescription, repoName, repoContext, summary) {
//   const questions = await askRepositoryQuestions(taskDescription, repoName, summary);
//   console.log('questions:');
//   console.log(questions);
//   const answers = await answerQuestions(repoName, repoContext, summary, questions);
//   console.log('answers:');
//   console.log(answers);
//   let questionAndAnswers = [];
//   for (let i = 0; i < questions.length; i++) {
//     questionAndAnswers.push({question: questions[i], answer: answers[i]});
//   }
//   const roughPlan = await generateRoughPlan(taskDescription, summary, questionAndAnswers);
//   console.log('roughPlan:');
//   console.log(roughPlan);
//   const taskTree = await generateTaskTree(taskDescription, summary, questionAndAnswers, roughPlan);
//   return { roughPlan, taskTree };
// }

module.exports = {
  generatePlan
};