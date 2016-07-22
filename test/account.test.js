/* jshint camelcase: false */
var app = require('../server/server');
var Q = require('q');
var request = require('supertest');
var assert = require('assert');
var should = require('should');
var loopback = require('loopback');

var AccessToken = app.models.AccessToken;
var User;
var Role;
var RoleMapping;

var adminAccessToken;
var ownerAccessToken;
var memberAccessToken;

var people = {
  karl: { username: 'karl', email: 'karl@doa.com', password: 'password'},
  chj_owner: { username: 'chj_owner', email: 'chj_owner@doa.com', password: 'password'},
  chj_staff: { username: 'chj_staff', email: 'chj_staff@doa.com', password: 'password'},
  hsa_owner: { username: 'hsa_owner', email: 'hsa_owner@doa.com', password: 'password'},
  hsa_staff: { username: 'hsa_staff', email: 'hsa_staff@doa.com', password: 'password'},
  shoe_owner: { username: 'shoe_owner', email: 'shoe_owner@doa.com', password: 'password'},
  shoe_staff: { username: 'shoe_staff', email: 'shoe_staff@doa.com', password: 'password'}
};

var projectsData = [
  { name: 'project1'},
   { name: 'project2'}
];

var accountTestData = {
  chj: {name:'chj'},
  hsa: {name:'hsa'},
  shoe: {name:'shoe'}
};

var admin =  { username: 'Admin', email: 'Admin@doa.com', password: 'password'};
var member = { username: 'member', email: 'member@doa.com', password: 'password'};

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
  User.destroyAll(function(err) {
      User.accessToken.destroyAll(function(err){
        Role.destroyAll(done);
      });
    });
}

var rootAcct;
function initRootAccount(done) {
  var Account = app.models.account;
  Account.create({name:'root', parentId:0}, function(err, root){
    rootAcct = root;
    initAdmin(done, root);
  });
}

function initAdmin(done, acct) {
  acct.users.create(admin, function(err, user) {
    console.log(err, user);
    //create the admin role
    acct.roles.create({
      name: 'admin'
    }, function(err, role) {
      if (err) throw err;
      //make Admin an admin
      role.principals.create({
        principalType: RoleMapping.USER,
        principalId: user.id
      }, function(err, principal) {
        if (err) throw err;

        json('post', '/api/users/login')
          .send({
            username: 'Admin',
            password: 'password'
          })
          .expect(200, function(err, res) {
            if (err) return done(err);
            assert(typeof res.body === 'object');
            assert(res.body.id, 'must have an access token');
            adminAccessToken = res.body.id;
            admin.userId = res.body.userId;
            done();
          });
      });
    });
  });
}


function initUsers(userData, done) {
  console.log('init users');
}
before(function(done) {
  clearUsers(done);
});

before(function(done) {
  initRootAccount(done);
});

after(function(done){
  testAccountTearDown(rootAcct)
    .then(function(res){done();}, done);
});

