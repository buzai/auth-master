/* jshint camelcase: false */
var app = require('../server/server');
var request = require('supertest');
var assert = require('assert');
var expect = require('chai').expect;
var should = require('should');
var loopback = require('loopback');
var testDataSetup = require('./test-data.js');

var Q = require('q');

var AccessToken = app.models.AccessToken;
var User;
var Role;
var RoleMapping;

var adminAccessToken;
var ownerAccessToken;
var memberAccessToken;
var orgId = 1;
var admin = { username: 'Admin', email: 'Admin@doa.com', password: 'password', orgId: orgId};
var owner = { username: 'karl', email: 'karl@doa.com', password: 'password', orgId: orgId};
var member = { username: 'member', email: 'member@doa.com', password: 'password', orgId: orgId};

User = app.models.user;
Role = app.models.Role;
RoleMapping = app.models.RoleMapping;
var Mail = app.models.Email;

Mail.send = function(options, fn){
  fn(null, options);
};

function json(verb, url) {
  return request(app)[verb](url)
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/);
}

function clearUsers(done) {
  User.find({}, function(err,users){
    users.forEach(function(user){
      User.destroyById(user.id);
    });
     User.accessToken.destroyAll(function(err){
        Role.destroyAll(done);
      });
  });
  /*User.destroyAll(function(err) {
      User.accessToken.destroyAll(function(err){
        Role.destroyAll(done);
      });
    });*/
}

function initUsers(done) {
  
  User.create([admin, owner, member], function(err, users) {
    //create the admin role
    Role.create({
      name: 'admin'
    }, function(err, role) {
      if (err) throw err;

      //make Admin an admin
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: users[0].id
      }, function(err, principal) {
        if (err) throw err;


        json('post', '/api/users/login')
          .send({
            username: 'Admin',
            password: 'password'
          })
          .expect(200, function(err, res) {
            if (err) throw err;
            assert(typeof res.body === 'object');
            assert(res.body.id, 'must have an access token');
            adminAccessToken = res.body.id;
            admin.userId = res.body.userId;
            json('post', '/api/users/login')
              .send({
                username: 'karl',
                password: 'password'
              })
              .expect(200, function(err, res) {
                if (err) throw err;
                assert(typeof res.body === 'object');
                assert(res.body.id, 'must have an access token');
                ownerAccessToken = res.body.id;
                owner.userId = res.body.userId;
                json('post', '/api/users/login')
                  .send({
                    username: 'member',
                    password: 'password'
                  })
                  .expect(200, function(err, res) {
                    assert(typeof res.body === 'object');
                    assert(res.body.id, 'must have an access token');
                    memberAccessToken = res.body.id;
                    member.userId = res.body.userId;
                    done();
                  });
              });
          });
      });
    });
  });
}

