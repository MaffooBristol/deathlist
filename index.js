const _ = require('lodash');
const wikipedia = require('node-wikipedia');
const MongoClient = require('mongodb').MongoClient;
const nodemailer = require('nodemailer');

opts = {
  list: 1
};

const url = 'mongodb://localhost:27017/deathlist';

const results = {
  alive: [],
  dead: [],
};

MongoClient.connect(url, function(err, db) {
  if (err) {
    console.log("Error connecting to MongoDB. Are you sure it's running, bro?");
    return;
  }
  console.log("Connected correctly to server");

  const peopleCol = db.collection('people');

  peopleCol.find({}).toArray((err, people) => {

    let peopleCount = people.length;

    people.forEach((person) => {
      const emojis = [];
      let status;
      wikipedia.page.data(person.nameCanon, { content: false }, (response) => {
        peopleCount--;
        if (response === undefined) {
          console.log(`🚫 Couldn't find ${person.nameCanon}`);
          return;
        }
        if (person.nameCanon !== response.title) {
          emojis.push('😕');
        }
        const deathTag = _.filter(response.categories, category => /\_deaths/gi.test(category['*']));
        if (deathTag.length > 0) {
          results.dead.push(person);
          status = 'dead';
          if (opts.list) {
            console.log(`💀 Yeah, ${person.nameCanon} is dead!`);
          }
        }
        else {
          results.alive.push(person);
          status = 'alive';
          if (opts.list) {
            console.log(`😊 Nah, ${person.nameCanon} is still alive. ${emojis.join(' ')}`);
          }
        }
        if (person.status === undefined || person.status !== status) {
          peopleCol.update({ nameCanon: person.nameCanon }, { $set: { status } });
          if (status === 'dead') {
            const transporter = nodemailer.createTransport({
              sendmail: true,
              newline: 'unix',
              path: '/usr/sbin/sendmail',
            });
            transporter.sendMail({
              from: 'dieguy@deathwatch.io',
              to: 'mattflet@gmail.com',
              subject: `${person.nameCanon} has died!`,
              text: 'Incredible!',
            }, (err, info) => {
              console.log(info.envelope);
              console.log(info.messageId);
            });
          }
        }
        if (peopleCount <= 0) {
          console.log(`Results in! You've scored ${results.dead.length}/${people.length}`);
          db.close();
        }
      });
    });

  });

});
