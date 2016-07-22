module.exports = function(affiliateRequest) {
  affiliateRequest.disableRemoteMethod('create', true);
  affiliateRequest.disableRemoteMethod('upsert', true);
  affiliateRequest.disableRemoteMethod('updateAttributes', false);
  affiliateRequest.disableRemoteMethod('findById', true); 
  affiliateRequest.disableRemoteMethod('updateAll', true);
  
  affiliateRequest.disableRemoteMethod('createChangeStream', true);
};