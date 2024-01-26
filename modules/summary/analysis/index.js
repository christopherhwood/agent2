const { extractDependencies } = require('./dependencyAnalysis');
const { extractFunctions } = require('./functionAnalysis');
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
    const fileContents = await this.container.executeCommand(`cat ${fileName}`);
    const dependencies = await extractDependencies(fileContents, fileName, this.container.repoName);
    const functions = extractFunctions(fileContents);
    const localDependencyFileNames = dependencies.local.map(d => d.pathRelativeToRoot);
    const externalDependencyNames = dependencies.external.map(d => d.name);
    this.files.push({ fileName, dependencies: {local: localDependencyFileNames, external: externalDependencyNames}, functions });
  }

  async destroy() {
    await this.container.destroy();
  }
}

module.exports = Analyzer;