function testAccountSetup(acctData, ownerData, staffData, parentAcctId){
  var deferred = Q.defer();
  if (!parentAcctId) {
    parentAcctId = rootAcct.id;
  }
  json('post', '/api/accounts/'+ parentAcctId + '/subs' + '?access_token=' + adminAccessToken)
    .send(acctData)
    .expect(200, function(err, res){
      if (err) {
        console.log(res.body);
        return deferred.reject(err);
      }
      acctData.id = res.body.id;
      Q.allSettled([setupStaff(), setupOwner()]).then(function (values) {
        var rejected = null;
        
        values.forEach(function(p){
          if (p.state !== 'fulfilled') {
            rejected = p;
          }
        });

        if (rejected) {
          deferred.reject(rejected.reason);
        } else {
          deferred.resolve();
        }
      });
    });
  
  return deferred.promise;

    function setupStaff(){
      var deferred = Q.defer();
      json('post', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + adminAccessToken)
        .send(staffData)
        .expect(200, function(err, res) {
          if (err) {
            console.log(res.body);
            return deferred.reject(err);
          }
          staffData.id = res.body.id;
          json('put', '/api/accounts/' + acctData.id + '/members/rel/' + staffData.id + '?access_token=' + adminAccessToken)
            .send({ownership:2})
            .expect(200, function(err, res){
              if (err) return deferred.reject(err);
              //deferred.resolve(res.body);
              json('post', '/api/users/login')
                .send({
                  username: staffData.username,
                  password: staffData.password
                })
                .expect(200, function(err, res) {
                  if (err) {
                    console.log(res.body);
                    return deferred.reject(err);
                  }
                  assert(typeof res.body === 'object');
                  assert(res.body.id, 'must have an access token');
                  staffData.userId = staffData.id = res.body.userId;
                  staffData.accessToken = res.body.id;
                  deferred.resolve(res.body);
                });
            });
        });

      return deferred.promise;
    }

    function setupOwner(){
      var deferred = Q.defer();
      json('post', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + adminAccessToken)
        .send(ownerData)
        .expect(200, function(err, res){
          if (err) {
            console.log(res.body);
            return deferred.reject(err);
          }
          ownerData.id = res.body.id;
          json('put', '/api/accounts/' + acctData.id + '/members/rel/' + ownerData.id + '?access_token=' + adminAccessToken)
            .send({ownership:1})
            .expect(200, function(err, res){
              if (err) return deferred.reject(err);
              //deferred.resolve(res.body);
              json('post', '/api/users/login')
                .send({
                  username: ownerData.username,
                  password: ownerData.password
                })
                .expect(200, function(err, res) {
                  if (err) {
                    console.log(res.body);
                    return deferred.reject(err);
                  }
                  assert(typeof res.body === 'object');
                  assert(res.body.id, 'must have an access token');
                  ownerData.userId = ownerData.id = res.body.userId;
                  ownerData.accessToken = res.body.id;
                  deferred.resolve(res.body);
                });
            });
        });
      return deferred.promise;
    }
}

function setupProjects(acctData, projectData){
  var accessToken = adminAccessToken;
  var deferred = Q.defer();
  json('post', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
    .send(projectData)
    .expect(200, function(err, res){
      if (err) {
        console.log('setupProjects:', res.body);
        return deferred.reject(err);
      }
      projectData.id = res.body.id;
      deferred.resolve(res.body);
    });
  return deferred.promise;
}

function removeProjects(acctData){
  var accessToken = adminAccessToken;
  var deferred = Q.defer();
  json('delete', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
    .expect(204, function(err, res){
      if (err) {
        console.log('removeProjects:', res.body);
        return deferred.reject(err);
      }
      deferred.resolve();
    });
  return deferred.promise;
}

function testChjAccountSetup(done){
  var p = testAccountSetup(accountTestData.chj, people.chj_owner, people.chj_staff);

  p.then(function(res){
    done(res);
  }, function(err){
    done(err);
  });  
}

function testShoeAccountSetup(done){
  var p = testAccountSetup(accountTestData.shoe, people.shoe_owner, people.shoe_staff);
  
  p.then(function(res){
    done(res);
  }, function(err){
    done(err);
  });  
}

function testAccountTearDown(acct){
  var accessToken = adminAccessToken;
  var deferred = Q.defer();
  removeUsers().then(function(ok){
    json('delete', '/api/accounts/' + acct.id + '?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) {
          console.log(res.body);
          return deferred.reject(err);
        }
        return deferred.resolve(res.body);
      });
  }, function(err){
    return deferred.resolve(err);
  });
  
  return deferred.promise;

  function removeUsers() {
    var deferred = Q.defer();
    json('get', '/api/accounts/' + acct.id + '/users' +'?access_token=' + accessToken)
      .expect(200, function(err, res){
        var users = res.body;
        var count = 0;
        if (err) {
          console.log(res.body);
          return deferred.reject(err);
        }
        if (count == users.length) { // in case that users.length == 0
          deferred.resolve();
        }
        users.forEach(function(user) {
          json('delete', '/api/users/' + user.id +'?access_token=' + accessToken)
            .expect(200, function(err, res){
              if (err) {
                console.log(res.body);
                return deferred.reject(err);
              }
              count++;
              if (count == users.length) {
                deferred.resolve();
              }
            });
        });
      });
    return deferred.promise;
  }
}

