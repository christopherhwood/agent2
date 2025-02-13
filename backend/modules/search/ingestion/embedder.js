const { OpenAI } = require('openai');

const openai = new OpenAI(process.env.OPENAI_API_KEY);

async function createEmbedding(text) {
  console.log('Embedding text:\n```' + text + '\n```');
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float'
  });
  return embedding.data[0].embedding;
}

module.exports = { createEmbedding };