describe('Users REST API', function() {
  var userData = {
        username: 'testuser',
        email: 'test@doa.com',
        password: 'password'
      };
  var changeData = {
        username: 'changeData',
        email: 'changeData@doa.com',
        password: 'password'
      };
  var sameEmail = {
        username: 'noname',
        email: 'test@doa.com',
        password: 'password'
      };
  var sameUser = {
        username: 'testuser',
        email: 'not@doa.com',
        password: 'password'
      };
  var missingPassword = {
        username: 'testuser',
        email: 'not@doa.com'
      };
  var missingEmail = {
        username: 'testuser',
        password: 'password'
      };
  var missingUsername = {
        email: 'missingUsername@doa.com',
        password: 'password'
      };
  var missingUsername2 = {
        email: 'missingUsername2@doa.com',
        password: 'password'
      };
   
  before(function(done) {
    require('./start-server');
    done();
  });

  after(function(done) {
    app.removeAllListeners('started');
    app.removeAllListeners('loaded');
    done();
  });

  describe('Get/Users REST API', function() {
    before(function(done) {
      clearUsers(done);
    });

    before(function(done) {
      initUsers(done);
    });

    it('should not allow access without access token', function(done) {
      json('get', '/api/users')
        .expect(401, done);
    });

    it('should not allow access with wrong access token', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('get', '/api/users' + '?access_token=' + accessToken)
        .expect(401, done);
    });

    it('should not allow access by non-admin', function(done) {
      json('get', '/api/users' + '?access_token=' + ownerAccessToken)
        .expect(401, done);
    });

    it('should allow admin access', function(done) {
      json('get', '/api/users' + '?access_token=' + adminAccessToken)
        .expect(200, function(err, res) {
          if (err) return done(err);
          var users = res.body;
          assert(Array.isArray(users));
          assert(users.length > 1);
          should(users[0]).have.property('email');
          done();
        });
    });
  });

  describe('Create Users REST API', function() {
    
    before(function(done) {
      clearUsers(done);
    });

    before(function(done) {
      initUsers(done);
    });

    it('should not allow access without access token', function(done) {
      json('post', '/api/users')
        .send(userData)
        .expect(401, done);
    });

    it('should not allow access with wrong access token', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('post', '/api/users' + '?access_token=' + accessToken)
        .send(userData)
        .expect(401, done);
    });

    it('should not allow access by non-admin', function(done) {
      json('post', '/api/users' + '?access_token=' + ownerAccessToken)
        .send(userData)
        .expect(401, done);
    });

    it('should allow admin access', function(done) {
      json('post', '/api/users' + '?access_token=' + adminAccessToken)
        .send(userData)
        .expect(200, function(err, res) {
          var user = res.body;
          assert.equal(user.email, userData.email);
          user.should.not.have.property('password');
          done();
        });
    });

    it('should not allow because of same email address', function(done) {
      json('post', '/api/users' + '?access_token=' + adminAccessToken)
        .send(sameEmail)
        .expect(422,done);
    });

    it('should not allow because of same username', function(done) {
      json('post', '/api/users' + '?access_token=' + adminAccessToken)
        .send(sameUser)
        .expect(422,done);
    });

    it('should not allow for missing password', function(done) {
      json('post', '/api/users' + '?access_token=' + adminAccessToken)
        .send(missingPassword)
        .expect(422,done);
    });

    it('should not allow for missing email', function(done) {
      json('post', '/api/users' + '?access_token=' + adminAccessToken)
        .send(missingEmail)
        .expect(422,done);
    });

    it('should ok if there is no username', function(done) {
      json('post', '/api/users' + '?access_token=' + adminAccessToken)
        .send(missingUsername)
        .expect(200,function(err, res){

          json('post', '/api/users' + '?access_token=' + adminAccessToken)
            .send(missingUsername2)
            .expect(200,done);
        });
    });

  });

  describe('Update Users REST API', function() {

    before(function(done) {
      clearUsers(done);
    });

    before(function(done) {
      initUsers(done);
    });

    it('should not allow access without access token', function(done) {
      json('put', '/api/users')
        .send(userData)
        .expect(401, done);
    });

    it('should not allow access with wrong access token', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('put', '/api/users' + '?access_token=' + accessToken)
        .send(userData)
        .expect(401, done);
    });

    it('should not allow access by non-admin', function(done) {
      json('put', '/api/users' + '?access_token=' + ownerAccessToken)
        .send(userData)
        .expect(401, done);
    });


    it('should allow admin access--insert mode', function(done) {
      json('put', '/api/users' + '?access_token=' + adminAccessToken)
        .send(userData)
        .expect(200, function(err, res) {
          var user = res.body;
          assert.equal(user.email, userData.email);
          user.should.not.have.property('password');
          done();
        });
    });

    it('should not allow because of same email address', function(done) {
      json('put', '/api/users' + '?access_token=' + adminAccessToken)
        .send(sameEmail)
        .expect(422,done);
    });

    it('should not allow because of same username', function(done) {
      json('put', '/api/users' + '?access_token=' + adminAccessToken)
        .send(sameUser)
        .expect(422,done);
    });

    it('should not allow for missing password', function(done) {
      json('put', '/api/users' + '?access_token=' + adminAccessToken)
        .send(missingPassword)
        .expect(422,done);
    });

    it('should not allow for missing email', function(done) {
      json('put', '/api/users' + '?access_token=' + adminAccessToken)
        .send(missingEmail)
        .expect(422,done);
    });

    it('should allow admin access--update mode', function(done) {
      json('put', '/api/users' + '?access_token=' + adminAccessToken)
        .send(changeData)
        .expect(200, function(err, res) {
          var user = res.body;
          assert.equal(user.email, changeData.email);
          user.should.not.have.property('password');
          var newData = user;
          newData.username = 'newuser';
          newData.password = 'password';
          json('put', '/api/users' + '?access_token=' + adminAccessToken)
            .send(newData)
            .expect(200, function(err, res) {
              var user = res.body;
              assert.equal(user.username, newData.username);
              done();
            });
        });
    });
  });

  describe('Users/{id} REST API', function() {

    before(function(done) {
      clearUsers(done);
    });

    before(function(done) {
      initUsers(done);
    });

    it('should not allow access with wrong access token', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('put', '/api/users/' + owner.userId + '?access_token=' + accessToken)
        .send(userData)
        .expect(401, function(err, res){
          json('get', '/api/users/' + owner.userId + '?access_token=' + accessToken)
            .expect(401,function(err, res){
              json('delete', '/api/users/' + owner.userId + '?access_token=' + accessToken)
                .expect(401, done);
            });
        });
    });

    it('non-admin should not allow access other user', function(done) {
      json('put', '/api/users/' + admin.userId + '?access_token=' + ownerAccessToken)
        .send(userData)
        .expect(401, function(err, res){
          json('get', '/api/users/' + admin.userId + '?access_token=' + ownerAccessToken)
            .expect(401,function(err, res){
              json('delete', '/api/users/' + admin.userId + '?access_token=' + ownerAccessToken)
                .expect(401, done);
            });
        });
    });

    it('should allow access myown user', function(done) {
      json('get', '/api/users/' + owner.userId + '?access_token=' + ownerAccessToken)
        .expect(200, function(err, res){
          var user = res.body;
          user.status = 'test';
          json('put', '/api/users/' + owner.userId + '?access_token=' + ownerAccessToken)
            .send(user)
            .expect(200, function(err, res){
              json('get', '/api/users/' + owner.userId + '?access_token=' + ownerAccessToken)
                .expect(200, function(err, res){
                  assert.equal(res.body.status, user.status);
                  done();
                });
            });
        });
    });

    it('should allow admin access other user', function(done) {
      json('get', '/api/users/' + owner.userId + '?access_token=' + adminAccessToken)
        .expect(200, function(err, res){
          var user = res.body;
          user.status = 'test';
          json('put', '/api/users/' + owner.userId + '?access_token=' + adminAccessToken)
            .send(user)
            .expect(200, function(err, res){
              json('get', '/api/users/' + owner.userId + '?access_token=' + adminAccessToken)
                .expect(200, function(err, res){
                  assert.equal(res.body.status, user.status);
                  done();
                });
            });
        });
    });

    it('should allow delete myown user', function(done) {
      json('delete', '/api/users/' + owner.userId + '?access_token=' + ownerAccessToken)
        .expect(200, function(err, res){
          json('get', '/api/users/' + owner.userId + '?access_token=' + ownerAccessToken)
            .expect(404, done);
        });
    });

    it('should allow admin delete any user', function(done) {
      json('delete', '/api/users/' + member.userId + '?access_token=' + adminAccessToken)
        .expect(200, function(err, res){
          json('get', '/api/users/' + member.userId + '?access_token=' + adminAccessToken)
            .expect(404, done);
        });
    });

    it('should allow admin delete non-exist user', function(done) {
      json('delete', '/api/users/' + '100' + '?access_token=' + adminAccessToken)
        .expect(200, function(err, res){
          json('get', '/api/users/' + '100' + '?access_token=' + adminAccessToken)
            .expect(404, done);
        });
    });

  });

  describe('User login API', function(){
    var validCredentialsEmail = 'foo@bar.com';
    var validCredentials = {email: validCredentialsEmail, password: 'bar'};
    var validCredentialsEmailVerified = {email: 'foo1@bar.com', password: 'bar1', emailVerified: true};
    var validCredentialsEmailVerifiedOverREST = {email: 'foo2@bar.com', password: 'bar2', emailVerified: true};
    var validCredentialsWithTTL = {email: 'foo@bar.com', password: 'bar', ttl: 3600};
    var validMixedCaseEmailCredentials = {email: 'Foo@bar.com', password: 'bar'};
    var invalidCredentials = {email: 'foo1@bar.com', password: 'invalid'};
    var incompleteCredentials = {password: 'bar1'};

    beforeEach(function(done) {
      User.create(validCredentials, function(err, user) {
        User.create(validCredentialsEmailVerified, done);
      });
    });

    afterEach(function(done) {
      User.find({}, function(err,users){
        users.forEach(function(user){
          User.destroyById(user.id);
        });
        User.accessToken.destroyAll(done);
      });
    });

    it('Login a user over REST by providing credentials', function(done) {
      json('post', '/api/users/login')
        .expect('Content-Type', /json/)
        .expect(200)
        .send(validCredentials)
        .end(function(err, res) {
          if (err) {
            console.log(res.body);
            return done(err);
          }
          var accessToken = res.body;

          assert(accessToken.userId);
          assert(accessToken.id);
          assert.equal(accessToken.id.length, 64);
          
          done();
        });
    });

    it('Login a user over REST by providing invalid credentials', function(done) {
      json('post', '/api/users/login')
        .expect('Content-Type', /json/)
        .expect(401)
        .send(invalidCredentials)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          var errorResponse = res.body.error;
          assert.equal(errorResponse.code, 'LOGIN_FAILED');
          done();
        });
    });

    it('Login a user over REST by providing incomplete credentials', function(done) {
      json('post', '/api/users/login')
        .expect('Content-Type', /json/)
        .expect(401)
        .send(incompleteCredentials)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          var errorResponse = res.body.error;
          assert.equal(errorResponse.code, 'LOGIN_FAILED');
          done();
        });
    });

    it('Login a user over REST with the wrong Content-Type', function(done) {
      json('post', '/api/users/login')
        .set('Content-Type', null)
        .expect('Content-Type', /json/)
        .expect(401)
        .send(JSON.stringify(validCredentials))
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          var errorResponse = res.body.error;
          assert.equal(errorResponse.code, 'LOGIN_FAILED');
          done();
        });
    });

    it('Returns current user when `include` is `USER`', function(done) {
      json('post', '/api/users/login?include=USER')
        .send(validCredentials)
        .expect(200)
        .expect('Content-Type', /json/)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          var token = res.body;
          expect(token.user, 'body.user').to.not.equal(undefined);
          expect(token.user, 'body.user')
            .to.have.property('email', validCredentials.email);
          done();
        });
    });

    it('Login a user by providing credentials with TTL', function(done) {
      json('post', '/api/users/login')
        .set('Content-Type', null)
        .expect('Content-Type', /json/)
        .expect(200)
        .send(validCredentialsWithTTL)
        .end(function(err, res) {
          if (err) {
            return done(err);
          }
          var accessToken = res.body;
          assert.equal(accessToken.ttl, validCredentialsWithTTL.ttl);
          done();
        });
    });

  });

  describe('User logout REST API', function() {
    var validCredentialsEmail = 'foo@bar.com';
    var validCredentials = {email: validCredentialsEmail, password: 'bar'};
    
    beforeEach(function(done) {
      User.create(validCredentials, done);
    });

    afterEach(function(done) {
      User.destroyAll(function(err) {
        User.accessToken.destroyAll(done);
      });
      /*User.find({}, function(err,users){
        users.forEach(function(user){
          User.destroyById(user.id);
        });
        User.accessToken.destroyAll(done);
      });*/
    });

    it('Logout a user by providing the current accessToken id (over rest)', function(done) {
      login(logout);
      function login(fn) {
        json('post', '/api/users/login') 
          .expect('Content-Type', /json/)
          .expect(200)
          .send({email: 'foo@bar.com', password: 'bar'})
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            var accessToken = res.body;

            assert(accessToken.userId);
            assert(accessToken.id);

            fn(null, accessToken.id);
          });
      }

      function logout(err, token) {
        json('post', '/api/users/logout')
          .set('Authorization', token)
          .expect(204)
          .end(verify(token, done));
      }
    });

    function verify(token, done) {
      assert(token);

      return function(err) {
        if (err) {
          return done(err);
        }

        AccessToken.findById(token, function(err, accessToken) {
          assert(!accessToken, 'accessToken should not exist after logging out');
          done(err);
        });
      };
    }
  });

  /*describe('Password Reset', function() {
    describe('User.resetPassword(options, cb)', function() {
      var email = 'foo@bar.com';
      var validCredentialsEmail = 'foo@bar.com';
      var validCredentials = {email: validCredentialsEmail, password: 'bar'};
    
      beforeEach(function(done) {
        User.create(validCredentials, done);
      });

      afterEach(function(done) {
        User.find({}, function(err,users){
          users.forEach(function(user){
            User.destroyById(user.id);
          });
          User.accessToken.destroyAll(done);
        });
      });

      it('Password reset over REST rejected without email address', function(done) {
        request(app)
          .post('/api/users/reset')
          .expect('Content-Type', /json/)
          .expect(400)
          .send({ })
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            var errorResponse = res.body.error;
            assert(errorResponse);
            assert.equal(errorResponse.code, 'EMAIL_REQUIRED');
            done();
          });
      });

      it('Password reset over REST requires email address', function(done) {
        request(app)
          .post('/api/users/reset')
          .expect('Content-Type', /json/)
          .expect(204)
          .send({ email: email })
          .end(function(err, res) {
            if (err) {
              return done(err);
            }
            
            done();
          });
      });
    });
  });*/

  describe('User and project', function() {
    function loginPromise(credentials){
      return Q.promise(function(resolve, reject) {
        json('post', '/api/users/login')
        .send(credentials)
        .expect(200, function(err, res) {
          if (err) {
            reject(err);
            return;
          }
          assert(typeof res.body === 'object');
          assert(res.body.id, 'must have an access token');
          resolve(res.body);
        });
      });
    }

    var adminUserId, chjOwnerAccessToken, chjOwnerUserId, chjStaffAccessToken, chjStaffUserId;
    before(function(done) {
      this.timeout(5000);
      testDataSetup(function(err){
        var adminCredential = {username:'Admin', password:'password'};
        var chjOwner = {username:'chj_owner', password:'password'};
        var chjStaff = {username:'chj_staff', password:'password'};
        Q.all([loginPromise(adminCredential), loginPromise(chjOwner), loginPromise(chjStaff)])
        .then(function(values){
          adminAccessToken = values[0].id;
          adminUserId = values[0].userId;
          chjOwnerAccessToken = values[1].id;
          chjOwnerUserId = values[1].userId;
          chjStaffAccessToken = values[2].id;
          chjStaffUserId = values[2].userId;
          done();
        }).catch(function(err){
          done(err);
        });

      });
    });

    it.skip('Should get projects of owner', function(done){
      var accessToken = chjOwnerAccessToken;
      json('get', '/api/users/' + chjOwnerUserId + '/projectList?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        assert(res.body.length > 1);
        done();
      });

    });

    it.skip('Should not get projects of staff by owner', function(done){
      var accessToken = chjOwnerAccessToken;
      json('get', '/api/users/' + chjStaffUserId + '/projectList?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        done();
      });

    });
    
    it.skip('Should get projects of staff', function(done){
      var accessToken = chjStaffAccessToken;
      json('get', '/api/users/' + chjStaffUserId + '/projectList?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        assert(res.body.length > 0);
        done();
      });

    });


    it('Should get project permissions of owner', function(done){
      var accessToken = chjOwnerAccessToken;
      json('get', '/api/users/' + chjOwnerUserId + '/projectPermissions?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) { 
          console.log(res.body);
          return done(err); 
        }
        console.log(res.body);
        assert(res.body.length > 0);
        done();
      });

    });

    it('Should not get project permissions of staff by owner', function(done){
      var accessToken = chjOwnerAccessToken;
      json('get', '/api/users/' + chjStaffUserId + '/projectPermissions?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        done();
      });

    });
    
    it('Should get project permissions of staff', function(done){
      var accessToken = chjStaffAccessToken;
      json('get', '/api/users/' + chjStaffUserId + '/projectPermissions?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        assert(res.body.length > 0);
        done();
      });

    });

    it('should allow owner get all accounts include its sub account', function(done){
      var accessToken = chjOwnerAccessToken;
      json('get', '/api/users/' + chjOwnerUserId + '/accountList?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        console.log(res.body);
        assert(res.body.length > 1);
        done();
      });

    });

    it('should allow staff get accounts without sub accounts', function(done){
      var accessToken = chjStaffAccessToken;
      json('get', '/api/users/' + chjStaffUserId + '/accountList?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        console.log(res.body);
        assert(res.body.length == 1);
        done();
      });

    });

    it('should not allow staff get accounts of owner', function(done){
      var accessToken = chjStaffAccessToken;
      json('get', '/api/users/' + chjOwnerUserId + '/accountList?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        done();
      });

    });

  });
  
  

});

