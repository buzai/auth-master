module.exports = function(app) {
  var Role = app.models.Role;

  Role.registerResolver('projectOwner', function (role, context, cb) {
    function reject() {
      process.nextTick(function () {
        cb(null, false);
      });
    }

    // if the target model is not project
    if (context.modelName !== 'project') {
      return reject();
    }

    // do not allow anonymous users
    var userId = context.accessToken.userId;
    if (!userId) {
      return reject();
    }

    context.model.findById(context.modelId, function (err, project) {
      if (err || !project)
        return reject();

      app.models.user.getAccounts(userId, function (err, accounts) {
        if (err || !accounts.length) {
          return reject();
        }
        var match = false;
        for (var i = 0; i < accounts.length; i++) {
          if (accounts[i].id.toString() === project.ownerId.toString() &&
            accounts[i].ownership != 'member') {
            match = true;
            break;
          }
        }
        cb(null, match);
      });

    });

  });

  Role.registerResolver('accountOwner', function(role, context, cb) {
    var userAccount = app.models.userAccount;
    function reject() {
      process.nextTick(function() {
        cb(null, false);
      });
    }

    // if the target model is not account
    if (context.modelName !== 'account') {
      return reject();
    }

    // do not allow anonymous users
    var userId = context.accessToken.userId;
    if (!userId) {
      return reject();
    }

    var match = false;
    app.models.user.getAccounts(userId, function(err, accounts){
      if (err || !accounts.length) {
        return reject();
      }
      
      for (var i=0; i<accounts.length; i++) {
        if (accounts[i].id.toString() === context.modelId.toString() && 
          accounts[i].ownership != 'member') {
          match = true;
          break;
        }
      }
      cb(null, match); 
    });
    
  });
};
