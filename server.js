module.exports = (function(){

  var _ = require('stackq');
  var q = require('quero');
  var plug = require('plugd');
  var resd = require('resourcedjs');
  var love = require('./lovedb.js');
  var web = require('web.plug');
  var fs = require('fs.plug');

  require('quero/adaptors/buffer.js');
  require('quero/adaptors/mongo.js');
  require('quero/adaptors/redis.js');
  require('quero/adaptors/inmemory.js');


  var rs = plug.Rack.make('lovedb.Server');

  // rs.registerCompose('rack',function(){});

  var grid = plug.Network.make('lovedb-Grid',function(){
    //register the plug racks
    this.crate(fs);
    this.crate(love);
    this.crate(rs);
    this.crate(web);

    this.use('web.plug/compose/web.basic','io.server');
    this.use('fs/compose/io','io.fs');
    this.use('lovedb/compose/core','io.love');

    var serv = this.get('io.server'),
        fsd = this.get('io.fs'),
        iol = this.get('io.love');

    // serv.share(iol);
    serv.callWith(function(){
      this.use(web.Plug('web.request','/io'),'app.route.io');

      this.Task('web.router.route',{ url: '/io'});

      this.get('app.route./*').close();
      this.get('app.route.404').detachPoint('home.404');
      this.get('app.route.404').attachPoint(function(p,sx){
        var req = p.body.req, res = req.res;
        res.writeHead(200,{ 'Content-Type': 'text/html'});
        res.write('Welcome to Lovedb:Grid');
        res.end('!');
      },null,'home.404');

      this.get('app.route.io').attachPoint(function(p,sx){
        var req = p.body.req, method = ['io',req.method.toLowerCase()].join('.');
        this.iTask(method,p.body);
      },null,'io.pp');

    });

    iol.callWith(function(){
      this.tasks().on(_.tags.tagDefer('iol',function(f){ return f.message; }));
      
    });


  });


  return {
    Rack: rs,
    Grid: grid,
  };
})();
