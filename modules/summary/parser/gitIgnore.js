const { executeCommand } = require('../../../dockerOperations');

class GitIgnore {
  constructor(gitIgnorePatterns) {
    this.gitIgnorePatterns = gitIgnorePatterns;
  }

  checkIfFileIsIgnored(fileName) {
    for (const pattern of this.gitIgnorePatterns) {
      if (fileName.match(pattern)) {
        return true;
      }
    }
    return false;
  }

  static async getGitIgnorePatterns(repoName) {
    const gitIgnoreContents = await executeCommand('cat .gitignore', repoName);
    const gitIgnoreLines = gitIgnoreContents.split('\n');
    const gitIgnorePatterns = gitIgnoreLines.filter(line => line.length > 0 && !line.startsWith('#'));
    return gitIgnorePatterns;
  }
}

module.exports = GitIgnore;