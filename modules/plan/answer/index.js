const { gatherResources } = require('./resourceGatherer');
const { answerQuestion } = require('./answerer');
const { analyzeRepo } = require('../../summary/analyzeRepo');

async function answerQuestions(repoName, repoContext, repoSummary, questions) {
  const answers = [];
  const repoAnalysis = await analyzeRepo(repoName);
  for (const question of questions) {
    const resources = await gatherResources(repoName, repoContext, repoAnalysis, repoSummary, question);
    const answer = await answerQuestion(question, resources, repoSummary);
    answers.push(answer);
    console.log('question:');
    console.log(question);
    console.log('resources:');
    console.log(resources.map(r => r.name).join(', '));
    console.log('answer:');
    console.log(answer);
  }
  return answers;
}

module.exports = { answerQuestions };