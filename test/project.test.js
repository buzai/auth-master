/* jshint camelcase: false */
var app = require('../server/server');
var request = require('supertest');
var assert = require('assert');
//var expect = require('chai').expect;
var should = require('should');
var loopback = require('loopback');
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

function json(verb, url) {
  return request(app)[verb](url)
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/);
}

function clearUsers(done) {
  /*User.destroyAll(function(err) {
      User.accessToken.destroyAll(function(err){
        Role.destroyAll(done);
      });
    });*/
  User.find({}, function(err, users) {
    users.forEach(function(user) {
      User.destroyById(user.id);
    });
    User.accessToken.destroyAll(function(err) {
      Role.destroyAll(done);
    });
  });
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



describe('Projects REST API ', function() {
  before(function(done) {
    clearUsers(done);
  });

  before(function(done) {
    initUsers(done);
  });

 
  var projectData = { name: 'projectname', description: 'description'};
  var projectDataNew = { name: 'projectname-new'};
  var acctData = { name: 'accountname', ownerId: owner.userId};
  var acctOther = { name: 'accountname-other'};

  beforeEach(function(done){
    json('post', '/api/accounts' + '?access_token=' + adminAccessToken)
      .send(acctData)
      .expect(200)
      .end(function(err, res){
        if (err) {
          console.log(res.body);
          return done(err);
        }
        acctData.id = res.body.id;
        //assign the account to owner
        json('put', '/api/accounts/' + acctData.id + '/members/rel/' + owner.userId + '?access_token=' + adminAccessToken)
          .send({
            ownership:1
          })
          .expect(200, function(err, res){
            if (err) return done(err);
            json('post', '/api/accounts' + '?access_token=' + adminAccessToken)
              .send(acctOther)
              .expect(200, function(err, res){
                if (err) return done(err);
                acctOther.id = res.body.id;
                json('put', '/api/accounts/' + acctData.id + '/members/rel/' + member.userId + '?access_token=' + adminAccessToken)
                  .send({
                    ownership:0
                  })
                  .expect(200, function(err, res){
                    if (err) return done(err);
                    delete projectData.id;
                    json('post', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + adminAccessToken)
                      .send(projectData)
                      .expect(200, function(err, res){
                        if (err) return done(err);
                        projectData.id = res.body.id;
                        done();
                      });
                  });
              });
          });
      });
  });

  afterEach(function(done){
    json('delete', '/api/accounts/' + acctData.id + '?access_token=' + adminAccessToken)
      .expect(200)
      .end(function(err, res){
        if (err) {
          console.log(res.body);
          return done(err);
        }
        json('delete', '/api/accounts/' + acctOther.id + '?access_token=' + adminAccessToken)
          .expect(200, done);
          // assume projects will be removed while its owner is deleted.
      });
  });

  describe('get api/projects', function() {
    it('should not allow access without access token', function(done) {
      json('get', '/api/projects')
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow access with wrong access token', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('get', '/api/projects' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow access by non-admin', function(done) {
      var accessToken = ownerAccessToken;
      json('get', '/api/projects' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should allow access by admin', function(done) {
      var accessToken = adminAccessToken;
      json('get', '/api/projects' + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          console.log(res.body);
          json('get', '/api/accounts' + '?access_token=' + adminAccessToken)
            .expect(200)
            .end(done);
        });
    });
  });

  describe('api/projects/{id}', function() {
    it('should not allow access without access token', function(done) {
      json('get', '/api/projects/' + projectData.id)
        .expect(401, function(err, res){
          if (err) return done(err);
          json('delete', '/api/projects/' + projectData.id)
            .expect(401, done);
        });
    });

    it('should not allow access with wrong access token', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('get', '/api/projects/' + projectData.id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          json('delete', '/api/projects/' + projectData.id + '?access_token=' + accessToken)
            .expect(401, done);
        });
    });

    it('should not allow access by other non-admin', function(done) {
      var accessToken = memberAccessToken;
      json('get', '/api/projects/' + projectData.id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          json('delete', '/api/projects/' + projectData.id + '?access_token=' + accessToken)
            .expect(401, done);
        });
    });

    it('should allow access(get) by owner, not delete', function(done) {
      var accessToken = ownerAccessToken;
      json('get', '/api/projects/' + projectData.id + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          json('delete', '/api/projects/' + projectData.id + '?access_token=' + accessToken)
            .expect(401, done);
        });
    });

    it('should allow access(get/delete) by admin', function(done) {
      var accessToken = adminAccessToken;
      json('get', '/api/projects/' + projectData.id + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          json('delete', '/api/projects/' + projectData.id + '?access_token=' + accessToken)
            .expect(200, done);
        });
    });

  });

  describe('api/projects/{id}/accounts', function() {
    it('should not allow access without access token', function(done) {
      json('get', '/api/projects/' + projectData.id + '/accounts')
        .expect(401, done);
    });

    it('should not allow access with wrong access token', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('get', '/api/projects/' + projectData.id + '/accounts' + '?access_token=' + accessToken)
        .expect(401, done);
    });

    it('should not allow access by other non-admin', function(done) {
      var accessToken = memberAccessToken;
      json('get', '/api/projects/' + projectData.id + '/accounts' + '?access_token=' + accessToken)
        .expect(401, done);
    });

    it('should allow access(get) by owner', function(done) {
      var accessToken = ownerAccessToken;
      json('get', '/api/projects/' + projectData.id + '/accounts' + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should allow access(get) by admin', function(done) {
      var accessToken = adminAccessToken;
      json('get', '/api/projects/' + projectData.id + '/accounts' + '?access_token=' + accessToken)
        .expect(200, done);
    });
  });

  describe('api/projects/{id}/operators/*', function() {
    it('should not allow access without access token', function(done) {
      json('get', '/api/projects/' + projectData.id + '/operators')
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow access with wrong access token', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('get', '/api/projects/' + projectData.id + '/operators' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow access by other non-admin', function(done) {
      var accessToken = memberAccessToken;
      json('get', '/api/projects/' + projectData.id + '/operators' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

  });

  describe('api/projects/{id}/permissions/rel/{fk}', function() {
    it('should not allow access without access token', function(done) {
      json('put', '/api/projects/' + projectData.id + '/permissions/rel/' + member.userId)
        .expect(401, function(err, res){
          if (err) return done(err);
          json('delete', '/api/projects/' + projectData.id + '/permissions/rel/' + owner.userId)
            .expect(401, function(err, res){
              if (err) return done(err);
              done();
            });
        });
    });

    it('should not allow access with wrong access token', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('put', '/api/projects/' + projectData.id + '/permissions/rel/' + member.userId + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          json('delete', '/api/projects/' + projectData.id + '/permissions/rel/' + owner.userId + '?access_token=' + accessToken)
            .expect(401, function(err, res){
              if (err) return done(err);
              done();
            });
        });
    });

    it('should not allow access by other non-admin, not an owner', function(done) {
      var accessToken = memberAccessToken;
      json('put', '/api/projects/' + projectData.id + '/permissions/rel/' + member.userId + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          json('delete', '/api/projects/' + projectData.id + '/permissions/rel/' + owner.userId + '?access_token=' + accessToken)
            .expect(401, function(err, res){
              if (err) return done(err);
              done();
            });
        });
    });

    it('should allow access(put) by owner', function(done) {
      var accessToken = ownerAccessToken;
      json('put', '/api/projects/' + projectData.id + '/permissions/rel/' + member.userId + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should allow access(get projects/id/permissions ) by owner', function(done) {
      var accessToken = ownerAccessToken;
      json('put', '/api/projects/' + projectData.id + '/permissions/rel/' + member.userId + '?access_token=' + accessToken)
        .send({permission:{}})
        .expect(200, function(err, res){
          if(err) {
            console.log(res.body);
            return done(err);
          }
          json('get', '/api/projects/' + projectData.id + '/permissions' + '?access_token=' + accessToken)
            .expect(200, function(err, res){
              if (err) { 
                console.log(res.body);
                return done(err);
              }
              done();
            });
        });
    });

    it('should allow delete by owner', function(done) {
      var accessToken = ownerAccessToken;
      json('put', '/api/projects/' + projectData.id + '/permissions/rel/' + member.userId + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          json('delete', '/api/projects/' + projectData.id + '/permissions/rel/' + member.userId + '?access_token=' + accessToken)
            .expect(204, function(err, res){
              if (err) return done(err);
              done();
            });
        });
    });

    it('should allow access(get projects/id/permissions ) by admin', function(done) {
      var accessToken = adminAccessToken;
      json('put', '/api/projects/' + projectData.id + '/permissions/rel/' + member.userId + '?access_token=' + accessToken)
        .send({permission:{}})
        .expect(200, function(err, res){
          json('get', '/api/projects/' + projectData.id + '/permissions' + '?access_token=' + accessToken)
            .expect(200, function(err, res){
              if (err) return done(err);
              var users = res.body;
              assert(users.length>0);
              json('get', '/api/projects/' + projectData.id + '/permissions/' + users[0].id + '?access_token=' + accessToken)
                .expect(200, function(err, res){
                  if (err) return done(err);
                  done();
                });
            });
        });
    });


    it('should allow access by admin', function(done) {
      var accessToken = adminAccessToken;
      json('put', '/api/projects/' + projectData.id + '/permissions/rel/' + member.userId + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          json('delete', '/api/projects/' + projectData.id + '/permissions/rel/' + member.userId + '?access_token=' + accessToken)
            .expect(204, function(err, res){
              if (err) return done(err);
              done();
            });
        });
    });
  });


});