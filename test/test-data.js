/*jshint camelcase:false */

var path = require('path');
var async = require('async');
var app = require(path.resolve(__dirname, '../server/server'));
var ds = app.datasources.db;

var people = {
  karl: { username: 'karl', email: 'karl@doa.com', password: 'password'},
  chj_owner: { username: 'chj_owner', email: 'chj_owner@doa.com', password: 'password'},
  chj_staff: { username: 'chj_staff', email: 'chj_staff@doa.com', password: 'password'},
  hsa_owner: { username: 'hsa_owner', email: 'hsa_owner@doa.com', password: 'password'},
  hsa_staff: { username: 'hsa_staff', email: 'hsa_staff@doa.com', password: 'password'},
  shoe_owner: { username: 'shoe_owner', email: 'shoe_owner@doa.com', password: 'password'},
  shoe_staff: { username: 'shoe_staff', email: 'shoe_staff@doa.com', password: 'password'}
};

var projectsData = {
  shoe: [{ name: 'shoe_project1'},
        { name: 'shoe_project2'}
    ],
  hsa: [{ name: 'hsa_project1'},
        { name: 'hsa_project2'}
    ],
  chj: [{ name: 'chj_project1'},
        { name: 'chj_project2'}
    ],
};

var accountTestData = {
  chj: {name:'chj'},
  hsa: {name:'hsa'},
  shoe: {name:'shoe'}
};

var admin =  { username: 'Admin', email: 'Admin@doa.com', password: 'password'};

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
      if (err) {
        return done(err);
      }
      //make Admin an admin
      role.principals.create({
        principalType: app.models.RoleMapping.USER,
        principalId: user.id
      }, function(err, principal) {
        //if (err) throw err;
        done(err);
      });
    });
  });
}

