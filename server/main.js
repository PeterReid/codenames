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
  this.voters = {red: [], blue: []};
  this.votingTeam = 'red';
  this.spyMasterFor = {red: null, blue: null};
  
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
      voteProgress: votesFor[i] / Math.max(1, this.voters[this.votingTeam].length),
      color: revealAll||this.cells[i].revealed ? this.cells[i].color : null
    }
  };
  
  return state;
}
Game.prototype.makeState = function() {
  return {
    cells: this.makeCellState(),
    playingTeam: this.votingTeam,
    spyMasters: this.spyMasterFor,
    voters: this.voters
  }
}

Game.prototype.detectMajorityFor = function(index) {
  var votesFor = 0;
  for (var vote in this.votes) {
    if (this.votes[vote] == index) votesFor++;
  }
  
  var votesRequired = this.voters[this.votingTeam].length;
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
    var team = game.voters['red'].length <= game.voters['blue'].length ? 'red' : 'blue';
    
    if (game.spyMasterFor[team]==null) {
      game.spyMasterFor[team] = playerId;
    } else {
      game.voters[team].push(playerId);
    }
    
    socket.emit('youAreOn', team);
    socket.emit('stateUpdate', game.makeState());
    
    if (game.spyMasterFor[team] == playerId) {
      socket.emit('showWordList', game.makeCellState(true));
    }
    
    socket.on('vote', function(votedForIndex) {
      console.log('vote cast for ', team, game.votingTeam);
      if (team != game.votingTeam || playerId == game.spyMasterFor[team]) {
        return;
      }
      game.votes[playerId] = votedForIndex;
      
      game.detectMajorityFor(votedForIndex);
      console.log('Sqeeee! Player', playerId, 'voted for', votedForIndex)
      
      game.broadcastState();
    });
    
    socket.once('disconnect', function() {
      console.log('socket disconnected');
      var voterIdx = game.voters[team].indexOf(playerId);
      if (voterIdx>=0) {
        game.voters[team].splice(voterIdx, 1);
      }
      game.broadcastState();
    });
  });
  
});

