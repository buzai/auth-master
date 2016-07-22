var jwt = require('jws');
var async = require('async');
var lazy = require('lazy.js');
var sslCert = require(__SERVERPATH + 'private/ssl_cert');
var speakeasy = require('speakeasy');

var roleModel;
var roleMappingModel;

//var privateKey = '5678';
var privateKey = sslCert.privateKey;
var algorithm = 'RS256';

var tokenTtl = 86400;

module.exports = function(User) {

  User.disableRemoteMethod('__destroyById__projects', false);
  User.disableRemoteMethod('__updateById__projects', false);

  User.disableRemoteMethod('__create__projects', false);
  User.disableRemoteMethod('__update__projects', false);
  User.disableRemoteMethod('__delete__projects', false);

  User.disableRemoteMethod('__link__projects', false);
  User.disableRemoteMethod('__unlink__projects', false);
  User.disableRemoteMethod('__exists__projects', false);

  User.disableRemoteMethod('__destroyById__accounts', false);
  User.disableRemoteMethod('__updateById__accounts', false);

  User.disableRemoteMethod('__create__accounts', false);
  User.disableRemoteMethod('__update__accounts', false);
  User.disableRemoteMethod('__delete__accounts', false);

  User.disableRemoteMethod('__link__accounts', false);
  User.disableRemoteMethod('__unlink__accounts', false);
  User.disableRemoteMethod('__exists__accounts', false);

  //explained in http://digitaldrummerj.me/strongloop-extending-user-model-security/
  User.settings.acls = require('./user.json').acls;

  /**
   * Normalize the credentials
   * @param {Object} credentials The credential object
   * @param {Boolean} realmRequired
   * @param {String} realmDelimiter The realm delimiter, if not set, no realm is needed
   * @returns {Object} The normalized credential object
   */
  User.normalizeCredentials = function(credentials, realmRequired, realmDelimiter) {
    var query = {};
    credentials = credentials || {};
    if (!realmRequired) {
      if (credentials.email) {
        query.email = credentials.email;
      } else if (credentials.cell) {
        query.cell = credentials.cell;
      } else if (credentials.username) {
        query.username = credentials.username;
      }
    } else {
      if (credentials.realm) {
        query.realm = credentials.realm;
      }
      var parts;
      if (credentials.email) {
        parts = splitPrincipal(credentials.email, realmDelimiter);
        query.email = parts[1];
        if (parts[0]) {
          query.realm = parts[0];
        }
      } else if (credentials.cell) {
        parts = splitPrincipal(credentials.cell, realmDelimiter);
        query.cell = parts[1];
        if (parts[0]) {
          query.realm = parts[0];
        }
      } else if (credentials.username) {
        parts = splitPrincipal(credentials.username, realmDelimiter);
        query.username = parts[1];
        if (parts[0]) {
          query.realm = parts[0];
        }
      }
    }
    return query;
  };

  User.login = function(credentials, include, fn) {
    var self = this;
    if (typeof include === 'function') {
      fn = include;
      include = undefined;
    }

    fn = fn || utils.createPromiseCallback();

    include = (include || '');
    if (Array.isArray(include)) {
      include = include.map(function(val) {
        return val.toLowerCase();
      });
    } else {
      include = include.toLowerCase();
    }

    var realmDelimiter;
    // Check if realm is required
    var realmRequired = !!(self.settings.realmRequired ||
      self.settings.realmDelimiter);
    if (realmRequired) {
      realmDelimiter = self.settings.realmDelimiter;
    }
    var query = self.normalizeCredentials(credentials, realmRequired,
      realmDelimiter);

    if (realmRequired && !query.realm) {
      var err1 = new Error('realm is required');
      err1.statusCode = 400;
      err1.code = 'REALM_REQUIRED';
      fn(err1);
      return fn.promise;
    }
    if (!query.email && !query.username && !query.cell) {
      var err2 = new Error('username, email or cell number is required');
      err2.statusCode = 400;
      err2.code = 'USERNAME_EMAIL_CELL_REQUIRED';
      fn(err2);
      return fn.promise;
    }

    self.findOne({where: query}, function(err, user) {
      var defaultError = new Error('login failed');
      defaultError.statusCode = 401;
      defaultError.code = 'LOGIN_FAILED';

      function tokenHandler(err, token) {
        if (err) return fn(err);
        if (Array.isArray(include) ? include.indexOf('user') !== -1 : include === 'user') {
          // NOTE(bajtos) We can't set token.user here:
          //  1. token.user already exists, it's a function injected by
          //     "AccessToken belongsTo User" relation
          //  2. ModelBaseClass.toJSON() ignores own properties, thus
          //     the value won't be included in the HTTP response
          // See also loopback#161 and loopback#162
          token.__data.user = user;
        }
        fn(err, token);
      }

      if (err) {
        debug('An error is reported from User.findOne: %j', err);
        fn(defaultError);
      }

      else if (user) {
        user.hasPassword(credentials.password,

          function(err, isMatch) {

            if (err) {
              debug('An error is reported from User.hasPassword: %j', err);
              fn(defaultError);
            }

            else if (isMatch) {
                      if (self.settings.emailVerificationRequired && !user.emailVerified) {
                        // Fail to log in if email verification is not done yet
                        debug('User email has not been verified');
                        err = new Error('login failed as the email has not been verified');
                        err.statusCode = 401;
                        err.code = 'LOGIN_FAILED_EMAIL_NOT_VERIFIED';
                        fn(err);
                      }
                      else {
                              if (user.createAccessToken.length === 2) {
                                user.createAccessToken(credentials.ttl, tokenHandler);
                              } else {
                                user.createAccessToken(credentials.ttl, credentials, tokenHandler);
                              }
                      }
            }

            else {
              debug('The password is invalid for user %s', query.email || query.username);
              fn(defaultError);
            }

        });
      } else {
        debug('No matching record is found for user %s', query.email || query.username);
        fn(defaultError);
      }
    });
    return fn.promise;
  };


  User.afterRemote('login', function(ctx, remoteMethodOutput, next) {
    var roles = [];
    var app = ctx.req.app;
    var include = ctx.args.include;
    var jwtIncluded = true;

    roleModel = app.models.Role;
    roleMappingModel = app.models.RoleMapping;

    if (Array.isArray(include) ? include.indexOf('jwt') === -1 : include !== 'jwt') {
       jwtIncluded = false;
    }

    roleMappingModel.find({where: {principalType: roleMappingModel.USER,
      principalId: ctx.result.userId}}, function(err, mappings) {
      if (err) {
        return next(err);
      }

      async.map(


      mappings,
      function(m, resolve) {
             roleModel.findById(m.roleId, function(err, role){
             resolve(null, role.name);
        });
      },
      function(err, results){


        if (ctx.result.__data.user)
          ctx.result.__data.user.roles = results;
        ctx.result.__data.roles = results;

        if (!jwtIncluded) {
          return next();
        }
        User.projectPermissions(ctx.result.userId,function(err, projects){
          if (err) {
            next(err);
          }
          ctx.result.__data.projects = projects;
          var body = {
            header: { alg: algorithm },
            secret: privateKey,
            payload: ctx.result
          };
          ctx.result.__data.jwt = jwt.sign(body);
          next();
        });


      });
    });
  });


  User.getApp(function(err, app) {
    User.getAccounts = function(id, cb) {
      var userAccountModel = app.models.userAccount;
      var accountModel = app.models.account;

      var all = [];
      function getSubs(account, resolve) {
        if (!account.ownership) {
          account.ownership = 'sub';
          all.push(account);
        }

        app.models.account.find({where:{parentId:account.id}}, function(err, accts){
          async.map(accts, getSubs, function(err, results){
              resolve(err, results);
          });
        });
      }

      userAccountModel.find({where:{userId:id}}, function(err, mappings){
        async.map(mappings, function(m, resolve) {
          accountModel.findById(m.accountId, function(err, acct){
            if (m.ownership === 1) {
              acct.ownership = 'owner';
              getSubs(acct, function(err, results){
                resolve(null, acct);
              });
            } else {
              acct.ownership = 'member';
              resolve(null, acct);
            }

          });
        }, function(err, results){
          cb(err, results.concat(all));
        });
      });
    };

    User.remoteMethod(
      'getAccounts', {
        accepts: [{arg: 'id', type: 'string', required: true}],
        returns: {arg: 'accounts',type: ['account'],root: true},
        http: {
          path: '/:id/accountList',
          verb: 'get'
        },
        accessType: 'READ',
        description: 'Fetches accounts associated to user, sub accounts are included if user is an account owner',
      }
    );

    User.projectList = function(id, cb) {
      var projectModel = app.models.project;

      User.getAccounts(id, function(err, accounts){
        async.map(accounts, function(acct, resolve) {
          if (acct.ownership === 'member'){
            return resolve(null, []);
          }
          projectModel.find({where:{ownerId: acct.id}}, function(err, items){
            for(var i=0; i<items.length; i++){
              items[i].accountName = acct.name;
            }
            resolve(null, items);
          });
        }, function(err, results){
          var list = [];
          results.forEach(function(p){
            list = list.concat(p);
          });
          cb(err, list);
        });
      });
    };

    User.projectPermissions = function(id, cb) {
      var scopes = [];
      var userAssignmentModel = app.models.userAssignment;
      var projectModel = app.models.project;

      userAssignmentModel.find({where:{userId:id}}, function(err, mappings){
        async.map(mappings, function(m, resolve) {
          projectModel.findById(m.projectId, function(err, project){
            project.permission = m.permission;
            resolve(null, project);
          });
        }, function(err, results){
          cb(err, results);
        });
      });
    };

    User.remoteMethod(
      'projectPermissions', {
        accepts: [{arg: 'id',type: 'string',required: true}],
        returns: {arg: 'scopes',type: ['object'],root: true},
        http: {
          path: '/:id/projectPermissions',
          verb: 'get'
        },
        accessType: 'READ',
        description: 'Fetches permissions of an user',
      }
    );

    User.remoteMethod(
      'projectList', {
        accepts: [{arg: 'id',type: 'string',required: true}],
        returns: {arg: 'projects',type: ['project'],root: true},
        http: {
          path: '/:id/projectList',
          verb: 'get'
        },
        accessType: 'READ',
        description: 'Fetches projects user owned'
      }
    );

    User.getUserByToken = function(ctx, cb) {
      var roles = [];
      var userId = ctx.req.accessToken.userId;

      roleModel = app.models.Role;
      roleMappingModel = app.models.RoleMapping;

      User.findById(userId, function(err, user){
        if (err) {
          cb(err);
        }
        roleMappingModel.find({where: {principalType: roleMappingModel.USER,
          principalId: userId}}, function(err, mappings) {
          if (err) {
            cb(err);
          }

          async.map(mappings, function(m, resolve) {
            roleModel.findById(m.roleId, function(err, role){
              resolve(null, role.name);
            });
          }, function(err, results){
            user.roles = results;
            cb(err, user);
          });
        });
      });
    };

    User.remoteMethod(
      'getUserByToken', {
        accepts: {
          arg: 'ctx',type: 'object', http: function(ctx) {
            // ctx is LoopBack Context object
            return ctx;
          }
        },
        returns: {arg: 'roles',type: 'user',root: true},
        http: {
          path: '/getUserByToken',
          verb: 'get'
        },
        accessType: 'READ',
        description: 'Fetches roles of accessToken, limited',
      }
    );

    User.createAdmin = function(user, cb) {
      User.create(user, function(err, admin){
        if (err) {
          return cb(err);
        }
        var RoleMapping = app.models.RoleMapping;
        app.adminRole.principals.create({
          principalType: RoleMapping.USER,
          principalId: admin.id
        }, function(err, principal) {
          cb(err, admin);
        });
      });
    };

    User.remoteMethod(
      'createAdmin', {
        accepts: {arg: 'data', type: 'user', http: {source: 'body'}},
        returns: {arg: 'user',type: 'user',root: true},
        http: {
          path: '/createAdmin',
          verb: 'post'
        },
        accessType: 'WRITE',
        description: 'create a admin user',
      }
    );


    User.signup = function(user, cb) {
      var accountModel = app.models.account;

      var acctData = {
        name: user.username || user.email,
        type:0, //individal account
        parentId: 0
      };

      accountModel.create(acctData, function(acct, err){
        if (err) {
          cb(err);
        }

        acct.createOwner(acct.id, user, function(err){
          cb(err);
        });
      });

    };

    User.remoteMethod(
      'signup', {
        accepts: {arg: 'data', type: 'user', http: {source: 'body'}},
        returns: {arg: 'user',type: 'user',root: true},
        http: {
          path: '/signup',
          verb: 'post'
        },
        accessType: 'WRITE',
        description: 'Create an individal account',
      }
    );
  });

};