var shoeAcct, chjAcct, hsaAcct;
var shoeOwner, shoeStaff;
var chjOwner, chjStaff;
var hsaOwner, hsaStaff;
var shoeProjects, chjProjects, hsaProjects;
var root = {};
function setup(cb) {
  async.series([
    function (cb) {
      var called = false;
      app.models.user.destroyAll(function(err) {
          app.models.AccessToken.destroyAll(function(err){
            app.models.role.destroyAll(function(err){
              if (called) {  
                return;
              }

              called = true;
              if (err) 
                return cb(err);
              cb(null);
            });
          });
        });
    },

    initRootAccount,

    function (cb) {
      rootAcct.subs.create(accountTestData.shoe, function(err, acct){
        if (err) 
          return cb(err);
        shoeAcct = acct;
        cb(null, shoeAcct);
      });
    },
    function (cb) {
      console.log('2');
      rootAcct.subs.create(accountTestData.chj, function(err, acct){
        if (err) 
          return cb(err);

        chjAcct = acct;
        cb(null, chjAcct);
      });
    },
    function (cb) {
      chjAcct.subs.create(accountTestData.hsa, function(err, acct){
        hsaAcct = acct;
        cb(err, hsaAcct);
      });
    },
    function (cb) {
      shoeAcct.users.create(people.shoe_owner, function(err, user){
        shoeOwner = user;
        cb(err, shoeOwner);
      });
    },
    function (cb) {
      shoeAcct.users.create(people.shoe_staff, function(err, user){
        shoeStaff = user;
        cb(err, shoeStaff);
      });
    },
    function (cb) {
      app.models.userAccount.create([
        {userId:shoeOwner.id, accountId:shoeAcct.id, ownership:1},
        {userId:shoeStaff.id, accountId:shoeAcct.id, ownership:2}],function(err, ownerships){
          cb(err, '5');
        });
    },
    function (cb) {
      chjAcct.users.create(people.chj_owner, function(err, user){
        chjOwner = user;
        cb(err, chjOwner);
      });
    },
    function (cb) {
      chjAcct.users.create(people.chj_staff, function(err, user){
        chjStaff = user;
        cb(err, chjStaff);
      });
    },
    function (cb) {
      app.models.userAccount.create([
        {userId:chjOwner.id, accountId:chjAcct.id, ownership:1},
        {userId:chjStaff.id, accountId:chjAcct.id, ownership:2}],function(err, ownerships){
          cb(err, '8');
        });
    },
    function (cb) {
      hsaAcct.users.create(people.hsa_owner, function(err, user){
        hsaOwner = user;
        cb(err, hsaOwner);
      });
    },
    function (cb) {
      hsaAcct.users.create(people.hsa_staff, function(err, user){
        hsaStaff = user;
        cb(err, hsaStaff);
      });
    },
    function (cb) {
      app.models.userAccount.create([
        {userId:hsaOwner.id, accountId:hsaAcct.id, ownership:1},
        {userId:hsaStaff.id, accountId:hsaAcct.id, ownership:2}],function(err, ownerships){
          cb(err, '11');
        });
    },

    function (cb) {
      shoeAcct.projects.create(projectsData.shoe, function(err, projs){
        shoeProjects = projs;
        cb(err, projs);
      });
    },
    function (cb) {
      app.models.userAssignment.create(
        [{userId:shoeOwner.id, projectId:shoeProjects[0].id, permission:{read:1, write:1}},
        {userId:shoeOwner.id, projectId:shoeProjects[1].id, permission:{read:1, write:1}},
        {userId:shoeStaff.id, projectId:shoeProjects[0].id, permission:{read:1, write:0}},
        {userId:shoeStaff.id, projectId:shoeProjects[1].id, permission:{read:1, write:0}}],
        function(err, ua){
          cb(err, 'shoe userAssignment');
        });
    },
    function (cb) {
      chjAcct.projects.create(projectsData.chj, function(err, projs){
        chjProjects = projs;
        cb(err, projs);
      });
    },
    function (cb) {
      app.models.userAssignment.create(
        [{userId:chjOwner.id, projectId:chjProjects[0].id, permission:{read:1, write:1}},
        {userId:chjOwner.id, projectId:chjProjects[1].id, permission:{read:1, write:1}},
        {userId:chjStaff.id, projectId:chjProjects[0].id, permission:{read:1, write:0}},
        {userId:chjStaff.id, projectId:chjProjects[1].id, permission:{read:1, write:0}}],
        function(err, ua){
          cb(err, 'chj userAssignment');
        });
    },
    function (cb) {
      hsaAcct.projects.create(projectsData.hsa, function(err, projs){
        hsaProjects = projs;
        cb(err, projs);
      });
    },
    function (cb) {
      app.models.userAssignment.create(
        [{userId:hsaOwner.id, projectId:hsaProjects[0].id, permission:{read:1, write:1}},
        {userId:hsaOwner.id, projectId:hsaProjects[1].id, permission:{read:1, write:1}},
        {userId:hsaStaff.id, projectId:hsaProjects[0].id, permission:{read:1, write:0}},
        {userId:hsaStaff.id, projectId:hsaProjects[1].id, permission:{read:1, write:0}}],function(err, ua){
          cb(err, '11');
        });
    },

    function (cb) {
      app.models.userAssignment.create(
        [{userId:chjOwner.id, projectId:hsaProjects[0].id, permission:{read:1, write:1}},
        {userId:chjOwner.id, projectId:hsaProjects[1].id, permission:{read:1, write:1}},
        {userId:chjStaff.id, projectId:hsaProjects[0].id, permission:{read:1, write:0}},
        {userId:chjStaff.id, projectId:hsaProjects[1].id, permission:{read:1, write:0}}],function(err, ua){
          cb(err, '11');
        });
    },

    ],function(err, results) {

        //console.log(err, results);
        cb(err, results);
    });
}

module.exports = setup;

/*
    var all = [];
      function getSubs(account, cb) {
        all.push(account);
        app.models.account.find({where:{parentId:account.id}}, function(err, accts){
          async.map(accts, getSubs, function(err, results){
              cb(err, results);
          });
        });
      }

      app.models.account.findById(1, function(err, root){
        getSubs(root, function(err, results){
          console.log('all', all);
        });
      });*/
     