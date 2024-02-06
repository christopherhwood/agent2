class DirectoryExplorer {
  constructor (executeCommand, gitIgnore) {
    this.executeCommand = executeCommand;
    this.gitIgnore = gitIgnore;
  }

  async exploreDirectory(directory) {
    let directories = [];
    let files = [];

    const lsOutput = await this.executeCommand(`ls -l ${directory}`);
    const lsLines = lsOutput.split('\n');
    for (const line of lsLines) {
      // skip empty lines or lines that match the format 'total x' 
      if (line.trim() === '' || line.trim().match(/^total\s+\d+$/)) {
        continue;
      }
      try {
        const {fileName, isDirectory} = parseLsLine(line);
        const gitIgnoreName = isDirectory ? fileName + '/' : fileName;
        if (this.gitIgnore.checkIfFileIsIgnored(gitIgnoreName)) {
          continue;
        }
        if (isDirectory) {
          directories.push(fileName);
        } else {
          files.push(fileName);
        }
      } catch (error) {
        console.error(error);
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
