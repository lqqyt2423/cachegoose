'use strict';

const Benchmark = require('benchmark');
const suite = new Benchmark.Suite();

const mongoose = require('mongoose');
const cachegoose = require('./out');
const Schema = mongoose.Schema;

// mongoose.set('debug', true);

let db;
let Article;
let User;
let Comment;

cachegoose(mongoose, {
  engine: 'redis'
});

function connect(done) {
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
}

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

function after(done) {
  Promise.all([
    User.remove(),
    Article.remove(),
    Comment.remove(),
  ]).then(() => {
    cachegoose.clearCache(null, done);
  });
}

connect(() => {
  generate().then(() => {
    // add tests
    suite.add('Mongo', (deferred) => {
      Article.find({}).populate('user comments info.author').then(() => {
        deferred.resolve();
      });
    }, { 'defer': true })
      .add('RedisCache', (deferred) => {
        Article.find({}).populate('user comments info.author').cache().then(() => {
          deferred.resolve();
        });
      }, { 'defer': true })
      // add listeners
      .on('cycle', (event) => {
        // eslint-disable-next-line
        console.log(String(event.target));
      })
      .on('complete', function() {
        // eslint-disable-next-line
        console.log('Fastest is ' + this.filter('fastest').map('name'));
        after(() => {
          process.exit();
        });
      })
      .run({ 'async': true });
  });
});
