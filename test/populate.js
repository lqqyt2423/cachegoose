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
    const fn = () => { return Author.find({}).cache(); };
    const authors = await fn();
    authors.length.should.equal(2);
    const cacheAuthors = await fn();
    cacheAuthors.length.should.equal(2);
    JSON.stringify(authors).should.equal(JSON.stringify(cacheAuthors));
  });

  it('should return a Mongoose model from cached and non-cached results', async () => {
    const fn = () => { return Article.find({}).populate('author').cache(); };
    const articles = await fn();
    const cacheArticles = await fn();
    articles[0].constructor.name.should.equal('model');
    cacheArticles[0].constructor.name.should.equal('model');
  });

  it('should work when use populate', async () => {
    const fn = () => { return Article.find({}).populate('author').cache(); };
    const articles = await fn();
    const cacheArticles = await fn();

    // TODO: 对比两个对象/数组的方法，排除对象内字段顺序的影响
    articles.forEach((doc, index) => {
      const cacheDoc = cacheArticles[index];
      doc.id.should.equal(cacheDoc.id);
      doc.title.should.equal(cacheDoc.title);
      JSON.stringify(doc.author).should.equal(JSON.stringify(cacheDoc.author));
    });
  });
});

async function generate() {
  const author1 = await Author.create({ name: 'a' });
  const author2 = await Author.create({ name: 'b' });
  await Article.create({ title: 'first', author: author1._id });
  await Article.create({ title: 'second', author: author2._id });
}
