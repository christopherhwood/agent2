
const { askRepositoryQuestions } = require('./question');
const { answerQuestions } = require('./answer');
const { generateRoughPlan } = require('./roughPlanner.js');
const { generateTaskTree } = require('./taskTreeGenerator.js');

async function generatePlan(taskDescription, repoName, repoContext, summary) {
  const questions = await askRepositoryQuestions(taskDescription, repoName, summary);
  console.log('questions:');
  console.log(questions);
  const answers = await answerQuestions(repoName, repoContext, summary, questions);
  console.log('answers:');
  console.log(answers);
  let questionAndAnswers = [];
  for (let i = 0; i < questions.length; i++) {
    questionAndAnswers.push({question: questions[i], answer: answers[i]});
  }
  const roughPlan = await generateRoughPlan(taskDescription, summary, questionAndAnswers);
  console.log('roughPlan:');
  console.log(roughPlan);
  const taskTree = await generateTaskTree(taskDescription, summary, questionAndAnswers, roughPlan);
  return { roughPlan, taskTree };
}

module.exports = {
  generatePlan
};