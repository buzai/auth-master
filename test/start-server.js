var app = require('../server/server');

global.__SERVERPATH = __dirname + '/';

module.exports = function(done) {
  /*if (app.loaded) {
    app.once('started', done);
    app.start();
  } else {
    app.once('loaded', function() {
      app.once('started', done);
      app.start();
    });
  }*/
};
