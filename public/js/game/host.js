var states = {
	LOBBY: 0,
	INTRO: 1,
	ROUND_INTRO: 2,
	ANSWER_PROMPTS: 3,
	CURRENT_PROMPT: 4,
	PROMPT_VOTES: 5,
	PROMPT_SCORES: 6,
	SCORES_UNSORTED: 7,
	SCORES_SORTED: 8,
	WINNER: 9,
	END: 10
};

function HostView(){
	var code = false;
	var state = false;
	var minPlayers = false;
	var maxPlayers = false;
	var players = false;
	var sortedPlayers = false;
	var audience = false;
	var round = false;
	var currentPrompt = false;
	var answers = false;
	var votesPerPlayer = false;
	var audienceVotes = false;
	var noAnswer = false;
	var jinx = false;
	
	this.init = function(){
		this.initSocket();
		this.bindViewEvents();
		this.bindSocketEvents();
		socket.emit('host_init');
	}
	
	this.initSocket = function(){
		socket = io.connect({
			'reconnection':true,
			'reconnectionDelay': 1000,
			'reconnectionDelayMax' : 1000,
			'reconnectionAttempts': 1000
		});
	}
	
	this.updateData = function(data){
		code = data.code;
		state = data.state;
		audience = data.audience;
		if(!minPlayers) minPlayers = data.min_players;
		if(!maxPlayers) maxPlayers = data.max_players;
		players = data.players;
		sortedPlayers = data.sorted_players;
		audience = data.audience;
		round = data.round;
		currentPrompt = data.current_prompt;
		answers = data.answers;
		votesPerPlayer = data.votes_per_player;
		audienceVotes = data.audience_votes;
		noAnswer = data.no_answer;
		jinx = data.jinx;
		this.updateView();
	}
	
	this.updateView = function(){
		$("#room_code").html("Code: " + code);
		if(state == states.LOBBY){
			$("#lobby").show();
			$("#game_start").hide();
			$("#lobby_room_code").html("<p>Code: " + code + "</p>");
			var html = "";
			for(let i = 0; i < maxPlayers; i++) html += "<p>" + (i < players.length ? players[i].name : "<i>join now!</i>") + "</p>";
			if(players.length < minPlayers) $("#btn_start_game").html((minPlayers - players.length) + (minPlayers - players.length > 1 ? " more players needed" : " more player needed"));
			else{
				$("#btn_start_game").html('Start Game');
				if(players.length == maxPlayers) html += "<p>" + (audience > 0 ? audience + " in audience" : "Join the audience!") + "</p>";
			}
			$('#lobby_players').html(html);
		}
		else{
			$("#lobby").hide();
			$("#game_start").show();
			$("#game").show();
			$("#game_audience_count").html("<p>" + (audience > 0 ? audience + " in audience</p>" : "Join the audience!</p>"));
			if(state == states.INTRO){
				$("#intro").show();
				$("#intro").html("<p>Welcome to Quiplash!</p><p>For each round, you will answer 2 prompts in the funniest way you can.</p><p>Each of your answers is then each paired up with another player's answer to the same prompt.</p><p>Everyone else votes for their favourite response!</p>" + (audience > 0 ? "<p>Audience members get to vote too!</p>" : ""));
			}
			else if(state == states.ROUND_INTRO){
				$("#intro").show();
				$("#intro").html(round == 0 ? "<p>Round 1</p><p>You receive points for each response depending on the percentage of votes received.</p><p>Remember: if you can't think of a response to a prompt, you can use a safety quip instead. However, you will only receive half as many points for it.</p>" : round == 1 ? "<p>Round 2</p><p>All points are doubled.</p>" : "<p>Final Round</p><p>Everyone gets the same prompt!</p>");
			}
			else $("#intro").hide();
			if(state == states.ANSWER_PROMPTS){
				$("#answer_prompts").show();
				$("#write_answer").html(round < 2 ? "<p>Write your answers on your device now!</p>" : "<p>" + currentPrompt + "</p>");
				var html = "";
				for(let i = 0; i < players.length; i++) html += "<p>" + players[i].name + (players[i].answered ? " (done)" : " (not done)") + "</p>";
				$("#players_answered").html(html);
			}
			else $("#answer_prompts").hide();
			if(state == states.CURRENT_PROMPT){
				$("#current_prompt").show();
				$("#show_prompt").html("<p>" + currentPrompt + "</p>");
				var html = "";
				for(let i = 0; i < answers.length; i++) html += "<p>" + (answers[i].answer ? answers[i].answer : "[NO RESPONSE]") + "</p>";
				$("#show_answers").html(html);
				if(noAnswer) $("#vote_prompt").hide();
				else{
					$("#vote_prompt").show();
					$("#vote_prompt").html(jinx ? "<p><b>JINX</b></p>" : round < 2 ? "<p>Vote now!</p>" : (audience && audience > 0 ? (votesPerPlayer > 1 ? "<p>Players get " + votesPerPlayer + " votes.</p><p>Audience members get 1 vote.</p>" : "<p>Everyone gets 1 vote.</p>") : (votesPerPlayer > 1 ? "<p>Everyone gets " + votesPerPlayer + " votes.</p>" : "<p>Everyone gets 1 vote.</p>")));
				}
				if(noAnswer || jinx) $("#audience_votes").hide();
				else{
					$("#audience_votes").show();
					$("#audience_votes").html("Audience votes: " + audienceVotes);
				}
			}
			else if(state == states.PROMPT_VOTES){
				$("#current_prompt").show();
				var html = "";
				var quiplash = false;
				var superQuiplash = false;
				for(let i = 0; i < answers.length; i++){
					quiplash |= answers[i].quiplash_bonus;
					superQuiplash |= answers[i].super_quiplash_bonus;
					var pv = answers[i].player_votes;
				}
				for(let i = 0; i < answers.length; i++){
					const pv = answers[i].player_votes;
					var pVotes = "";
					if(pv && pv.length > 0){
						var v = {};
						for(let i = 0; i < pv.length; i++){
							var f = i;
							for(let j = 0; j < i; j++) if(f == i && pv[j] == pv[i]) f = j;
							if(v[f]) v[f]++;
							else v[f] = 1;
						}
						var first = true;
						for(var p in v){
							if(v[p]){
								pVotes += (first ? "" : " | ") + pv[p] + (v[p] > 1 ? " (" + v[p] + ")" : "");
								first = false;
							}
						}
					}
					const tv = ((pv ? pv.length : 0) + answers[i].audience_votes);
					html += "<div><p>" + (answers[i].answer ? answers[i].answer : "[NO RESPONSE]") + "</p><p>" + answers[i].player + (answers[i].safety ? " (safety quip)" : "") + "</p><p>Player votes: " + pVotes + (audienceVotes ? "</p><p>" + "Audience votes: " + answers[i].audience_votes : "") + "</p><p>Total votes: " + tv + " (" + answers[i].vote_percentage + "%)" + "</p></div>";
				}
				$("#show_answers").html(html);
				if(quiplash){
					$("#vote_prompt").show();
					$("#vote_prompt").html("<p><b>QUIPLASH</b></p>");
				}
				else if(superQuiplash){
					$("#vote_prompt").show();
					$("#vote_prompt").html("<p><b>SUPER QUIPLASH</b></p>");
				}
				else $("#vote_prompt").hide();
				$("#audience_votes").hide();
			}
			else if(state == states.PROMPT_SCORES){
				$("#current_prompt").show();
				$("#show_prompt").hide();
				var html = "";
				for(let i = 0; i < answers.length; i++){
					const pv = answers[i].player_votes;
					var pVotes = "";
					if(pv && pv.length > 0){
						var v = {};
						for(let i = 0; i < pv.length; i++){
							var f = i;
							for(let j = 0; j < i; j++) if(f == i && pv[j] == pv[i]) f = j;
							if(v[f]) v[f]++;
							else v[f] = 1;
						}
						var first = true;
						for(var p in v){
							if(v[p]){
								pVotes += (first ? "" : " | ") + pv[p] + (v[p] > 1 ? " (" + v[p] + ")" : "");
								first = false;
							}
						}
					}
					const tv = ((pv ? pv.length : 0) + answers[i].audience_votes);
					html += "<div><p>" + (answers[i].answer ? answers[i].answer : "[NO RESPONSE]") + "</p><p>" + answers[i].player + (answers[i].safety ? " (safety quip)" : "") + (noAnswer || jinx ? "" : "</p><p>Player votes: " + pVotes + (audienceVotes ? "</p><p>" + "Audience votes: " + answers[i].audience_votes : "") + "</p><p>Total votes: " + tv + " (" + answers[i].vote_percentage + "%)") + "</p><p>Score: " + answers[i].score + (round < 2 ? (answers[i].winner_bonus ? "</p><p>+ " + answers[i].winner_bonus : answers[i].quiplash_bonus ? "</p><p>+ " + answers[i].quiplash_bonus : answers[i].super_quiplash_bonus ? "</p><p>+" + answers[i].super_quiplash_bonus :  "") : "") + "</p></div>";
				}
				$("#show_answers").html(html);
				$("#audience_votes").hide();
			}
			else $("#current_prompt").hide();
			if(state == states.SCORES_UNSORTED || state == states.SCORES_SORTED){
				$("#scores").show();
				var html = "<p>SCORES</p>";
				for(let i = 0; i < sortedPlayers.length; i++) html += "<p>" + (i + 1) + " " + players[sortedPlayers[i]].name + ": " + players[sortedPlayers[i]].score + "</p>";
				$("#scores").html(html);
			}
			else $("#scores").hide();
			if(state == states.WINNER){
				$("#winner").show();
				var winners = [];
				var maxScore = 0;
				for(let i = 0; i < sortedPlayers.length; i++){
					var currentScore = players[sortedPlayers[i]].score;
					if(i == 0) maxScore = currentScore;
					if(currentScore == maxScore) winners.push(players[sortedPlayers[i]].name);
				}
				var html = winners.length > 1 ? "<p>WINNERS:<p>" : "<p>WINNER:</p>";
				for(let i = 0; i < winners.length; i++) html += "<p>" + winners[i] + "</p>";
				$("#winner").html(html);
			}
			else $("#winner").hide();
			if(state == states.END){
				$("#game").hide();
				$("#end").show();
				var html = "<p>FINAL SCORES</p>";
				for(let i = 0; i < sortedPlayers.length; i++) html += "<p>" + (i + 1) + " " + players[sortedPlayers[i]].name + ": " + players[sortedPlayers[i]].score + "</p>";
				$("#final_scores").html(html);
			}
			else $("#end").hide();
		}
	}
	
	this.bindViewEvents = function(){
		$('#btn_start_game').click(function(){
			if(!players || players.length < minPlayers) alert((players ? minPlayers - players.length : minPlayers) + (minPlayers - players.length > 1 ? " more players needed to start." : " more player needed to start."));
			else if(confirm("Start the game?")) socket.emit('host_start_game');
			return false;
		});
		$('#btn_continue').click(function(){
			socket.emit('host_continue');
			return false;
		});
		$('#btn_end_game').click(function(){
			socket.emit('host_end_game');
			return false;
		});
		$('#btn_leave_game').click(function(){
			if(confirm("Destroy the current game? All data associated with this game will be lost.")){
				socket.emit('host_leave_game');
			}
			return false;
		});
		$('#btn_same_players').click(function(){
			if(confirm("Play again with the same players?")){
				socket.emit('host_start_game');
			}
			return false;
		});
		$('#btn_new_players').click(function(){
			if(confirm("Start a new lobby? You as the host will remain connected.")){
				socket.emit('host_new_lobby');
			}
			return false;
		});
	}
	
	this.bindSocketEvents = function(){
		socket.on('host_init_ok', function(host){
			return function(data){
				host.updateData(data);
				return false;
			}
		}(this));
		socket.on('host_init_nok', function(){
			location.href = '/';
		});
		socket.on('host_players_update', function(host){
			return function(newPlayers){
				players = newPlayers;
				host.updateView();
				return false;
			}
		}(this));
		socket.on('host_audience_update', function(host){
			return function(newAudience){
				audience = newAudience;
				host.updateView();
				return false;
			}
		}(this));
		socket.on('host_state_update', function(host){
			return function(data){
				if(state != data.state) host.updateData(data);
				return false;
			}
		}(this));
		socket.on('host_set_audience_votes', function(host){
			return function(votes){
				if(state != states.CURRENT_PROMPT) return false;
				audienceVotes = votes;
				host.updateView();
				return false;
			}
		}(this));
	}
}

$(document).ready(function(){
	var game = new HostView();
	game.init();
});
