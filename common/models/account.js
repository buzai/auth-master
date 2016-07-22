module.exports = function(Account) {
  //move these disable thing to boot script because of initialization dependency.
  /*Account.disableRemoteMethod('__destroyById__members', false);
  Account.disableRemoteMethod('__updateById__members', false);

  Account.disableRemoteMethod('__create__members', false);
  Account.disableRemoteMethod('__update__members', false);
  Account.disableRemoteMethod('__delete__members', false);*/

  Account.definition.rawProperties.created.default =
  Account.definition.properties.created.default = function() {
    return new Date();
  };

  Account.validatesUniquenessOf('name', {message: 'Account already exists'});

  Account.getApp(function(err, app) {
    Account.ownership = function(id, cb) {
      var UserAccount = app.models.userAccount;
      var User = app.models.User;
      UserAccount.find({
        where: {
          and: [{
            accountId: id
          }, {
            ownership: 1
          }]
        }
      }, function(err, items) {
        items.forEach(function(ua) {
          User.find({
            where: {
              id: ua.userId
            }
          }, function(err, users) {
            cb(null, users);
          });
        });
      });
    };

    /*Account.remoteMethod(
      'ownership', {
        accepts: [{
          arg: 'id',
          type: 'number',
          required: true
        }],
        returns: {
          arg: 'users',
          type: ['user'],
          root: true
        },

        http: {
          path: '/:id/ownership',
          verb: 'get'
        }
      }
    );*/
    Account.createOwner = function(id, data, cb) {
      Account.findById(id, function(err, acct) {
        if (acct.type === 0) {
          acct.__count__users(function(err, count){
            if (count>0) {
              var err1 = new Error('Can\'t add more than one user to individal account');
              err1.statusCode = 400;
              err1.code = 'INDIVIDAL_ACCOUNT_COUNT';
              return cb(err1);
            }
          });
        }
        acct.users.create(data, function(err, user){
          if (err) {
            return cb(err);
          }
          app.models.userAccount.upsert({ownership:1, userId: user.id, accountId:user.ownerId}, cb);
        });
      }); 
    };

    Account.remoteMethod(
      'createOwner', {
        accepts: [{arg: 'id',type: 'string',required: true},
        {arg: 'data', type: 'user', required: true, http: {source: 'body'}}],
        returns: {arg: 'user',type: 'user',root: true},
        http: {
          path: '/:id/createOwner',
          verb: 'post'
        },
        accessType: 'WRITE',
        description: 'create an owner of account',
      }
    );

    Account.createMember = function(id, data, cb) {
      Account.findById(id, function(err, acct){
        if (acct.type === 0) {
          var err1 = new Error('Can\'t add a member to individal account');
          err1.statusCode = 400;
          err1.code = 'INDIVIDAL_ACCOUNT_COUNT';
          return cb(err1);
        }
        acct.users.create(data, function(err, user){
          if (err) {
            return cb(err);
          }
          app.models.userAccount.upsert({ownership:2, userId: user.id, accountId:user.ownerId}, cb);
        });
      }); 
    };

    Account.remoteMethod(
      'createMember', {
        accepts: [{arg: 'id',type: 'string',required: true},
        {arg: 'data', type: 'user', required: true, http: {source: 'body'}}],
        returns: {arg: 'user',type: 'user',root: true},
        http: {
          path: '/:id/createMember',
          verb: 'post'
        },
        accessType: 'WRITE',
        description: 'create an owner of account',
      }
    );

    Account.promotion = function(id, data, cb) {
      cb();
    };

    Account.remoteMethod(
      'promotion', {
        accepts: [{arg: 'id',type: 'string',required: true}],
        http: {
          path: '/:id/promotion',
          verb: 'all'
        },
        accessType: 'WRITE',
        description: 'Promote an individual account',
      }
    );

    function unsetType(ctx, user, next) {
      var body = ctx.req.body;
      if (body && body.type) {
        delete body.type;
      }
      next();
    }
    Account.beforeRemote('create', unsetType);
    Account.beforeRemote('upsert', unsetType);
    Account.beforeRemote('findOrCreate', unsetType);
    Account.beforeRemote('updateAll', unsetType);
    Account.beforeRemote('updateAttributes', unsetType);
    Account.beforeRemote('__updateById__subs', unsetType);

  });

  Account.setup();
};
