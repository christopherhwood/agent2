const Traverser = require('./parser');
const Analyzer = require('./analysis');

// Returns { fileName, dependencies, functions }
// Where dependencies is { local: [], external: [] }
// And functions is [{ name, parameters }]
async function analyzeRepo(repoName) {
  const analyzer = new Analyzer();
  const traverser = await Traverser.Create(repoName);
  await traverser.traverse('.', analyzer.visitFile, async () => {});
  await traverser.destroy();
  return analyzer.files;
}

module.exports = { analyzeRepo };
