
const { generateRoughPlan } = require('./roughPlanner.js');
const { generateTaskTree } = require('./taskTreeGenerator.js');

async function generatePlan(taskDescription, summary) {
  const roughPlan = await generateRoughPlan(taskDescription, summary);
  console.log('roughPlan:');
  console.log(roughPlan);
  const taskTree = await generateTaskTree(taskDescription, summary, roughPlan);
  return { roughPlan, taskTree };
}

module.exports = {
  generatePlan
};