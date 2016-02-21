var http = require('http');
var sio = require('socket.io');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var WORDS = require('./words');

var server = http.createServer(function(req, res) {
  //var pathparts = path.parse(req.url);
  console.log(req.url);
  
  var staticFiles = {
    '/jquery.min.js': true,
    '/': true,
  };
  
  if (staticFiles[req.url]) {
    var path = req.url;
    if (path == '/') path='/index.html';
    path = '../client' + path;
    
    res.writeHeader(200, {'Content-Type': 'text/html'});
    fs.createReadStream(path).pipe(res);
  } else {
    res.writeHeader(404);
    res.end('404!');
  }
  
});
server.listen(8088);

function randomWords() {
  var result = [];
  var chose = {};
  while (result.length < 25) {
    var word = WORDS[Math.floor(Math.random() * WORDS.length)];
    if (!chose[word]) {
      result.push(word);
      chose[word] = true;
    }
  }
  return result;
}

function Game(id) {
  this.id = id;
  this.votes = {};
  this.voterCounts = {red: 0, blue: 0};
  this.votingTeam = 'red';
  
  this.words = randomWords();
}
Game.prototype.makeState = function() {
  var votesFor = [];
  for (var i=0; i<25; i++) {
    votesFor[i] = 0;
  }
  for (var vote in this.votes) {
    votesFor[this.votes[vote]]++;
  }
  
  var state = [];
  for (var i=0; i<25; i++) {
    state[i] = {
      word: this.words[i],
      voteProgress: votesFor[i] / Math.max(1, this.voterCounts[this.votingTeam]),
      color: null
    }
  };
  
  return state;
}

Game.prototype.broadcastState = function() {
  io.to('game' + this.id).emit('stateUpdate', this.makeState());
}

var GAMES = {};

GAMES['45450b9405cdf1a78907'] = new Game('45450b9405cdf1a78907');

var io = sio.listen(server);

function generateId() {
  return new Buffer(crypto.randomBytes(10)).toString('hex');
}


io.sockets.on('connection', function (socket) {
  var playerId = generateId();
  console.log('playerId', playerId);
  
  var game = null;
  console.log('connection!')
  socket.once('beginStream', function (data) {
    console.log('began stream');
    
  });
  socket.once('joinGame', function(gameId) {
    game = GAMES[gameId];
    socket.join('game' + gameId);
    var team = game.voterCounts['red'] <= game.voterCounts['blue'] ? 'red' : 'blue';
    game.voterCounts[team]++;
    
    socket.emit('youAreOn', team);
    socket.emit('stateUpdate', game.makeState());
    
    socket.on('vote', function(votedForIndex) {
      console.log('vote cast for ', team, game.votingTeam);
      if (team != game.votingTeam) {
        return;
      }
      game.votes[playerId] = votedForIndex;
      
      console.log('Sqeeee! Player', playerId, 'voted for', votedForIndex)
      
      game.broadcastState();
    });
    
    socket.once('disconnect', function() {
      console.log('socket disconnected');
      game.voterCounts[team]--;
      game.broadcastState();
    });
  });
  
});

