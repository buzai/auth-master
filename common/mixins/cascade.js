// Cascade delete for loopback
// https://gist.github.com/CjS77/44b2f75c0ec468f590d0

/* jshint node:true */
'use strict';

/**
 * There is an incubating feature to cascade the deletes to the relational tables. see
 * https://github.com/strongloop/loopback-datasource-juggler/issues/88
 */
var lazy = require('lazy.js');
var log = require('debug')('mixins:cascade');
var Q = require('q');

module.exports = function (Model, options) {
    var matchRelation = function (name) {
        return lazy(Model.relations).find(function (mr) {
            return mr.name === name;
        });
    };

    //Pre-process and remove unsupported relations
    lazy(options).keys().forEach(function (relationName) {
        var relation = matchRelation(relationName);
        if (relation && relation.type === 'referencesMany') {
            console.log('Cascading to referencesMany is not supported - %s', relation.name);
            log('Cascading to referencesMany is not supported - %s', relation.name);
            delete options[relationName];
        }
    });

    function getIdFromWhereByModelId(Model, where) {
        var idName = Model.getIdName();
        if (!(idName in where)) return undefined;

        var id = where[idName];
        // TODO(bajtos) support object values that are not LB conditions
        if (typeof id === 'string' || typeof id === 'number') {
          return id;
        }
        return undefined;
    }

    function deleteCascades(thisId, next) {
        var promises = [];
        var needCallNext = true;
        lazy(options).keys().each(function (relationName) {
            var relation = matchRelation(relationName);
            if (!relation) {
                next();
                return;
            }
            var filter = {};
            filter[relation.keyTo] = thisId;
            if (options[relationName].unlink) {
                var throughModel = relation.modelThrough;
                if (throughModel) {
                    console.log('#1 Cascaded delete link of: ', relationName);
                    breakLinks(throughModel, filter, next);
                } else {
                    log('%s.%s does not have a through model. Nothing to unlink', Model.definition.name, relationName);
                }
            } else {
                //See https://gist.github.com/fabien/126ccfaca48ddf1cefb8
                var promise = relation.modelTo.find({where: filter}).then(function (items) {
                    return Q.all(
                        lazy(items).map(function (inst) {
                            console.log('#1.2 Delete instance', inst);
                            return inst.destroy();
                        }).toArray()
                    ).then(function (results) {
                      console.log('#2 Cascaded delete of: ', items);
                      if (relation.modelThrough) {
                          breakLinks(relation.modelThrough, filter, next);
                      }
                    });
                });
                promises.push(promise);
            }
        });
        Q.all(promises).then(function(results) {
          log('Cascade: ' + results);
          next();
        });
    }

    Model.observe('before delete', function (ctx, next) {
        var thisId = ctx.instance ? ctx.instance.getId() :
            getIdFromWhereByModelId(ctx.Model, ctx.where);
        if (!thisId) {
            ctx.Model.find({where: ctx.where}, function(err, instances){
                if (err || !instances.length) {
                    //if (err) log(err);
                    next();
                    return; //Nothing we can do
                }
                instances.forEach(function(instance){
                    thisId = instance.id;
                    deleteCascades(thisId, next);
                });
            });
        }

        next();
    });

    Model.observe('after delete', function (ctx, next) {
        if (!(ctx.instance || ctx.where)) {
            log('There is no way to apply cascading deletes on a multi-record delete');
            next();
            return; //Nothing we can do
        }

        var thisId = ctx.instance ? ctx.instance.getId() :
            getIdFromWhereByModelId(ctx.Model, ctx.where);
        if (thisId) {
            deleteCascades(thisId, next);
        } else {
            ctx.Model.find({where: ctx.where}, function(err, instances){
                if (err || !instances.length) {
                    //if (err) log(err);
                    next();
                    return; //Nothing we can do
                }
                instances.forEach(function(instance){
                    thisId = instance.id;
                    deleteCascades(thisId, next);
                });
            });
        }

    });

    function breakLinks(throughModel, filter, next) {
        throughModel.destroyAll(filter).then(function (info) {
            console.log('Removed %d links from %s referring to %s', info.count, throughModel.definition.name, Model.definition.name);
            //next();
        }).catch(function (err) {
            //next(err);
        });
    }
};