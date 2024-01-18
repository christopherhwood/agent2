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

class Container {
  static async Create(repoName) {
    const container = await createContainer(repoName);
    return new Container(repoName, container);
  }

  constructor(repoName, container) {
    this.repoName = repoName;
    this.container = container;
  }

  async executeCommand(command) {
    return await executeCommand(command, this.repoName, this.container);
  }

  async destroy() {
    await destroyContainer(this.container);
  }
}

// Returns a handle to the Docker container
// that can be passed in and used in other requests.
// Remember to manually destroy your container if you start it manually.
async function createContainer(repoName) {
  const hostPath = fs.existsSync(hostRepoPath) ? hostRepoPath : fallbackHostRepoPath;

  const container = await docker.createContainer({
    Image: 'qckfx-sandbox', // has tree & custom scripts
    Cmd: ['/bin/bash'],
    Tty: true,
    WorkingDir: `/repos/${repoName}`,
    Volumes: { '/repos': {} },
    HostConfig: { Binds: [`${hostPath}:/repos`] }
  });

  await container.start();
  return container;
}

async function destroyContainer(container) {
  await container.stop();
  await container.remove();
}

// If a preExistingContainer is passed in then we don't stop & remove it,
// the lifetime of the container is controlled externally.
// If there is no preExistingContainer passed in then we create a new container,
// start it, execute the command, and then stop & remove it. It is only alive
// for the duration of this function.
async function executeCommand(command, repoName, preExistingContainer) {
  let container = preExistingContainer;

  try {
    const hostPath = fs.existsSync(hostRepoPath) ? hostRepoPath : fallbackHostRepoPath;
    if (!container) {
      // Create Docker container configuration
      container = await docker.createContainer({
        Image: 'qckfx-sandbox', // has tree & custom scripts
        Cmd: ['/bin/bash'],
        Tty: true,
        WorkingDir: `/repos/${repoName}`,
        Volumes: { '/repos': {} },
        HostConfig: { Binds: [`${hostPath}:/repos`] }
      });

      await container.start();
    }
    
    // Execute the command in the Docker container
    let exec = await container.exec({
      Cmd: ['bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true
    });

    let execStream = await exec.start({ Detach: false });

    return new Promise((resolve, reject) => {
      const output = [];

      execStream.on('data', (chunk) => {
        // The first 8 bytes of the stream are a header used by docker, so we skip them
        output.push(chunk.slice(8));
      });

      execStream.on('end', () => {
        const outputStr = output.toString().replace(/[^\x20-\x7E\n]+/g, '');
        console.log(`Command:\n${command}\n--\n--\nOutput:\n`, outputStr);
        resolve(outputStr);
      });
  
      execStream.on('error', reject);
    });
  } catch (error) {
    console.error('Error executing command:', error);
    throw error;
  } finally {
    // Stop and remove the container after use
    if (!preExistingContainer && container) {
      await container.stop();
      await container.remove();
    }
  }
}

module.exports = {
  Container,
  cloneRepositoryInContainer,
  createContainer,
  destroyContainer,
  executeCommand
};
