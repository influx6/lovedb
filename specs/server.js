var _ = require('stackq'),
    plug = require('plugd'),
    path = require('path'),
    love = require('../server.js');



_.Jazz('Lovedb.Server specs',function($){

  var grid = love.Grid;

  grid.Task('io.server',{
    address: '127.0.0.1',
    port: 3001
  });


});
