const crypto = require('crypto');

function ensureGitSuffix(url) {
  if (!url.endsWith('.git')) {
    return url + '.git';
  }
  return url;
}

function extractRepoName(gitRepoUrl) {
  // Assuming the URL ends with '.git'
  const parts = gitRepoUrl.split('/');
  let repoName = parts.pop(); // gets 'repo.git'
  
  // Remove '.git' if present
  repoName = repoName.replace('.git', '');
      
  return repoName;
}

function hashText(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex');
}

module.exports = { ensureGitSuffix, extractRepoName, hashText };
