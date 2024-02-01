const CodeParser = require('../../../codeParser');

// I want a class that I can feed the contents of a file to and it will use tree sitter to parse the file and return the top level code chunks

class CodeChunker {
  constructor() {
    this.parser = CodeParser.createParser();
  }

  chunk(contents) {
    const tree = this.parser.parse(contents);

    let buffer = '';
    let chunks = [];
    for (const node of tree.rootNode.children) {
      if (node.type === 'comment') {
        if (buffer.length > 0) {
          buffer += '\n';
        }
        buffer += node.text;
      } else {
        if (buffer.length > 0) {
          buffer += '\n';
        }
        buffer += node.text;
        chunks.push({text: buffer, type: node.type});
        buffer = '';
      }
    }
    return chunks;
  }
}

module.exports = CodeChunker;