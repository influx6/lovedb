module.exports = (function(){

  var _ = require('stackq');
  var q = require('quero');
  var path = require('path');
  var plug = require('plugd');
  var resd = require('resourcedjs');
  var love = require('./lovedb.js');
  var web = require('web.plug');
  var fs = require('fs.plug');

  require('quero/adaptors/buffer.js');
  require('quero/adaptors/mongo.js');
  require('quero/adaptors/redis.js');
  require('quero/adaptors/inmemory.js');


  exports.Server = _.Configurable.extends({
    init: function(map){

    }
  });

  love.registerPlug('rackdb',function(){

    var conf, net = plug.Network.make('rio',function(){

      this.use(fs.Plug('fs.ioControl','rack.io'),'rack.io');

    });

    this.attachNetwork(net);
    this.networkOut(this.replies());

    this.newTaskChannel('rc','rack.conf');

    this.tasks('rc').on(this.$bind(function(p){
      if(_.valids.not.contains(p.body,'base')) return;
      conf = _.Util.clone(p.body);
      net.Task('io.control.conf',conf);
      this.tasks('rc').lock();
      this.tasks('rc').flush();
      initLoad();
      return this.ReplyFrom(p,{ conf: conf, state: true });
    }));


    Function initLoad(){
      var base = conf.base, models = conf.models || path.join(base,'models');

      var loadModel = net.scheduleWatchTask('rack.io',)
    };


  });


  var grid = plug.Network.make('Love:Grid',function(){

    //server plugs
    this.use(web.Plug('http.server','io.server'),'love.io');
    this.use(web.Plug('web.console','http.server.request'),'love.console');
    this.use(web.Plug('web.router','http.server.request'),'love.router');
    this.use(web.Plug('web.resource','http.server.request'),'love.resource');

    //fs operations plugs
    this.use(fs.Plug('fs.ioControl','io.fs'),'love.fs');

    //database plugs
    this.use(love.Plug('streamdb','love.db.stream'),'love.streamdb');
    this.use(love.Plug('flatdb','love.db.flat'),'love.flatdb');
    this.use(love.Plug('rackdb','love.db.rack'),'love.rackdb');
    this.use(love.Plug('db','love.db.manager'),'love.db');


    // //request handlers
    // this.use(web.Plug('web.request','/'),'love.route.home');
    // this.use(web.Plug('web.request','/io'),'love.route.io');
    //
    //
    // this.get('love.route.home').attachPoint(function(q){
    //   var req = q.body.req, res = req.res;
    //   res.write(200); res.end('Love.db Server!');
    // });
    //
    //
    // this.Task('web.router.route',{ url: '/' });

  });




  return {
    Grid: grid,
  };
})();
