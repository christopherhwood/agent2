const { extractDependenciesFromFile } = require('./dependencyAnalysis');
const { extractFunctionDeclarationsFromFile } = require('./functionAnalysis');
const { Container } = require('../../../dockerOperations');

class Analyzer {

  static async Create(repoName) {
    const container = await Container.Create(repoName);
    return new Analyzer(container);
  }

  constructor(container) {
    this.container = container;
    this.files = [];
  }

  async visitFile(fileName) {
    const [dependencies, functions] = await Promise.all([
      extractDependenciesFromFile(fileName, this.container.executeCommand.bind(this.container)),
      extractFunctionDeclarationsFromFile(fileName, this.container.executeCommand.bind(this.container))
    ]);
    this.files.push({ fileName, dependencies, functions });
  }

  async destroy() {
    await this.container.destroy();
  }
}

module.exports = Analyzer;