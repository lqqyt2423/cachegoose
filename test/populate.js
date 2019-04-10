'use strict';

require('should');

const mongoose = require('mongoose');
const cachegoose = require('../out');
const Schema = mongoose.Schema;

// mongoose.set('debug', true);

let db;
let Article;
let Author;

describe('cachegoose populate', () => {
  before((done) => {
    cachegoose(mongoose, {
      engine: 'redis'
    });

    mongoose.connect('mongodb://127.0.0.1/mongoose-cachegoose-testing');
    db = mongoose.connection;

    db.on('error', done);
    db.on('open', done);

    const ArticleSchema = new Schema({
      title: String,
      author: { type: 'ObjectId', ref: 'Author' }
    });
    const AuthorSchema = new Schema({
      name: String,
    });
    Article = mongoose.model('Article', ArticleSchema);
    Author = mongoose.model('Author', AuthorSchema);
  });

  beforeEach(() => {
    return generate();
  });

  afterEach((done) => {
    Promise.all([
      Author.remove(),
      Article.remove(),
    ]).then(() => {
      cachegoose.clearCache(null, done);
    });
  });

  it('should work when engine is redis', async () => {
    const authors = await Author.find({}).cache();
    authors.length.should.equal(2);
    const cacheAuthors = await Author.find({}).cache();
    cacheAuthors.length.should.equal(2);
    JSON.stringify(authors).should.equal(JSON.stringify(cacheAuthors));
  });

  it ('should work when use populate', async () => {
    const articles = await Article.find({}).populate([{ path: 'author', model: 'Author' }]).cache();
    console.log(JSON.stringify(articles));
    const cacheArticles = await Article.find({}).populate([{ path: 'author', model: 'Author' }]).cache();
    console.log(JSON.stringify(cacheArticles));
    JSON.stringify(articles).should.equal(JSON.stringify(cacheArticles));
  });
});

async function generate() {
  const author1 = await Author.create({ name: 'a' });
  const author2 = await Author.create({ name: 'b' });
  await Article.create({ title: 'first', author: author1._id });
  await Article.create({ title: 'second', author: author2._id });
}