function shoeAccountTearDown(done){
  testAccountTearDown(accountTestData.shoe)
    .then(function(res){done();}, done);
}

describe('api/accounts', function() {
  var acctData = { name: 'accountname'};
  var acctDataNew = { name: 'accountname-new'};

  it('should allow access by admin', function(done) {
    var accessToken = adminAccessToken;
    json('post', '/api/accounts' + '?access_token=' + accessToken)
      .send(acctData)
      .expect(200)
      .end(function(err, res){
        if (err) return done(err);
        var acct = res.body;
        assert.equal(acct.name, acctData.name);
        json('get', '/api/accounts' + '?access_token=' + accessToken)
          .expect(200)
          .end(function(err, res){
            if (err) return done(err);
            json('put', '/api/accounts' + '?access_token=' + accessToken)
              .send(acctDataNew)
              .expect(200)
              .end(done);
          });
      });
  });

  it('should not allow access without access token', function(done) {
    json('post', '/api/accounts')
      .send(acctData)
      .expect(401, function(err, res){
        if (err) return done(err);
        json('get', '/api/accounts')
          .expect(401, function(err, res){
            if (err) return done(err);
            json('put', '/api/accounts')
              .send(acctDataNew)
              .expect(401, function(err, res){
                if (err) return done(err);
                done();
              });
          });
      });
  });

  it('should not allow access with wrong access token', function(done) {
    var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
    json('post', '/api/accounts' + '?access_token=' + accessToken)
      .send(acctData)
      .expect(401)
      .end(function(err, res){
        if (err) return done(err);
        json('get', '/api/accounts' + '?access_token=' + accessToken)
          .expect(401)
          .end(function(err, res){
            if (err) return done(err);
            json('put', '/api/accounts' + '?access_token=' + accessToken)
              .send(acctDataNew)
              .expect(401)
              .end(done);
          });
      });
  });

  it('should not allow access by non-admin', function(done) {
    var accessToken = ownerAccessToken;
    json('post', '/api/accounts' + '?access_token=' + accessToken)
      .send(acctData)
      .expect(401)
      .end(function(err, res){
        if (err) return done(err);
        json('get', '/api/accounts' + '?access_token=' + accessToken)
          .expect(401)
          .end(function(err, res){
            if (err) return done(err);
            json('put', '/api/accounts' + '?access_token=' + accessToken)
              .send(acctDataNew)
              .expect(401)
              .end(done);
          });
      });
  });

  
});


