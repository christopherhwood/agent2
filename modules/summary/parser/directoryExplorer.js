const { executeCommand } = require('../../../dockerOperations');

class DirectoryExplorer {
  constructor (executeCommand, gitIgnore) {
    this.executeCommand = executeCommand;
    this.gitIgnore = gitIgnore;
  }

  async exploreDirectory(directory) {
    let directories = [];
    let files = [];

    const lsOutput = await executeCommand(`ls -l ${directory}`);
    const lsLines = lsOutput.split('\n');
    for (const line of lsLines) {
      try {
        const {fileName, isDirectory} = parseLsLine(line);
        if (this.gitIgnore.checkIfFileIsIgnored(fileName)) {
          continue;
        }
        if (isDirectory) {
          directories.push(fileName);
        } else {
          files.push(fileName);
        }
      } catch (error) {
        console.log(error);
      }
    }
    return {directories, files};
  }
}

function parseLsLine(lsLine) {
  const parts = lsLine.split(/\s+/);
  if (parts.length < 9) {
    throw new Error(`Invalid ls line: ${lsLine}`);
  }

  const typeChar = parts[0].charAt(0); // First character of permissions
  const isDirectory = typeChar === 'd';
  const fileName = parts.slice(8).join(' '); // Handle filenames with spaces

  return {fileName, isDirectory};
}

module.exports = DirectoryExplorer;
