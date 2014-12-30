var _ = require('stackq'),
    fs = require('graceful-fs'),
    plug = require('plugd'),
    quero = require('quero'),
    path = require('path'),
    love = require('../lovedb.js');


// require('quero/adaptors/mongo.js');
require('quero/adaptors/redis.js');
require('quero/adaptors/buffer.js');
require('quero/adaptors/inmemory.js');

_.Jazz('Lovedb specs',function($){

  var toM = function(f){ return f.body; };
  var grid = plug.Network.make('lovedb spec');
  grid.crate(love);

  grid.use('lovedb/compose/core','ldb');

  var db = grid.get('ldb');

  db.tasks().on(_.tags.tagDefer('db-tasks'));
  db.replies().on(_.tags.tagDefer('db-replies'));

  db.Task('db.core',{
    'namespace':'developers.medocs.io',
    'addr':'127.0.0.1',
    'port': 3000,
    'flat': {
      'adaptor': 'inMemory',
      'username': 'alex',
      'password':'box',
      'db': 'localhost/medicdocs'
    },
    'stream':{
      'adaptor': 'Listdb',
      'db': 'localhost/attachments'
    }
  });


  var rs = db.Task('db.stream',{
    'model': '5urprise.mp4',
    'uid': _.Util.guid(),
  });

  var mov = fs.createReadStream('./love.js');
  mov.on('data',_.funcs.bind(rs.emit,rs));
  mov.on('end',_.funcs.bind(rs.endData,rs));

  setTimeout(_.funcs.bind(mov.pause,mov),3000);
  setTimeout(_.funcs.bind(mov.resume,mov),6000);

  db.Task('streamdb.query',{
    'model': 'suction.txt',
    'uid': _.Util.guid(),
    'query': _.Query('suction.txt').use('insert','words-pro').use('save'),
  });

  var ds = db.Task('streamdb.streamQuery',{
    'model': 'suction.txt',
    'persist': true,
    'uid': _.Util.guid(),
  });

  ds.emit(_.Query('suction.txt').use('insert','paddon').use('save'));
  ds.emit(_.Query('suction.txt').use('insert','roach').use('save'));
  ds.emit(_.Query('suction.txt').use('insert',[1,3,5,7,10]).use('save'));

});
