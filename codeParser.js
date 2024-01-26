const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');

function createParser() {
  const parser = new Parser();
  parser.setLanguage(JavaScript);
  return parser;
}

function createQuery(query) {
  return new Parser.Query(JavaScript, query);
}

module.exports = { createParser, createQuery };