const { Container } = require('../../../dockerOperations');
const DirectoryExplorer = require('./directoryExplorer');
const GitIgnore = require('./gitIgnore');

class Traverser {
  static async Create(repoName) {
    const container = await Container.Create(repoName);
    const gitIgnorePatterns = await GitIgnore.getGitIgnorePatterns(repoName);
    return new Traverser(gitIgnorePatterns, container);
  }

  constructor(gitIgnorePatterns, container) {
    this.container = container;
    this.gitIgnore = new GitIgnore(gitIgnorePatterns);
    this.directoryExplorer = new DirectoryExplorer(this.container.executeCommand.bind(this.container), this.gitIgnore);
  }

  async traverse(directory, fileVisitor, directoryVisitor) {
    const dir = await this.directoryExplorer.exploreDirectory(directory); 
    let filePromises = dir.files.map(file => {
      const joinedFileName = directory + '/' + file;
      fileVisitor(joinedFileName);
    });
    let directoryPromises = dir.directories.map(dir => {
      const joinedDirName = directory + '/' + dir;
      directoryVisitor(joinedDirName);
    });
    await Promise.all([...filePromises, ...directoryPromises]);
    for (const dirName of dir.directories) {
      const joinedDirName = directory + '/' + dirName;
      await this.traverse(joinedDirName, fileVisitor, directoryVisitor);
    }
  }

  async destroy() {
    await this.container.destroy();
  }
}

module.exports = Traverser;