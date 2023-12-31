const fs = require('fs');
const path = require('path');

const dockerRepoPath = '/var/qckfx/repos';
const fallbackDockerRepoPath = '~/repos';

function setupDockerDirectory() {
  try {
    // Check if the directory already exists
    if (!fs.existsSync(dockerRepoPath)) {
      // Create the directory
      try {
        fs.mkdirSync(dockerRepoPath, { recursive: true });
      } catch {
        // If the directory creation fails, use the fallback path
        fs.mkdirSync(fallbackDockerRepoPath, { recursive: true });
      }
            
      // Set directory permissions (optional, based on your security requirements)
      // fs.chmodSync(dockerRepoPath, '0777'); // Example permission setting
    }

    console.log('Docker directory is set up.');
  } catch (error) {
    console.error('Error setting up Docker directory:', error);
    process.exit(1); // Exit if the directory setup fails
  }
}

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

module.exports = { setupDockerDirectory, ensureGitSuffix, extractRepoName };