describe('api/accounts/{id}', function() {
  var acctDataNew = { name: 'accountname-new'};
  beforeEach(function(done){
    testShoeAccountSetup(done);
  });

  afterEach(function(done){
    shoeAccountTearDown(done);
  });

  it('should not allow access without access token', function(done) {
    json('get', '/api/accounts/' + accountTestData.shoe.id)
      .expect(401, function(err, res){
        if (err) return done(err);
        json('put', '/api/accounts/' + accountTestData.shoe.id)
          .send(acctDataNew)
          .expect(401, function(err, res){
            if (err) return done(err);
            json('delete', '/api/accounts/' + accountTestData.shoe.id)
              .expect(401, done);
          });
      });
  });

  it('should not allow access with wrong access token', function(done) {
    var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
    json('get', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        acctDataNew.name = 'somenew';
        json('put', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
          .send(acctDataNew)
          .expect(401, function(err, res){
            if (err) return done(err);
            json('delete', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
              .expect(401, done);
          });
      });
  });

  it('should not allow access by other non-admin', function(done) {
    var accessToken = people.shoe_staff.accessToken;
    json('get', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        json('put', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
          .send(acctDataNew)
          .expect(401, function(err, res){
            if (err) return done(err);
            json('delete', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
              .expect(401, done);
          });
      });
  });

  it('should allow access(update/get) by owner', function(done) {
    var accessToken = people.shoe_owner.accessToken;
    json('get', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) {
          return done(err);
        }
        json('put', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
          .send(acctDataNew)
          .expect(200, function(err, res){
            if (err) {
              return done(err);
            }
            done();
          });
      });
  });

  it('should not allow owner delete account', function(done) {
    var accessToken = people.shoe_owner.accessToken;
    json('delete', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
      .expect(401, done);
  });

  it('should allow access(get/put) by admin', function(done) {
    var accessToken = adminAccessToken;
    json('get', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        json('put', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
          .send(acctDataNew)
          .expect(200, function(err, res){
            if (err) return done(err);
            done();
          });
      });
  });

  it('should allow admin delete account', function(done) {
    //var accessToken = adminAccessToken;
    //json('delete', '/api/accounts/' + accountTestData.shoe.id + '?access_token=' + accessToken)
    //  .expect(200, done);
    //just check the after hook
    done();
  });
});

describe('api/accounts/{id}/members/*', function() {
  var acctDataNew = { name: 'accountname-new', parentId: 0};
  var acctData = accountTestData.shoe;

  beforeEach(function(done){
    testShoeAccountSetup(done);
  });

  afterEach(function(done){
    shoeAccountTearDown(done);
  });


  it('should not allow access without access token', function(done) {
    json('get', '/api/accounts/' + acctData.id + '/members')
      .expect(401, function(err, res){
        if (err) return done(err);
        done();
      });
  });

  it('should not allow access with wrong access token', function(done) {
    var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
    json('get', '/api/accounts/' + acctData.id + '/members' + '?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        done();
      });
  });

  it('should not allow access by other non-admin', function(done) {
    var accessToken = people.shoe_staff.accessToken;
    json('get', '/api/accounts/' + acctData.id + '/members' + '?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        done();
      });
  });

  it('should allow access(get) by owner', function(done) {
    var accessToken = people.shoe_owner.accessToken;
    json('get', '/api/accounts/' + acctData.id + '/members' + '?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        var users = res.body;
        assert(users.length>0);
        json('get', '/api/accounts/' + acctData.id + '/members/' + users[0].id + '?access_token=' + accessToken)
          .expect(200, function(err, res){
            if (err) return done(err);
            done();
          });
      });
  });


  it('should allow access by admin', function(done) {
    var accessToken = adminAccessToken;
    json('get', '/api/accounts/' + acctData.id + '/members' + '?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        var users = res.body;
        assert(users.length>0);
        json('get', '/api/accounts/' + acctData.id + '/members/' + users[0].id + '?access_token=' + accessToken)
          .expect(200, function(err, res){
            if (err) return done(err);
            var user = res.body;
            assert.equal(user.id, users[0].id); 
            done();
          });
      });
  });
});

