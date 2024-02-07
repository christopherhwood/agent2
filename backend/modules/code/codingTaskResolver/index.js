const { updateRepoEmbeddings } = require('../../search/ingestion/traverseRepo');
const { executeTask } = require('./executor/executeTask');
const StyleGuideAuthor = require('./executor/styleGuideAuthor');

class CodingTaskResolver {
  constructor(repoName) {
    this.repoName = repoName;
  }

  // lazily create a style guide for the repository
  async getStyleGuide() {
    if (!this.styleGuide) {
      const author = new StyleGuideAuthor(this.repoName);
      this.styleGuide = await author.createStyleGuide();
    }
    return this.styleGuide;
  }

  async resolveTask(task, problemStatement) {
    const styleGuide = await this.getStyleGuide();
    await executeTask(task, problemStatement, styleGuide, this.repoName);
    await updateRepoEmbeddings(this.repoName);
  }
}

module.exports = CodingTaskResolver;
