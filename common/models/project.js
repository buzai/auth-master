module.exports = function(Project) {
	Project.disableRemoteMethod('__destroyById__operators', false);
  Project.disableRemoteMethod('__updateById__operators', false);
  Project.disableRemoteMethod('__delete__operators', false);
  Project.disableRemoteMethod('__create__operators', false);

 	Project.disableRemoteMethod('__destroyById__permissions', false);
  Project.disableRemoteMethod('__updateById__permissions', false);
  //Project.disableRemoteMethod('__findById__permissions', false);

  Project.disableRemoteMethod('__create__permissions', false);
  Project.disableRemoteMethod('__update__permissions', false);
  Project.disableRemoteMethod('__delete__permissions', false);

  Project.disableRemoteMethod('create', true);
  Project.disableRemoteMethod('upsert', true);
  Project.disableRemoteMethod('updateAttributes', false);
};
