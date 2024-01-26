const { gatherResources } = require('./resourceGatherer');
const { answerQuestion } = require('./answerer');
const { analyzeRepo } = require('../../summary/analyzeRepo');

async function answerQuestions(repoName, repoContext, repoSummary, questions) {
  const repoAnalysis = await analyzeRepo(repoName);
  const answersPromises = questions.map(async (question) => {
    const resources = await gatherResources(repoName, repoContext, repoAnalysis, repoSummary, question);
    const answer = await answerQuestion(question, resources, repoSummary);
    console.log('question:');
    console.log(question);
    console.log('resources:');
    console.log(resources.map(r => r.name).join(', '));
    console.log('answer:');
    console.log(answer);
    return answer;
  });
  const answers = await Promise.all(answersPromises);
  return answers;
}

module.exports = { answerQuestions };