describe('api/accounts/{id}/members/rel/{fk}', function() {
  var acctDataNew = { name: 'accountname-new', parentId: 0};
  var acctData = accountTestData.shoe;
  var shoeStaffSecond = { username: 'shoe_staff_send', email: 'shoe_staff_send@doa.com', password: 'password'};

  beforeEach(function(done){
    var p = testAccountSetup(accountTestData.shoe, people.shoe_owner, people.shoe_staff);
  
    p.then(function(res){

      json('post', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + adminAccessToken)
        .send(shoeStaffSecond)
        .expect(200, function(err, res) {
          if (err) {
            console.log(err);
            return done(err);
          }
          shoeStaffSecond.id = res.body.id;
          done();
        });

    }, function(err){
      done(err);
    });
  });

  afterEach(function(done){
    shoeAccountTearDown(done);
  });

  it('should not allow access without access token', function(done) {
    json('put', '/api/accounts/' + acctData.id + '/members/rel/' + shoeStaffSecond.id)
      .expect(401, function(err, res){
        if (err) return done(err);
        json('delete', '/api/accounts/' + acctData.id + '/members/rel/' + shoeStaffSecond.id)
          .expect(401, function(err, res){
            if (err) return done(err);
            done();
          });
      });
  });

  it('should not allow access with wrong access token', function(done) {
    var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
    json('put', '/api/accounts/' + acctData.id + '/members/rel/' + shoeStaffSecond.id + '?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        json('delete', '/api/accounts/' + acctData.id + '/members/rel/' + shoeStaffSecond.id + '?access_token=' + accessToken)
          .expect(401, function(err, res){
            if (err) return done(err);
            done();
          });
      });
  });

  it('should not allow access by other non-admin, not an owner', function(done) {
    var accessToken = people.shoe_staff.accessToken;
    json('put', '/api/accounts/' + acctData.id + '/members/rel/' + shoeStaffSecond.id + '?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        json('delete', '/api/accounts/' + acctData.id + '/members/rel/' + shoeStaffSecond.id + '?access_token=' + accessToken)
          .expect(401, function(err, res){
            if (err) return done(err);
            done();
          });
      });
  });

  it('should allow access(get) by owner', function(done) {
    var accessToken = people.shoe_owner.accessToken;
    json('put', '/api/accounts/' + acctData.id + '/members/rel/' + shoeStaffSecond.id + '?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        json('delete', '/api/accounts/' + acctData.id + '/members/rel/' + shoeStaffSecond.id + '?access_token=' + accessToken)
          .expect(204, function(err, res){
            if (err) return done(err);
            done();
          });
      });
  });


  it('should allow access by admin', function(done) {
    var accessToken = adminAccessToken;
    json('put', '/api/accounts/' + acctData.id + '/members/rel/' + shoeStaffSecond.id + '?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        json('delete', '/api/accounts/' + acctData.id + '/members/rel/' +shoeStaffSecond.id + '?access_token=' + accessToken)
          .expect(204, function(err, res){
            if (err) return done(err);
            done();
          });
      });
  });
});

