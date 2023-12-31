const Docker = require('dockerode');
const fs = require('fs');
const os = require('os');
const docker = new Docker();

const hostRepoPath = '/var/qckfx/repos';
const fallbackHostRepoPath = `${os.homedir()}/repos`;

async function getInitialContext(repoName) {
  let container = null;

  try {
    const repoPath = fs.existsSync(hostRepoPath) 
      ? hostRepoPath 
      : fallbackHostRepoPath;
    const bindMount = `${repoPath}/${repoName}:/repo`;

    // Create a temporary container for analysis
    container = await docker.createContainer({
      Image: 'qckfx-sandbox', // has tree installed
      Cmd: ['/bin/bash'],
      Tty: true,
      Volumes: { '/repo': {} },
      HostConfig: { Binds: [bindMount] }
    });

    await container.start();

    await updateRepository(container, '/repo');

    // Execute commands to get directory tree and recent commits
    const directoryTree = await executeCommandInContainer(container, 'tree /repo -I "node_modules|.git"');
    const recentCommits = await executeCommandInContainer(container, 'git -C /repo log -n 10 --pretty=format:"%h - %an, %ar : %s"');

    return {
      directoryTree,
      recentCommits
    };
  } catch (error) {
    console.error('Error getting initial context:', error);
    throw error;
  } finally {
    // Clean up: stop and remove the temporary container
    if (container) {
      await container.stop();
      await container.remove();
    }
  }
}

async function updateRepository(container, repoPath) {
  try {
    // Determine the default branch
    const defaultBranchCommand = `git -C ${repoPath} remote show origin | grep "HEAD branch" | cut -d" " -f5`;
    let defaultBranch = await executeCommandInContainer(container, defaultBranchCommand);

    // Remove non-printable characters and trim whitespace
    defaultBranch = defaultBranch.replace(/[^\x20-\x7E]+/g, '').trim();

    // Pull the latest changes from the default branch
    const gitPullCommand = `git -C ${repoPath} pull origin ${defaultBranch}`; // origin ${defaultBranch.trim()}`;
    const msg = await executeCommandInContainer(container, gitPullCommand);
    console.log(msg);
  } catch (error) {
    console.error('Error updating repository:', error);
    throw error;
  }
}

// Function to execute a command inside a Docker container
async function executeCommandInContainer(container, command) {
  console.log('command = ' + command);
  const exec = await container.exec({
    Cmd: ['bash', '-c', command],
    AttachStdout: true,
    AttachStderr: true
  });

  // Start the exec command
  const execStream = await exec.start({ Detach: false });

  return new Promise((resolve, reject) => {
    const output = [];
    
    // 'data' event for capturing stdout output
    execStream.on('data', (chunk) => output.push(chunk.toString()));

    // 'end' event for resolving the promise
    execStream.on('end', () => resolve(output.join('')));

    // 'error' event for rejecting the promise
    execStream.on('error', reject);

    // Ensure stream is properly ended after data is captured
    execStream.on('finish', () => resolve(output.join('')));
  });
}


module.exports = { getInitialContext };
