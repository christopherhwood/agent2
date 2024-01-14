const { extractDependenciesFromFile } = require('./dependencyAnalysis');
const { extractFunctionDeclarationsFromFile } = require('./functionAnalysis');

class Analyzer {
  constructor() {
    this.files = [];
  }

  async visitFile(fileName) {
    const [dependencies, functions] = await Promise.all([
      extractDependenciesFromFile(fileName),
      extractFunctionDeclarationsFromFile(fileName)
    ]);
    this.files.push({ fileName, dependencies, functions });
  }
}

module.exports = Analyzer;