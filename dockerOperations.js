const Docker = require('dockerode');
const fs = require('fs');
const os = require('os');
const { extractRepoName } = require('./utils');
const docker = new Docker();

const hostRepoPath = '/var/qckfx/repos';
const fallbackHostRepoPath = `${os.homedir()}/repos`;

async function cloneRepositoryInContainer(gitRepoUrl, userToken) {
  let container = null;

  try {
    const repoName = extractRepoName(gitRepoUrl);
    const cloneDir = `/repos/${repoName}`;
    const hostPath = fs.existsSync(hostRepoPath) ? hostRepoPath : fallbackHostRepoPath;
    // Create Docker container configuration
    container = await docker.createContainer({
      Image: 'node:latest', // Ensure this image includes Git
      Cmd: ['/bin/bash'],
      Tty: true,
      Volumes: { '/repos': {} },
      HostConfig: { Binds: [`${hostPath}:/repos`] }
    });

    await container.start();

    // Prepare the Git clone command with authentication if provided
    const authUrl = userToken ? 
      gitRepoUrl.replace('//', `//${encodeURIComponent(userToken)}@`) : 
      gitRepoUrl;
    const cloneCommand = `git clone ${authUrl} ${cloneDir}`;

    // Execute the Git clone command in the Docker container
    let exec = await container.exec({
      Cmd: ['bash', '-c', cloneCommand],
      AttachStdout: true,
      AttachStderr: true
    });

    let execStream = await exec.start({ Detach: false });

    // Handle stream to capture logs and check for errors
    await new Promise((resolve, reject) => {
      docker.modem.demuxStream(execStream, process.stdout, process.stderr);
      execStream.on('end', resolve);
      execStream.on('error', reject);
    });

  } catch (error) {
    console.error('Error cloning repository:', error);
    throw error;
  } finally {
    // Stop and remove the container after use
    if (container) {
      await container.stop();
      await container.remove();
    }
  }
}

module.exports = {
  cloneRepositoryInContainer
};
