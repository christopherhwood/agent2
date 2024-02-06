const Traverser = require('./parser');
const Analyzer = require('./analysis');

// Returns { fileName, dependencies, functions }
// Where dependencies is { local: [], external: [] }
// And functions is [{ name, parameters }]
async function analyzeRepo(repoName) {
  const analyzer = await Analyzer.Create(repoName);
  const traverser = await Traverser.Create(repoName);
  await traverser.traverse('.', analyzer.visitFile.bind(analyzer), async () => {});
  await traverser.destroy();
  const files = analyzer.files;
  await analyzer.destroy();
  return files;
}

module.exports = { analyzeRepo };
