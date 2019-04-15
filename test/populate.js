'use strict';

require('should');

const mongoose = require('mongoose');
const cachegoose = require('../out');
const Schema = mongoose.Schema;

// mongoose.set('debug', true);

let db;
let Article;
let User;
let Comment;

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
      user: { type: 'ObjectId', ref: 'User' },
      comments: [{ type: 'ObjectId', ref: 'Comment' }],
      info: {
        category: String,
        author: { type: 'ObjectId', ref: 'User' },
      },
    });
    const UserSchema = new Schema({
      name: String,
    });
    UserSchema.methods.getName = function() { return this.name; };
    const CommentSchema = new Schema({
      content: String,
      user: { type: 'ObjectId', ref: 'User' },
    });
    Article = mongoose.model('Article', ArticleSchema);
    User = mongoose.model('User', UserSchema);
    Comment = mongoose.model('Comment', CommentSchema);
  });

  beforeEach(() => {
    return generate();
  });

  afterEach((done) => {
    Promise.all([
      User.remove(),
      Article.remove(),
    ]).then(() => {
      cachegoose.clearCache(null, done);
    });
  });

  it('should work when engine is redis', async () => {
    const fn = () => { return User.find({}).cache(); };
    const users = await fn();
    users.length.should.equal(2);
    const cacheUsers = await fn();
    cacheUsers.length.should.equal(2);
    JSON.stringify(users).should.equal(JSON.stringify(cacheUsers));
  });

  it('should return a Mongoose model from cached and non-cached results', async () => {
    const fn = () => { return Article.find({}).populate('user').cache(); };
    const articles = await fn();
    const cacheArticles = await fn();
    articles[0].constructor.name.should.equal('model');
    cacheArticles[0].constructor.name.should.equal('model');
    articles[0].user.constructor.name.should.equal('model');
    cacheArticles[0].user.constructor.name.should.equal('model');
  });

  it('should return a Mongoose model from cached and non-cached results when populate mult fields', async () => {
    const fn = () => { return Article.find({}).populate('user comments info.author').cache(); };
    const articles = await fn();
    const cacheArticles = await fn();
    articles[0].constructor.name.should.equal('model');
    cacheArticles[0].constructor.name.should.equal('model');
    articles[0].user.constructor.name.should.equal('model');
    cacheArticles[0].user.constructor.name.should.equal('model');
    articles[0].comments[0].constructor.name.should.equal('model');
    cacheArticles[0].comments[0].constructor.name.should.equal('model');
    articles[0].info.author.constructor.name.should.equal('model');
    cacheArticles[0].info.author.constructor.name.should.equal('model');
  });

  it('should work when use populate', async () => {
    const testEqual = (articles, cacheArticles) => {
      articles.forEach((doc, index) => {
        const cacheDoc = cacheArticles[index];
        doc.id.should.equal(cacheDoc.id);
        doc.title.should.equal(cacheDoc.title);
        doc.user.id.should.equal(cacheDoc.user.id);
        doc.user.name.should.equal(cacheDoc.user.name);
      });
    };

    const testFn = async (populateOptions) => {
      const fn = () => { return Article.find({}).populate(populateOptions).cache(); };
      const articles = await fn();
      const cacheArticles = await fn();
      testEqual(articles, cacheArticles);
      await new Promise((resolve) => {
        cachegoose.clearCache(null, resolve);
      });
    };

    await testFn('user');
    await testFn({ path: 'user', model: 'User' });
    await testFn({ path: 'user' });
    await testFn([{ path: 'user', model: 'User' }]);
    await testFn([{ path: 'user' }]);
  });

  it('should work when populate mult fields', async () => {
    const testEqual = (articles, cacheArticles) => {
      articles.forEach((doc, index) => {
        const cacheDoc = cacheArticles[index];
        doc.id.should.equal(cacheDoc.id);
        doc.title.should.equal(cacheDoc.title);
        doc.user.id.should.equal(cacheDoc.user.id);
        doc.user.name.should.equal(cacheDoc.user.name);
        doc.comments.forEach((c, i) => {
          const _c = cacheDoc.comments[i];
          c.id.should.equal(_c.id);
          c.content.should.equal(_c.content);
          String(c.user).should.equal(String(_c.user));
        });
      });
    };

    const testFn = async (fn) => {
      const articles = await fn();
      const cacheArticles = await fn();
      testEqual(articles, cacheArticles);
      await new Promise((resolve) => {
        cachegoose.clearCache(null, resolve);
      });
    };

    await testFn(() => { return Article.find({}).populate('user comments').cache(); });
    await testFn(() => { return Article.find({}).populate('user').populate('comments').cache(); });
    await testFn(() => {
      return Article.find({}).populate([
        { path: 'user', model: 'User' },
        { path: 'comments', model: 'Comment' }
      ]).cache();
    });
    await testFn(() => {
      return Article.find({}).populate([
        { path: 'user' },
        { path: 'comments' }
      ]).cache();
    });
  });

  it('should work when populate nested field', async () => {
    const testEqual = (articles, cacheArticles) => {
      articles.forEach((doc, index) => {
        const cacheDoc = cacheArticles[index];
        doc.id.should.equal(cacheDoc.id);
        doc.title.should.equal(cacheDoc.title);
        doc.info.category.should.equal(cacheDoc.info.category);
        doc.info.author.id.should.equal(cacheDoc.info.author.id);
        doc.info.author.name.should.equal(cacheDoc.info.author.name);
        doc.info.author.getName().should.equal(doc.info.author.name);
        cacheDoc.info.author.getName().should.equal(cacheDoc.info.author.name);
      });
    };

    const testFn = async (fn) => {
      const articles = await fn();
      const cacheArticles = await fn();
      testEqual(articles, cacheArticles);
      await new Promise((resolve) => {
        cachegoose.clearCache(null, resolve);
      });
    };

    await testFn(() => { return Article.find({}).populate('info.author').cache(); });
    await testFn(() => { return Article.find({}).populate('user comments info.author').cache(); });
  });

  it('should work when sub populate', async () => {
    const testEqual = (articles, cacheArticles) => {
      articles.forEach((doc, index) => {
        const cacheDoc = cacheArticles[index];
        doc.id.should.equal(cacheDoc.id);
        doc.title.should.equal(cacheDoc.title);
        doc.comments.forEach((comment, i) => {
          const chcheComment = cacheDoc.comments[i];
          comment.id.should.equal(chcheComment.id);
          comment.content.should.equal(chcheComment.content);
          comment.user.id.should.equal(chcheComment.user.id);
          comment.user.name.should.equal(chcheComment.user.name);
          comment.user.getName().should.equal(comment.user.name);
          chcheComment.user.getName().should.equal(chcheComment.user.name);
        });
      });
    };

    const testFn = async (fn) => {
      const articles = await fn();
      const cacheArticles = await fn();
      testEqual(articles, cacheArticles);

      // test Mongoose model
      articles[0].comments[0].constructor.name.should.equal('model');
      cacheArticles[0].comments[0].constructor.name.should.equal('model');
      articles[0].comments[0].user.constructor.name.should.equal('model');
      cacheArticles[0].comments[0].user.constructor.name.should.equal('model');

      await new Promise((resolve) => {
        cachegoose.clearCache(null, resolve);
      });
    };

    await testFn(() => {
      return Article.find({}).populate({
        path: 'comments',
        populate: { path: 'user' },
      }).cache();
    });
    await testFn(() => {
      return Article.find({}).populate('user').populate({
        path: 'comments',
        populate: { path: 'user' },
      }).cache();
    });
  });
});


async function generate() {
  const user1 = await User.create({ name: 'a' });
  const user2 = await User.create({ name: 'b' });
  const comment1 = await Comment.create({ content: 'one', user: user1._id });
  const comment2 = await Comment.create({ content: 'two', user: user2._id });
  const comment3 = await Comment.create({ content: 'three', user: user1._id });
  const comment4 = await Comment.create({ content: 'four', user: user2._id });
  await Article.create({
    title: 'first',
    user: user1._id,
    comments: [comment1._id, comment2._id],
    info: {
      category: 'one',
      author: user1._id,
    },
  });
  await Article.create({
    title: 'second',
    user: user2._id,
    comments: [comment3._id, comment4._id],
    info: {
      category: 'two',
      author: user2._id,
    },
  });
}
