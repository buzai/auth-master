/**
 * Module dependencies.
 */
var url = require('url')
  , debug = require('debug')('loopback:jwtauth')
  , async = require('async')
  , lazy = require('lazy.js')
  , jwt = require('jws');

var privateKey;

module.exports = function(app, options) {
  var algorithm = 'HS256';
  //var secret = '5678';

  options = options || {};

  // The urlencoded middleware is required for oAuth 2.0 protocol endpoints
  var oauth2Paths = [
      options.authorizePath || '/oauth/authorize',
      options.tokenPath || '/oauth/token',
      options.revokePath || '/oauth/revoke',
      options.decisionPath || '/oauth/authorize/decision',
      options.loginPath || '/login'
  ];
  app.middleware('parse', oauth2Paths,
  app.loopback.urlencoded({extended: false}));
  app.middleware('parse', oauth2Paths, app.loopback.json({strict: false}));

  function assertionVerify(req, cb){
    var assertion;
    var credential = {};
    var isValid;

    assertion = JSON.parse(jwt.decode(req.body).payload);

    if (!assertion || !assertion.clientId) {
      var err1 = new Error('client id is required');
      err1.statusCode = 401;
      err1.code = 'LOGIN_FAILED';
      return cb(err1, null);
    }

    isValid = jwt.verify(assertion, algorithm, privateKey);
    if (!isValid) { 
      var e = new Error('Invalid Assertion');
      e.status = e.statusCode = 401;
      e.code = 'INVALID_TOKEN';
      return cb(e, null);
    }

    cb(null, assertion);
  }

  // Set up the login handler
  app.post(options.loginPath || '/login', function(req, res, next){  

    return assertionVerify(req, userLogin);

    function userLogin(err, assertion){
       var result;
      var roleMappingModel = app.models.RoleMapping;
      var roleModel = app.models.Role;
      var roles=[];
      var credential = assertion;


      app.models.user.login(credential, 'user', function(err, token) {
        if (err) {
            res.send(err); 
            return;
        }

        roleMappingModel.find({where: {principalType: roleMappingModel.USER,
          principalId: token.userId}}, function(err, mappings) {
            if (err) {
              res.send(err); 
              return;
            }
            
            async.map(mappings, function(m, resolve) {
              roleModel.findById(m.roleId, function(err, role){
                resolve(null, role.name);
              });  
            }, function(err, roles){
              token.roles = roles;

              var body = {
                header: { alg: algorithm },
                secret: privateKey,
                payload: token
              };
              
              result = {token:jwt.sign(body)};
              res.status(200).json(result);   
            });
            
          });

      });
    }
    
  });
  
};
