module.exports = (function(){

  var _ = require('stackq');
  var q = require('quero');
  var plug = require('plugd');
  var resd = require('resourcedjs');

  require('quero/adaptors/buffer.js');
  require('quero/adaptors/inmemory.js');

/**

      Mission Statement and Prologue:

      The design of lovedb is based on the very simple stack that their are two major types of hosted db
      a stream db and a regular record db, these is a design document to both detail and help gear and direct
      by God's mercy the code towards those design,below are architectural details:


      Stream db:
      This type of db is based on the approach provided by mydb style,which allows the streaming of data
      into the available db using quero. The basic idea is a record in these type of service is a collection
      of in-stream data which can be listened to for updates(has the stream data is being sent into the in-memory)
      buffer(i devised that we create a custom 'bufferDb' in quero,that can temporarily,hold the streams and when done
      will simple send that detail down into the quero connections queries stream), because quero naturally can tell
      /update on data insertions,removals and updates,it gives the naturally ability to report in-memory stream changes
      to any one(bringing in the ability of client to listen to the stream,like cloudup)


      FlatDb:
      This type of db is the standard get and store db,but has extra capabilities,that is,its a regular restful
      database service,where users run queries on (short-lived atomic queries eg. find, save, update), it has no
      internal streaming capabilities beyond streaming large record pieces in response to queries. because the
      backend will be quero,we can listen to changes on database and which leads to the main keys,is that through
      a restful point,a socket connection can be created that allows clients to listen to the changes on a whole
      document/records or a single record, that is the update,insert,destroy and drop events,it allows the naturall
      real-time capabilities while still allow us to make these a simple self running service


      Revision:
      Both flatdb and streamdb are no different,they simple store data into the db,we hence break down the
      barrier of two types and almagate into one => LoveDb, it provides functional level varations,
      that is the different between the two is just in the type of data being sent over,they still provide
      the standard listening up to the changes that occur within the db as related to these document

**/

  var DEFAULTCONFIG = {
    'flat':{},
    'stream':{
      'tag':'inMemory',
      'db':'http://localhost:2700'
    },
    'fs':{
      'tag': 'fs_db',
      'db':'./app/db/fsdb'
    },
    'rack':{
      'configs': './app/config',
      'models': './app/models',
      'views': './app/models'
    },
  };

  var love = plug.Rack.make('lovedb');

  love.registerPlug('db',function(){
    var db = _.Future.make(), conf;

    var validateConf = function(map){
      if(_.valids.not.contains(map,'namespace')) return false;
      if(_.valids.not.contains(map,'flat')) return false;
      return true;
    };

    this.tasks().on(this.$bind(function(p){
      if(_.valids.not.Object(p.body) || !validateConf(p.body))
        return this.Task('db.error',new Error('Invalid Config'));
      return db.complete(p.body);
    }));

    db.then(this.$bind(function(m){
      conf = _.funcs.extends(DEFAULTCONFIG,m);
      //send out configuration to database and store handlers
      this.Task('streamdb.conf',_.funcs.extends({
        'namespace': conf.namespace
      },conf.stream));
      this.Task('flatdb.conf',_.funcs.extends({
        'namespace': conf.namespace
      },conf.flat));
      this.Task('fsdb.conf',_.funcs.extends({
        'namespace': conf.namespace
      },conf.fs));
      this.Task('rack.conf',_.funcs.extends({
        'namespace': conf.namespace
      },conf.rack));

    }));

  });

  love.registerPlug('streamdb',function(){
    var db = _.Future.make();

    this.newTaskChannel('conf','streamdb.conf');
    this.newTaskChannel('query','streamdb.query');
    this.newTaskChannel('qs','streamdb.streamQuery');

    this.tasks('conf').on(function(p){
      if(_.valids.not.Object(p.body)) return;
      _.Future.make(function(){
        this.complete(q.make(p.body));
      }).chain(db);
    });

    db.then(function(k){
      return k.up();
    });

    var queryProc = this.$bind(function(p){
      if(!_.Query.isQuery(p.body.query)) return;
      var body = p.body, model = body.model, uid = body.uid;
      db.then(this.$bind(function(d){
          var m = d.modelQuery(body.query);
          m.future().changes().on(this.$bind(function(pc){
            this.Task('streamdb.notify',{ 'uid': uid , meta: pc});
          }));
          m.future().then(this.$bind(function(c){
            var buf = d.connection.get(body.model);
            if(buf) this.Task('streamdb.notify',{ 'uid': uid , doc: body.persist ? buf.peek() : buf.release(), end: true});
          }));
          m.end();
      }));
    });

    this.tasks('qs').on(function(p){
      p.stream.on(function(f){
        if(!_.Query.isQuery(f)) return;
        var q = { uuid: p.uuid}; q.body = _.Util.extends({ query: f },p.body);
        return queryProc(q);
      });
    });

    this.tasks('query').on(function(p){
      //every packet that comes contains the stream of data and the query needed to kickstart
      return queryProc(p);
    });

    //only data comes in here,not query object
    this.tasks().on(this.$bind(function(p){
      //every packet that comes contains the stream of data and the query needed to kickstart
      var body = p.body, stream = p.stream, model = body.model, uid = body.uid;
      db.then(this.$bind(function(d){
        stream.on(this.$bind(function(c){
          var m = d.model(model), ft = m.future();
          ft.changes().on(this.$bind(function(pc){
            this.Task('streamdb.notify',{ 'uid': uid , meta: pc});
          }));
          m.use('insert',c);
          m.use('save');
          m.end();
        }));

        stream.onEvent('dataEnd',this.$bind(function(){
          var buf = d.connection.get(model);
          if(buf) this.Task('streamdb.notify',{ 'uid': uid , doc: body.persist ? buf.peek() : buf.release(), end: true});
        }));
      }));
    }));

  });

  love.registerPlug('flatdb',function(){
    var db = _.Future.make();

    this.newTaskChannel('conf','flatdb.conf');
    this.newTaskChannel('qs','flatdb.streamQuery');

    this.tasks('conf').on(function(p){
      if(_.valids.not.Object(p.body)) return;
      _.Future.make(function(){
        this.complete(q.make(p.body));
      }).chain(db);
    });

    db.then(function(k){
      return k.up();
    });

    var queryProc = this.$bind(function(p){
      if(!_.Query.isQuery(p.body.query)) return;
      var body = p.body, model = body.model, uid = body.uid;
      db.then(this.$bind(function(d){
          var m = d.modelQuery(body.query);
          m.future().changes().on(this.$bind(function(pc){
            this.Task('flatdb.notify',{ 'uid': uid , meta: pc});
          }));
          m.future().then(this.$bind(function(c){
            this.Task('flatdb.notify',{ 'uid': uid , doc: null, end: true});
          }));
          m.end();
      }));
    });

    this.tasks('qs').on(function(p){
      p.stream.on(function(f){
        if(!_.Query.isQuery(f)) return;
        var q = { uuid: p.uuid}; q.body = _.Util.extends({ query: f },p.body);
        return queryProc(q);
      });
    });

    this.tasks().on(function(p){
      //every packet that comes contains the stream of data and the query needed to kickstart
      return queryProc(p);
    });

  });

  love.registerPlug('rackdb',function(){
    var db = _.Future.make();

    this.newTaskChannel('conf','rackdb.conf');
    this.newTaskChannel('qs','rackdb.streamQuery');

    this.tasks('conf').on(function(p){
      if(_.valids.not.Object(p.body)) return;
      _.Future.make(function(){
        this.complete(q.make(p.body));
      }).chain(db);
    });

    db.then(function(k){
      return k.up();
    });

    var queryProc = this.$bind(function(p){
      if(!_.Query.isQuery(p.body.query)) return;
      var body = p.body, model = body.model, uid = body.uid;
      db.then(this.$bind(function(d){
          var m = d.modelQuery(body.query);
          m.future().changes().on(this.$bind(function(pc){
            this.Task('rackdb.notify',{ 'uid': uid , meta: pc});
          }));
          m.future().then(this.$bind(function(c){
            this.Task('rackdb.notify',{ 'uid': uid , doc: null, end: true});
          }));
          m.end();
      }));
    });

    this.tasks('qs').on(function(p){
      p.stream.on(function(f){
        if(!_.Query.isQuery(f)) return;
        var q = { uuid: p.uuid}; q.body = _.Util.extends({ query: f },p.body);
        return queryProc(q);
      });
    });

    this.tasks().on(function(p){
      //every packet that comes contains the stream of data and the query needed to kickstart
      return queryProc(p);
    });

  });

  love.registerPlug('io.request',function(){

  });

  love.registerPlug('notify-sink',function(){

  });

  love.registerCompose('core',function(){

    this.use(love.Plug('db','db.core'),'coredb');
    this.use(love.Plug('flatdb','db.flat'),'flatdb');
    this.use(love.Plug('streamdb','db.stream'),'streamdb');
    this.use(love.Plug('rackdb','db.rack'),'rackdb');

  });

  return love;
}());
