$(function() {
  var $grid = $('#grid');

  var gameId = (window.location.href.match('.*#([0-9a-f]+)$')||[])[1];
  console.log(gameId);

  var socket = io();

  function CellState(index) {
    this.index = index;
  }

  var cells = [];
  var votedFor = null;
  var myTeam = null;
  var myPlayerId = null;
  var playingTeam = null;
  var amSpymaster = null;
  
  for (var i=0; i<26; i++) {
    cells[i] = new CellState(i);
  }


  for (var y=0; y<5; y++) {
    var $row = $('<tr>');
    for (var x=0; x<5; x++) {
      var $cell = $('<td>').append($('#cellTemplate').clone());

      $cell.click(onCellClicked.bind(cells[y*5+x]));

      $row.append($cell);
      cells[y*5+x].$elem = $cell;
    }
    $grid.append($row);
  }

  var $passElem = $("<td>").append( $('#cellTemplate').clone() );
  $('#passHolder').append($passElem);
  $passElem.click(onCellClicked.bind(cells[25]));
  cells[25].$elem = $passElem;

  function loadState(state) {
    console.log('loading state', state);
    playingTeam = state.playingTeam;
    var cellStates = state.cells;
    for (var i=0; i<cells.length; i++) {
      var cellState = state.cells[i];
      cells[i].$elem.find('.voteBar').css('width', Math.round(cellState.voteProgress*100) + '%');
      cells[i].$elem.find('.label').text(cellState.word.toUpperCase());
      var colors = ['red', 'blue', 'black', 'grey'];
      for (var c=0; c<colors.length; c++) {
        if (cellState.color == colors[c]) {
          cells[i].$elem.addClass(colors[c]);
        } else {
          cells[i].$elem.removeClass(colors[c]);
        }
      }
      cells[i].state = cellState;
    }

    if (playingTeam == myTeam) {
      $('#waitingIndicator').hide();
    } else {
      $('#waitingIndicator').show();
    }

    var $playerList = $('#playerList');
    $playerList.find("tr").remove();
    var $tbody = $("<tbody></tbody>");
    amSpymaster = false;
    for (var i=0; i<state.players.length; i++) {
      var player = state.players[i];
      if (player.isSpymaster && player.id==myPlayerId) {
        amSpymaster = true;
      }
      
      $tbody.append(
        $('<tr>').append(
          $('<td>').addClass('player').addClass(player.team).text(
            player.name 
            + (player.isSpymaster ? ' (SPYMASTER!)' : '')
            + (player.id == myPlayerId ? ' (ME)' : '')
            
            )
        )
      );
    }
    $playerList.append($tbody);

    var mayPass = !amSpymaster && myTeam==playingTeam;
    $('#passHolder').css('display', mayPass ? 'block' : 'none')
  }

  $('#setName').on('click', function() {
    var name = prompt('Enter your name, adventurer!');
    if (!name) return;
    
    socket.emit('setName', name);
  });

  function onCellClicked(e) {
    console.log('click!');
    e.preventDefault();

    var initialVotedFor = votedFor;

    if (votedFor) votedFor.$elem.removeClass('selfVoted')
    if (votedFor==this || this.state.color) {
      votedFor = null;
    } else {
      votedFor = this;
      this.$elem.addClass('selfVoted');
    }

    if (initialVotedFor!=votedFor) {
      socket.emit('vote', votedFor ? votedFor.index : null);
    }

    return false;
  }

  function showWordList(states) {
    $('#wordlist').show();
    console.log(states);
    for (var i=0; i<25; i++) {
      var appendTo = null;
      switch (states[i].color) {
        case myTeam: appendTo = 'mineList'; break;
        case 'grey': appendTo = 'neutralList'; break;
        case 'black': appendTo = 'assassinList'; break;
        default: appendTo = 'enemyList'; break;
      }

      console.log(states[i]);
      $('#' + appendTo).append( $('<tr><td>' + states[i].word + '</td></tr>') );
    }
  }

  socket.emit('joinGame', gameId);

  socket.on('stateUpdate', loadState);
  socket.on('youAreOn', function(team) {
    myTeam = team;
    $('#grid').removeClass('red').removeClass('blue').addClass(team);
    $('#wordlist').hide();
  });
  socket.on('youAre', function(playerId) {
    myPlayerId = playerId;
  });
  socket.on('showWordList', showWordList);

});