describe('api/accounts/{id}/users *', function() {
  var acctDataNew = { name: 'accountname-new', parentId: 0};
  var acctData = accountTestData.shoe;

  beforeEach(function(done){
    testShoeAccountSetup(done);
  });

  afterEach(function(done){
    shoeAccountTearDown(done);
  });

  describe('without access token', function(){
    it('should not allow get without access token', function(done) {
      json('get', '/api/accounts/' + acctData.id + '/users')
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow delete without access token', function(done) {
      json('delete', '/api/accounts/' + acctData.id + '/users')
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });
  });

  describe('with wrong token', function(){
    var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
    it('should not allow get ', function(done) {
      json('get', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow delete ', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('delete', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow get user by id', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('get', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow update user by id', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('put', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow delete user by id', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('delete', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });
  });

  describe('not an owner and admin', function(){
    var accessToken = people.shoe_staff.accessToken;
    it('should not allow get ', function(done) {
      json('get', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow put ', function(done) {
      var accessToken = people.shoe_staff.accessToken;
      json('delete', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow get user by id', function(done) {
     var accessToken = people.shoe_staff.accessToken;
      json('get', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow update user by id', function(done) {
      var accessToken = people.shoe_staff.accessToken;
      json('put', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow delete user by id', function(done) {
      var accessToken = people.shoe_staff.accessToken;
      json('delete', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });
  });

  describe('for owner', function(){
    it('should allow get ', function(done) {
      var accessToken = people.shoe_owner.accessToken;
      json('get', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) { 
            console.log(acctData.id, accessToken,res.body);
            return done(err);
          }
          done();
        });
    });

    it('should not allow put, no api ', function(done) {
      var accessToken = people.shoe_owner.accessToken;
      json('put', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + accessToken)
        .expect(404, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should allow delete', function(done) {
      var accessToken = people.shoe_owner.accessToken;
      json('delete', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + accessToken)
        .expect(204, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow get user by id', function(done) {
     var accessToken = people.shoe_owner.accessToken;
      json('get', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow update user by id', function(done) {
      var accessToken = people.shoe_owner.accessToken;
      json('put', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .send({username:'newname'})
        .expect(200, function(err, res){
          if (err) return done(err);
          assert.equal('newname', res.body.username);
          done();
        });
    });

    it('should not allow delete user by id', function(done) {
      var accessToken = people.shoe_owner.accessToken;
      json('delete', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .expect(204, function(err, res){
          if (err) return done(err);
          json('get', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
            .expect(404, function(err, res){
              if (err) {
                console.log(res.body);
                return done(err);
              }
              done();
            });
        });
    });

  });

  describe('for admin', function(){
    it('should allow get ', function(done) {
      var accessToken = adminAccessToken;
      json('get', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) { 
            console.log(acctData.id, accessToken,res.body);
            return done(err);
          }
          done();
        });
    });

    it('should not allow put, no api ', function(done) {
      var accessToken = adminAccessToken;
      json('put', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + accessToken)
        .expect(404, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should allow delete', function(done) {
      var accessToken = adminAccessToken;
      json('delete', '/api/accounts/' + acctData.id + '/users' + '?access_token=' + accessToken)
        .expect(204, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow get user by id', function(done) {
     var accessToken = adminAccessToken;
      json('get', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow update user by id', function(done) {
      var accessToken = adminAccessToken;
      json('put', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .send({username:'newname'})
        .expect(200, function(err, res){
          if (err) return done(err);
          assert.equal('newname', res.body.username);
          done();
        });
    });

    it('should not allow delete user by id', function(done) {
      var accessToken = adminAccessToken;
      json('delete', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
        .expect(204, function(err, res){
          if (err) return done(err);
          json('get', '/api/accounts/' + acctData.id + '/users/' + people.shoe_staff.id + '?access_token=' + accessToken)
            .expect(404, function(err, res){
              if (err) {
                console.log(res.body);
                return done(err);
              }
              done();
            });
        });
    });

  });
});
describe('api/accounts/{id}/projects *', function() {
  var acctDataNew = { name: 'accountname-new', parentId: 0};
  var acctData = accountTestData.shoe;

  beforeEach(function(done){
    var p = testAccountSetup(accountTestData.shoe, people.shoe_owner, people.shoe_staff);
  
    p.then(function(res){
      var p2 = setupProjects(accountTestData.shoe, projectsData[0]);

      p2.then(function(res){
        done();
      }, 
        function(err){
          done(err);
        });
    }, function(err){
      done(err);
    });
  });

  afterEach(function(done){
    var p = removeProjects(accountTestData.shoe);
  
    p.then(function(res){
      var p2 = testAccountTearDown(accountTestData.shoe, done);

      p2.then(function(res){
        done();
        }, function(err){
          done(err);
      });
    }, function(err){
      done(err);
    });

  });

  describe('without access token', function(){
    it('should not allow get without access token', function(done) {
      json('get', '/api/accounts/' + acctData.id + '/projects')
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow delete without access token', function(done) {
      json('delete', '/api/accounts/' + acctData.id + '/projects')
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });
  });

  describe('with wrong token', function(){
    var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
    it('should not allow get ', function(done) {
      json('get', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow delete ', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('delete', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow get user by id', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('get', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow update user by id', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('put', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow delete user by id', function(done) {
      var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
      json('delete', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });
  });

  describe('not an owner and admin', function(){
    var accessToken = people.shoe_staff.accessToken;
    it('should not allow get ', function(done) {
      json('get', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow put ', function(done) {
      var accessToken = people.shoe_staff.accessToken;
      json('delete', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow get user by id', function(done) {
     var accessToken = people.shoe_staff.accessToken;
      json('get', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow update user by id', function(done) {
      var accessToken = people.shoe_staff.accessToken;
      json('put', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow delete user by id', function(done) {
      var accessToken = people.shoe_staff.accessToken;
      json('delete', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .expect(401, function(err, res){
          if (err) return done(err);
          done();
        });
    });
  });

  describe('for owner', function(){
    it('should allow get ', function(done) {
      var accessToken = people.shoe_owner.accessToken;
      json('get', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) { 
            console.log(acctData.id, accessToken,res.body);
            return done(err);
          }
          done();
        });
    });

    it('should not allow put, no api ', function(done) {
      var accessToken = people.shoe_owner.accessToken;
      json('put', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
        .expect(404, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should allow delete', function(done) {
      var accessToken = people.shoe_owner.accessToken;
      json('delete', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
        .expect(204, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow get user by id', function(done) {
     var accessToken = people.shoe_owner.accessToken;
      json('get', '/api/accounts/' + acctData.id + '/projects/' +projectsData[0].id + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow update user by id', function(done) {
      var accessToken = people.shoe_owner.accessToken;
      json('put', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .send({name:'newproject-name'})
        .expect(200, function(err, res){
          if (err) return done(err);
          assert.equal('newproject-name', res.body.name);
          done();
        });
    });

    it('should not allow delete user by id', function(done) {
      var accessToken = people.shoe_owner.accessToken;
      json('delete', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .expect(204, function(err, res){
          if (err) return done(err);
          json('get', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
            .expect(404, function(err, res){
              if (err) {
                console.log(res.body);
                return done(err);
              }
              done();
            });
        });
    });

  });

  describe('for admin', function(){
    it('should allow get ', function(done) {
      var accessToken = adminAccessToken;
      json('get', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) { 
            console.log(acctData.id, accessToken,res.body);
            return done(err);
          }
          done();
        });
    });

    it('should not allow put, no api ', function(done) {
      var accessToken = adminAccessToken;
      json('put', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
        .expect(404, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should allow delete', function(done) {
      var accessToken = adminAccessToken;
      json('delete', '/api/accounts/' + acctData.id + '/projects' + '?access_token=' + accessToken)
        .expect(204, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow get user by id', function(done) {
     var accessToken = adminAccessToken;
      json('get', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow update user by id', function(done) {
      var accessToken = adminAccessToken;
      json('put', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .send({name:'newname'})
        .expect(200, function(err, res){
          if (err) return done(err);
          assert.equal('newname', res.body.name);
          done();
        });
    });

    it('should not allow delete user by id', function(done) {
      var accessToken = adminAccessToken;
      json('delete', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
        .expect(204, function(err, res){
          if (err) return done(err);
          json('get', '/api/accounts/' + acctData.id + '/projects/' + projectsData[0].id + '?access_token=' + accessToken)
            .expect(404, function(err, res){
              if (err) {
                console.log(res.body);
                return done(err);
              }
              done();
            });
        });
    });

  });
});

describe('api/accounts/{id}/subs *', function() {
  var acctDataNew = { name: 'accountname-new', parentId: 0};
  var acctData = accountTestData.chj;
  var subAcct = accountTestData.hsa;

  this.timeout(5000);

  beforeEach(function(done){
    var p = testAccountSetup(accountTestData.chj, people.chj_owner, people.chj_staff);
  
    p.then(function(res){
      var p2 = setupProjects(accountTestData.chj, projectsData[0]);

      p2.then(function(res){
        var p3 = testAccountSetup(accountTestData.hsa, people.hsa_owner, people.hsa_staff, accountTestData.chj.id);
        p3.then(function(res) {
          setupProjects(accountTestData.hsa, projectsData[1])
            .then(function(res){done();}, done);
        }, done);
      }, done);
    }, done);
  });

  afterEach(function(done){
    /*var p = removeProjects(accountTestData.shoe);
  
    p.then(function(res){
      var p2 = testAccountTearDown(accountTestData.shoe, done);

      p2.then(function(res){
        done();
        }, function(err){
          done(err);
      });
    }, function(err){
      done(err);
    });*/
    var p2 = testAccountTearDown(accountTestData.chj, done);

    p2.then(function(res){
      done();
      }, function(err){
        done(err);
    });
  });

  describe('for owner-chj', function(){
  
    /*it('should allow get ', function(done) {
      var accessToken = people.chj_owner.accessToken;
      json('get', '/api/accounts/' + acctData.id + '/subs' + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) { 
            console.log(acctData.id, accessToken,res.body);
            return done(err);
          }
          done();
        });
    });

    it('should not allow put, no api ', function(done) {
      var accessToken = people.chj_owner.accessToken;
      json('put', '/api/accounts/' + acctData.id + '/subs' + '?access_token=' + accessToken)
        .expect(404, function(err, res){
          if (err) return done(err);
          done();
        });
    });
*/
    it('should allow delete', function(done) {
      var accessToken = people.chj_owner.accessToken;
      json('delete', '/api/accounts/' + acctData.id + '/subs' + '?access_token=' + accessToken)
        .expect(204, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow get user by id', function(done) {
      var accessToken = people.chj_owner.accessToken;
      json('get', '/api/accounts/' + acctData.id + '/subs/' +subAcct.id + '?access_token=' + accessToken)
        .expect(200, function(err, res){
          if (err) return done(err);
          done();
        });
    });

    it('should not allow update user by id', function(done) {
      var accessToken = people.chj_owner.accessToken;
      json('put', '/api/accounts/' + acctData.id + '/subs/' + subAcct.id + '?access_token=' + accessToken)
        .send({name:'newname'})
        .expect(200, function(err, res){
          if (err) {
            console.log(res.body);
            return done(err);
          }
          assert.equal('newname', res.body.name);
          done();
        });
    });

    it('should not allow delete user by id', function(done) {
      var accessToken = people.chj_owner.accessToken;
      json('delete', '/api/accounts/' + acctData.id + '/subs/' + subAcct.id + '?access_token=' + accessToken)
        .expect(204, function(err, res){
          if (err) return done(err);
          json('get', '/api/accounts/' + acctData.id + '/subs/' + subAcct.id + '?access_token=' + accessToken)
            .expect(404, function(err, res){
              if (err) {
                console.log(res.body);
                return done(err);
              }
              done();
            });
        });
    });

  });

});
/*describe('api/accounts/ownership', function() {
  var acctDataNew = { name: 'accountname-new', parentId: 0};
  var acctData = accountTestData.shoe;

  beforeEach(function(done){
    testShoeAccountSetup(done);
  });

  afterEach(function(done){
    shoeAccountTearDown(done);
  });


  it('should not allow access without access token', function(done) {
    json('get', '/api/accounts/' + acctData.id + '/ownership')
      .expect(401, function(err, res){
        if (err) return done(err);
        done();
      });
  });

  it('should not allow access with wrong access token', function(done) {
    var accessToken = 'ePIJYyQGYBCQ09am3mMgjfBZMFpjXKy0Xke5NHlrOEzWCr5moU0Kst4MyqHVGmLO';
    json('get', '/api/accounts/' + acctData.id + '/ownership' + '?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        done();
      });
  });

  it('should not allow access by other non-admin, not an owner', function(done) {
    var accessToken = people.shoe_staff.accessToken;
    json('get', '/api/accounts/' + acctData.id + '/ownership' + '?access_token=' + accessToken)
      .expect(401, function(err, res){
        if (err) return done(err);
        done();
      });
  });

  it('should allow access(get) by owner', function(done) {
    var accessToken = people.shoe_owner.accessToken;
    json('get', '/api/accounts/' + acctData.id + '/ownership' + '?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        console.log(res.body);
        done();
      });
  });


  it('should allow access by admin', function(done) {
    var accessToken = adminAccessToken;
    json('get', '/api/accounts/' + acctData.id + '/ownership' + '?access_token=' + accessToken)
      .expect(200, function(err, res){
        if (err) return done(err);
        done();
      });

  });
});*/

