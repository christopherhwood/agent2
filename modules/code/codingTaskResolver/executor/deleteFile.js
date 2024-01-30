const { executeCommand } = require('../../../../dockerOperations');

async function deleteFile(filePath, repoName) {
  return await executeCommand(`rm ${filePath}`, repoName);
}

module.exports = { deleteFile };