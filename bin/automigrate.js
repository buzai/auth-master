var path = require('path');

var app = require(path.resolve(__dirname, '../server/server'));
var ds = app.datasources.db;
ds.automigrate('user');
ds.automigrate('account');
ds.automigrate('project');
ds.automigrate('role');
ds.automigrate('AccessToken');
ds.automigrate('ACL');
ds.automigrate('RoleMapping');
ds.automigrate('userAssignment');
ds.automigrate('userAccount');

ds.automigrate('application');
ds.automigrate('ipPool');
ds.automigrate('ipAllocated');
