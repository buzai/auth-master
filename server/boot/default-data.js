module.exports = function(app) {
  /*var Account = app.models.account;
  var User = app.models.user;
  var Role = app.models.Role;
  var RoleMapping = app.models.RoleMapping;

  var defaultOrg;

  Account.create([{
    'name': 'root-account'
  }], function(err, accounts) {
    var root = accounts[0];


    User.create([{
      username: 'Admin',
      email: 'Admin@doa.com',
      password: 'password',
      //emailVerified: true,
      ownerId: root.id
    }, {
      username: 'karl',
      email: 'karl@doa.com',
      password: 'password',
      ownerId: root.id
    }, {
      username: 'newbies',
      email: 'newbies@doa.com',
      password: 'password',
      ownerId: root.id
    }, ], function(err, users) {
      console.log('Create user:', users[0]);

      //create the admin role
      Role.create({
        name: 'admin'
      }, function(err, role) {
        if (err) throw err;

        console.log('Created role:', role);

        //make Admin an admin
        role.principals.create({
          principalType: RoleMapping.USER,
          principalId: users[0].id
        }, function(err, principal) {
          if (err) throw err;

          console.log('Created principal:', principal);

        });
      });

    });
  });*/



  /*var rootAcct;
  var ROOTACCTNAME = 'root-account';
  function initRootAccount(done) {
    var Account = app.models.account;
    Account.find({where:{name: ROOTACCTNAME}}, function(err, roots){
      if (err || roots.length != 1){
        Account.create({name: ROOTACCTNAME, id:1, parentId:0}, function(err, root){
          if (err) {
            console.log('Can not init root account: ', err);
            return done(err, root);
          }
          app.rootAcct = root;
          done(null, root);
        });
      } else {
        app.rootAcct = roots[0];
        done(null, root);
      }
    });
  }

  initRootAccount(function(err, root){
    if (!err) {
      initAdminRole(root);
    }
  });
*/
  function initAdminRole( ) {
     app.models.role.find({where:{name:'admin'}}, function(err, roles){
      if (err || roles.length != 1){
        app.models.role.create({
          name: 'admin',
          ownerId: 0
        }, function(err, role) {
          if (err){
            console.log('Can not init admin role: ', err);
            return;
          }
          app.adminRole = role;
        });
      } else {
        app.adminRole = roles[0];
      }
      
    });
  }

  initAdminRole();
  
  var Account = app.models.account;

  Account.disableRemoteMethod('__destroyById__members', false);
  Account.disableRemoteMethod('__updateById__members', false);
  
  Account.disableRemoteMethod('__create__members', false);
  Account.disableRemoteMethod('__update__members', false);
  Account.disableRemoteMethod('__delete__members', false);

  Account.disableRemoteMethod('__destroyById__accountMembers', false);
  Account.disableRemoteMethod('__updateById__accountMembers', false);
  
  Account.disableRemoteMethod('__create__accountMembers', false);
  Account.disableRemoteMethod('__update__accountMembers', false);
  Account.disableRemoteMethod('__delete__accountMembers', false);

  Account.disableRemoteMethod('__destroyById__accountOwners', false);
  Account.disableRemoteMethod('__updateById__accountOwners', false);
  
  Account.disableRemoteMethod('__create__accountOwners', false);
  Account.disableRemoteMethod('__update__accountOwners', false);
  Account.disableRemoteMethod('__delete__accountOwners', false);


  app.emit('modelRemoted', app.models.Account.sharedClass);

};
