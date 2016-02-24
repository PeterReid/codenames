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
  var playingTeam = null;

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
    for (var i=0; i<state.voters['red'].length; i++) {
      var voter = state.voters['red'][i];
      $tbody.append("<tr><td class='player red'>" + voter + "</td></tr>");
    }
    for (var i=0; i<state.voters['blue'].length; i++) {
      var voter = state.voters['blue'][i];
      $tbody.append("<tr><td class='player blue'>" + voter + "</td></tr>");
    }
    $playerList.append($tbody);

  }



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
    for (var i=0; i<states.length; i++) {
      var appendTo = null;
      switch (states[i].color) {
        case myTeam: appendTo = 'mineList'; break;
        case 'grey': appendTo = 'neutralList'; break;
        case 'black': appendTo = 'assassinList'; break;
        default: appendTo = 'enemyList'; break;
      }

      console.log(states[i]);
      $('#' + appendTo).append( $('<div>').text(states[i].word) );
    }
  }

  socket.emit('joinGame', gameId);

  socket.on('stateUpdate', loadState);
  socket.on('youAreOn', function(team) {
    myTeam = team;
    $('#grid').removeClass('red').removeClass('blue').addClass(team);
    $('#wordlist').hide();
  });
  socket.on('showWordList', showWordList);

});
