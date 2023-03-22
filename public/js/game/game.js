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

function GameView(){
	var state = false;
	var name = false;
	var finalRound = false;
	var currentPrompt = false;
	var answers = false;
	var answerIndex = false;
	var voting = false;
	var votesLeft = false;
	
	this.init = function(){
		this.initSocket();
		this.bindViewEvents();
		this.bindSocketEvents();
		socket.emit('game_init');
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
		state = data.state;
		if(!name) name = data.name;
		finalRound = data.final_round;
		currentPrompt = data.current_prompt;
		voting = data.voting;
		answers = data.answers;
		if(name) answerIndex = data.answer_index;
		votesLeft = data.votes_left;
		this.updateView();
	}
	
	this.updateView = function(){
		$("#title").html("<b>" + (name ? name : "AUDIENCE") + "</b>");
		$("#answered").hide();
		$("#audience_waiting").hide();
		$("#my_prompt").hide();
		$("#voted").hide();
		var idle = true;
		if(state == states.LOBBY){
			idle = false;
			$("#lobby").show();
		}
		else $("#lobby").hide();
		if(state == states.ANSWER_PROMPTS){
			idle = false;
			if(name){
				if(currentPrompt){
					$("#answer_prompts").show();
					$("#answer_prompt").html("<p>" + currentPrompt + "</p>");
					if(finalRound) $("#safety_quip").hide();
				}
				else{
					$("#answer_prompts").hide();
					$("#answered").show();
				}
			}
			else{
				$("#answer_prompts").hide();
				$("#audience_waiting").show();
			}
		}
		else $("#answer_prompts").hide();
		if(state == states.CURRENT_PROMPT){
			idle = !voting;
			if(!idle){
				if(answerIndex === false || finalRound){
					if(votesLeft){
						$("#vote").show();
						$("#vote_prompt").html(finalRound ? "You have " + votesLeft + (votesLeft > 1 ? " votes left." : " vote left .") : currentPrompt);
						for(let i = 0; i < answers.length; i++){
							const button = "#btn_vote" + (i + 1);
							if((answerIndex === false || finalRound && i != answerIndex) && answers[i]){
								$(button).show();
								$(button).html(answers[i]);
							}
							else $(button).hide();
						}
						for(let i = answers.length + 1; i < 9; i++) $("#btn_vote" + i).hide();
					}
					else{
						$("#vote").hide();
						$("#voted").show();
					}
				}
				else{
					$("#vote").hide();
					if(name) $("#my_prompt").show();
				}
			}
		}
		else $("#vote").hide();
		if(state == states.END){
			idle = false;
			$("#end").show();
		}
		else $("#end").hide();
		if(idle) $("#idle").show();
		else $("#idle").hide();
	}
	
	this.submitVote = function(vote){
		if(answerIndex && vote == answerIndex) return;
		socket.emit('game_submit_vote', vote);
		votesLeft = false;
		this.updateView();
	}
	
	this.bindViewEvents = function(){
		$('#btn_submit_answer').click(function(game){
			return function(){
				if($("#answer").val().length == 0){
					alert("You cannot submit an empty field.");
					return false;
				}
				socket.emit('game_submit_answer', $("#answer").val().toUpperCase());
				document.getElementById("answer").value = "";
				currentPrompt = false;
				game.updateView();
				return false;
			}
		}(this));
		$('#btn_safety_quip').click(function(game){
			return function(){
				socket.emit('game_submit_answer', false);
				document.getElementById("answer").value = "";
				currentPrompt = false;
				game.updateView();
				return false;
			}
		}(this));
		$('#btn_vote1').click(function(game){
			return function(){
				game.submitVote(0);
				return false;
			}
		}(this));
		$('#btn_vote2').click(function(game){
			return function(){
				game.submitVote(1);
				return false;
			}
		}(this));
		$('#btn_vote3').click(function(game){
			return function(){
				game.submitVote(2);
				return false;
			}
		}(this));
		$('#btn_vote4').click(function(game){
			return function(){
				game.submitVote(3);
				return false;
			}
		}(this));
		$('#btn_vote5').click(function(game){
			return function(){
				game.submitVote(4);
				return false;
			}
		}(this));
		$('#btn_vote6').click(function(game){
			return function(){
				game.submitVote(5);
				return false;
			}
		}(this));
		$('#btn_vote7').click(function(game){
			return function(){
				game.submitVote(6);
				return false;
			}
		}(this));
		$('#btn_vote8').click(function(game){
			return function(){
				game.submitVote(7);
				return false;
			}
		}(this));
	}
	
	this.bindSocketEvents = function(){
		socket.on('game_init_ok', function(game){
			return function(data){
				game.updateData(data);
				return false;
			}
		}(this));
		socket.on('game_init_nok', function(){
			alert('You were disconnected.');
			location.href = '/';
		});
		socket.on('game_state_update', function(game){
			return function(data){
				if(state != data.state) game.updateData(data);
				return false;
			}
		}(this));
		socket.on('game_check_audience_connection', function(){
			socket.emit('game_verify_audience_connection');
		});
		socket.on('game_receive_prompt', function(game){
			return function(newPrompt){
				if(state != states.ANSWER_PROMPTS) return false;
				currentPrompt = newPrompt;
				game.updateView();
				return false;
			}
		}(this));
		socket.on('game_set_votes_left', function(game){
			return function(votes){
				if(state != states.CURRENT_PROMPT) return false;
				votesLeft = votes;
				game.updateView();
			}
		}(this));
	}
}

$(document).ready(function(){
	var game = new GameView();
	game.init();
});