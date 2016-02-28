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
    '/index.js': true,
    '/style.css': true,
  };

  var staticFileType = {
    '.js': 'application/javascript',
    '.css': 'text/css',
  }
  
  if (staticFiles[req.url]) {
    var path = req.url;
    if (path == '/') path='/index.html';
    path = '../client' + path;

    var contentType = 'text/html';
    var fileType = req.url.slice(req.url.lastIndexOf('.'));
    if (staticFileType[fileType]) {
      contentType = staticFileType[fileType];
    }

    res.writeHeader(200, {'Content-Type': contentType});
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

function CellState(word) {
  this.word = word;
  this.color = Math.random()>.5 ? 'red' : 'blue';
  this.revealed = false;
}

function Game(id) {
  this.id = id;
  this.votes = {};
  this.players = [];
  this.votingTeam = 'red';
  
  this.cells = [];
  var words = randomWords();
  var colorPalette = [];
  for (var i=0; i<9; i++) colorPalette.push('red');
  for (var i=0; i<8; i++) colorPalette.push('blue');
  for (var i=0; i<7; i++) colorPalette.push('grey');
  for (var i=0; i<1; i++) colorPalette.push('black');
  
  for (var i=0; i<words.length; i++) {
    this.cells.push(new CellState(words[i]));
    
    var idx = Math.floor(Math.random()*colorPalette.length);
    this.cells[i].color = colorPalette[idx];
    colorPalette.splice(idx, 1);
  }
  this.cells.push(new CellState('Pass'));
}
Game.prototype.makeCellState = function(revealAll) {
  var votesFor = [];
  for (var i=0; i<this.cells.length; i++) {
    votesFor[i] = 0;
  }
  for (var vote in this.votes) {
    votesFor[this.votes[vote]]++;
  }
  
  var state = [];
  for (var i=0; i<this.cells.length; i++) {
    state[i] = {
      word: this.cells[i].word,
      voteProgress: votesFor[i] / Math.max(1, this.votersFor(this.votingTeam).length),
      color: revealAll||this.cells[i].revealed ? this.cells[i].color : null
    }
  };
  
  return state;
}
Game.prototype.makeState = function() {
  return {
    cells: this.makeCellState(),
    playingTeam: this.votingTeam,
    players: this.players
  }
}

Game.prototype.votersFor = function(team) {
  var players = [];
  for (var i=0; i<this.players.length; i++) {
    if (this.players[i].team == team) {
      players.push(this.players[i]);
    }
  }
  return players;
}

Game.prototype.spymasterFor = function(team) {
  for (var i=0; i<this.players.length; i++) {
    var player = this.players[i];
    if (player.team == team && player.isSpymaster) {
      return player;
    }
  }
  return null;
}

Game.prototype.removePlayer = function(playerToRemove) {
  for (var i=0; i<this.players.length; i++) {
    var player = this.players[i];
    if (player.id == playerToRemove.id) {
      this.players.splice(i, 1);
      return;
    }
  }
  console.log('player not found!');
}

Game.prototype.detectMajorityFor = function(index) {
  var votesFor = 0;
  for (var vote in this.votes) {
    if (this.votes[vote] == index) votesFor++;
  }
  
  var votesRequired = this.votersFor(this.votingTeam).length;
  if (votesFor >= votesRequired) {
    
    var guessedColor;
    if (index < 25) {
      this.cells[index].revealed = true;
      
      guessedColor = this.cells[index].color;
    }
    
    if (guessedColor == this.votingTeam) {

    } else if (guessedColor == 'black') {

    } else {
      this.votingTeam = this.votingTeam=='red' ? 'blue' : 'red';
    }
    
    this.votes = {};
  }
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

function Player(params) {
  this.id = params.id,
  this.name = params.name,
  this.team = params.team,
  this.isSpymaster = params.isSpymaster
}

var globalId = 1;
function generatePlayerName() {
  return 'Player ' + globalId++;
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
    var team = game.votersFor('red').length <= game.votersFor('blue').length ? 'red' : 'blue';

    var player = new Player({
      id: playerId,
      name: generatePlayerName(),
      team: team,
      spymaster: game.spymasterFor(team) == null
    });
    game.players.push(player);

    
    socket.emit('youAreOn', team);
    socket.emit('stateUpdate', game.makeState());
    
    if (player.isSpymaster) {
      socket.emit('showWordList', game.makeCellState(true));
    }
    
    socket.on('vote', function(votedForIndex) {
      console.log('vote cast for ', team, game.votingTeam);
      if (team != game.votingTeam || player.isSpymaster) {
        return;
      }
      game.votes[playerId] = votedForIndex;
      
      game.detectMajorityFor(votedForIndex);
      console.log('Sqeeee! Player', playerId, 'voted for', votedForIndex)
      
      game.broadcastState();
    });
    
    socket.once('disconnect', function() {
      console.log('socket disconnected');
      var voterIdx = game.removePlayer(player);
      game.broadcastState();
    });
  });
  
});

