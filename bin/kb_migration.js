var loopback = require('loopback');
var path = require('path');
var app = require(path.resolve(__dirname, '../server/server'));
//var app = require('../../server/server');
//var moment = require('moment');

var ds1 = app.dataSources.mydb;
/*
var pg = require('db');
var types = pg.types;

var parseFn = function(val){
    return val === null ? null : moment(val);
}

var parseTimeStr = function(stringValue){
    pg.types.setTypeParser(1114, function(stringValue) {
      console.log(stringValue);
      return new Date(Date.parse(stringValue + "+0000")).toString;
    });
}

ds1.connector.query(sql, ids, function(err, results){
  if (err){
      console.log(err);
  }
  for (var i in results){
      var kb = app.models.Kb;
      kb.id = results[i].id;
      kb.oldId = results[i].old_id;
      kb.category = results[i].category;
      kb.type = results[i].type;
      kb.title = results[i].title;
      kb.content = results[i].content;
      kb.createdby = results[i].createdby;
      kb.createdon = results[i].createdon;
      kb.enabled = results[i].enabled;
      app.models.Kb.create(results.rows[i], function(err, data){
          if (err){
              console.error(err);
              return;
          }
      })
  }
});
*/

ds1.discoverAndBuildModels('Support_KBCategories', {visited: {}, associations: true},
function(err, models){
  models.SupportKbcategories.find({}, function(err, records){
    if (err){
        console.error(err);
        ds1.close();
        return;
    }
    records.forEach(function(record){
      app.models.KnowledgeBase.create(record, function(err, record){
        if (err){
          console.error(err);
          ds1.close();
          return;
        }
      });
    });
  });
});


ds1.discoverAndBuildModels('Support_KB', {visited: {}, associations: true},
function (err, models) {
  models.SupportKb.find({}, function (err, records) {
    if(err) {
      console.error(err);
      ds1.close();
      return;
    }
    
    records.forEach(function(record){
       app.models.Knowledge.create(record, function(err, record){
           if (err){
               console.error(err);
               ds1.close();
               return;
           }
       });
    });
  });
});

/*
ds1.discoverAndBuildModels('Support_KBFiles', {visited: {}, associations: true},
function(err, models){
  models.SupportKbfiles.find({}, function(err, records){
    if (err){
        console.error(err);
        ds1.close;
        return;
    }
    records.forEach(function(record){
      app.models.KbFiles.create(record, function(err, record){
        if (err){
          console.error(err);
          ds1.close;
          return;
        }
      })
    });
    ds1.close;
  })
});
*/


