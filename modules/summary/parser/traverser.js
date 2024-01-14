const DirectoryExplorer = require('./directoryExplorer');
const GitIgnore = require('./gitIgnore');
const { Container } = require('../../../dockerOperations');

class Traverser {
  static async Create(repoName) {
    const container = await Container.Create(repoName);
    const gitIgnorePatterns = await GitIgnore.getGitIgnorePatterns(repoName);
    return new Traverser(gitIgnorePatterns, container);
  }

  constructor(gitIgnorePatterns, container) {
    this.container = container;
    this.gitIgnore = new GitIgnore(gitIgnorePatterns);
    this.directoryExplorer = new DirectoryExplorer(this.container.executeCommand, this.gitIgnore);
  }

  async traverse(directory, fileVisitor, directoryVisitor) {
    const dir = await this.directoryExplorer.exploreDirectory(directory); 
    let filePromises = dir.files.map(file => fileVisitor(file));
    let directoryPromises = dir.directories.map(dir => directoryVisitor(dir));
    await Promise.all([...filePromises, ...directoryPromises]);
  }

  async destroy() {
    await this.container.destroy();
  }
}

module.exports = Traverser;