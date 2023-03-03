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

function Games(){
	var games = {};
	
	this.createGame = function(){
		var id = this.generateId();
		games[id] = new Game();
		games[id].setId(id);
		return games[id];
	}
	
	this.generateId = function(){
		var id;
		do{
			id = '';
			var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
			var length = letters.length;
			for(var i = 0; i < 4; i++) id += letters.charAt(Math.floor(Math.random() * length));
			for(var g in games) if(games[g].getId() == id) id = false;
		}
		while(!id);
		return id;
	}
	
	this.newLobby = function(gameId){
		var game = games[gameId];
		if(!game) return;
		var id = this.generateId();
		games[id] = game;
		game.setId(id);
		game.newLobby();
	}
	
	this.removeGame = function(gameId){
		if(gameId in games){
			games[gameId].disconnectAll();
			delete games[gameId];
			games[gameId] = false;
		}
	}
	
	this.getGame = function(gameId){
		if(gameId in games) return games[gameId];
		else return false;
	}
}

function Game(){
	var gameId = false;
	var round = false;
	var playerIds = false;
	var sortedPlayers = false;
	var playerData = false;
	var promptData = false;
	var safetyQuips = false;
	var currentPrompt = false;
	var audience = false;
	var users = new Users();
	var gameState = new GameState();
	gameState.setState(states.LOBBY, {});
	
	this.setId = function(pId){
		gameId = pId;
	}
	
	this.getId = function(){
		return gameId;
	}
	
	this.addUser = function(user){
		const curState = gameState.get();
		if(user.getPlayer() && curState != states.LOBBY) return;
		users.addUser(user, gameId);
		const allUsers = users.getAll();
		if(user.getPlayer()){
			if(playerIds) playerIds.push(user.getUniqueId());
			else playerIds = [user.getUniqueId()];
			if(gameState.get() != states.LOBBY) return;
			for(var u in allUsers) if(allUsers[u] && allUsers[u].getHost()) allUsers[u].sendPlayersUpdate(this.getUserData(u).players);
		}
		else if(user.getAudience()){
			if(!audience) audience = {};
			audience[user.getUniqueId()] = {
				connected: true,
				voting: curState == states.CURRENT_PROMPT
			};
		}
	}
	
	this.getUser = function(userId){
		return users.getUser(userId);
	}
	
	this.removeUser = function(userId){
		users.removeUser(userId);
	}
	
	this.getState = function(){
		return gameState.get();
	}
	
	this.getPlayerCount = function(){
		return playerIds ? playerIds.length : 0;
	}
	
	this.getAudienceCount = function(){
		if(!audience) return 0;
		const allUsers = users.getAll();
		var audienceCount = 0;
		for(var a in audience) if(audience[a] && audience[a].connected && allUsers[a] && allUsers[a].getAudience()) audienceCount++;
		return audienceCount;
	}
	
	this.hasPlayer = function(playerName){
		if(!playerIds) return false;
		const allUsers = users.getAll();
		for(let i = 0; i < playerIds.length; i++) if(playerName == allUsers[playerIds[i]].getName()) return true;
		return false;
	}
	
	this.verifyAudienceConnection = function(userId){
		var user = this.getUser(userId);
		if(user && user.getAudience()) audience[userId].connected = true;
	}
	
	this.getUserData = function(userId){
		var user = this.getUser(userId);
		if(!user) return {};
		const allUsers = users.getAll();
		const p = promptData && promptData[currentPrompt];
		if(user.getHost()){
			var players = [];
			if(playerIds){
				for(let i = 0; i < playerIds.length; i++){
					players.push({
						name: allUsers[playerIds[i]].getName(),
						answered: playerData ? playerData[i].answered > (round < 2 ? 1 : 0) : false,
						score: allUsers[playerIds[i]].getScore()
					});
				}
			}
			var answers = false;
			if(p){
				answers = [];
				const currentAnswers = promptData[currentPrompt].answers;
				for(let i = 0; i < currentAnswers.length; i++){
					answers.push({
						answer: currentAnswers[i].answer,
						player: allUsers[playerIds[currentAnswers[i].player]].getName(),
						safety: currentAnswers[i].safety,
						player_votes: currentAnswers[i].player_votes,
						audience_votes: currentAnswers[i].audience_votes,
						vote_percentage: currentAnswers[i].vote_percentage,
						score: currentAnswers[i].score,
						winner_bonus: currentAnswers[i].winner_bonus,
						quiplash_bonus: currentAnswers[i].quiplash_bonus,
						super_quiplash_bonus: currentAnswers[i].super_quiplash_bonus
					});
				}
			}
			return {
				code: gameId,
				state: gameState.get(),
				min_players: prefs.min_players,
				max_players: prefs.max_players,
				players: players,
				sorted_players: sortedPlayers,
				audience: this.getAudienceCount(),
				round: round,
				current_prompt: p ? promptData[currentPrompt].prompt : false,
				answers: answers,
				no_answer: p ? promptData[currentPrompt].no_answer : false,
				jinx: p ? promptData[currentPrompt].jinx : false,
				votes_per_player: p ? promptData[currentPrompt].votes_per_player : false,
				audience_votes: p ? promptData[currentPrompt].audience_votes : false
			};
		}
		else if(user.getPlayer()){
			const state = gameState.get();
			var voting = p && state == states.CURRENT_PROMPT && !promptData[currentPrompt].no_answer && !promptData[currentPrompt].jinx;
			var prompt = false;
			var votesLeft = false;
			var answers = false;
			var answerIndex = false;
			if(p){
				if(voting){
					if(round < 2) prompt = promptData[currentPrompt].prompt;
					answers = [];
					const currentAnswers = promptData[currentPrompt].answers;
					for(let i = 0; i < currentAnswers.length; i++){
						answers.push(currentAnswers[i].answer);
						if(userId == playerIds[currentAnswers[i].player]){
							answerIndex = i;
							voting = round < 2 || !currentAnswers[i].answer || promptData[currentPrompt].answered > 2;
						}
					}
				}
				for(let i = 0; i < playerData.length; i++){
					if(userId == playerIds[i]){
						const prompts = playerData[i].prompts;
						const answered = playerData[i].answered;
						if(state == states.ANSWER_PROMPTS && answered < prompts.length) prompt = prompts[answered];
						if(voting) votesLeft = playerData[i].votes_left;
					}
				}
			}
			return {
				state: state,
				name: allUsers[userId].getName(),
				final_round: round >= 2,
				current_prompt: prompt,
				answers: answers,
				answer_index: answerIndex,
				voting: voting,
				votes_left: votesLeft
			};
		}
		else if(user.getAudience()){
			const state = gameState.get();
			const voting = p && state == states.CURRENT_PROMPT && !promptData[currentPrompt].no_answer && !promptData[currentPrompt].jinx;
			var answers = false;
			if(voting){
				answers = [];
				const currentAnswers = promptData[currentPrompt].answers;
				for(let i = 0; i < currentAnswers.length; i++) answers.push(currentAnswers[i].answer);
			}
			return {
				state: state,
				final_round: round >= 2,
				current_prompt: round < 2 && voting ? promptData[currentPrompt].prompt : false,
				answers: answers,
				voting: voting,
				votes_left: (voting && audience[userId].voting) ? 1 : false
			};
		}
		else return {};
	}
	
	this.startGame = function(){
		round = 0;
		safetyQuips = {};
		sortedPlayers = [];
		for(let i = 0; i < playerIds.length; i++) sortedPlayers.push(i);
		var curState = gameState.get();
		if(curState != states.LOBBY && curState != states.END) return;
		gameState.setState(states.INTRO, {});
		const allUsers = users.getAll();
		for(let i = 0; i < playerIds.length; i++) allUsers[playerIds[i]].resetScore();
		for(var u in allUsers) if(allUsers[u]) allUsers[u].sendStateUpdate(this.getUserData(u));
	}
	
	this.hasStarted = function(){
		var curState = gameState.get();
		return curState != states.LOBBY;
	}
	
	this.continue = function(){
		var curState = gameState.get();
		const allUsers = users.getAll();
		if(curState == states.LOBBY || curState == states.END) return;
		else if(curState == states.PROMPT_SCORES){
			if(currentPrompt == promptData.length - 1){
				currentPrompt = 0;
				curState = states.SCORES_UNSORTED;
			}
			else{
				currentPrompt++;
				curState = states.CURRENT_PROMPT;
			}
		}
		else if(curState == states.SCORES_SORTED){
			if(round < 2){
				round++;
				curState = states.ROUND_INTRO;
			}
			else curState = states.WINNER;
		}
		else if(curState == states.WINNER){
			this.endGame();
			return;
		}
		else curState++;
		if(curState == states.ANSWER_PROMPTS){
			currentPrompt = 0;
			const allPrompts = round == 0 ? prefs.round_1_prompts : round == 1 ? prefs.round_2_prompts : prefs.final_round_prompts;
			var playerIndices = [];
			for(let i = 0; i < playerIds.length; i++) playerIndices.push(true);
			var playerOrder = [];
			for(let i = 0; i < playerIds.length; i++){
				var r;
				do r = Math.floor(Math.random() * playerIds.length);
				while(!playerIndices[r]);
				playerOrder.push(r);
				playerIndices[r] = false;
			}
			playerData = [];
			if(round < 2){
				var promptIndices = [];
				for(let i = 0; i < allPrompts.length; i++) promptIndices.push(true);
				promptData = [];
				for(let i = 0; i < playerIds.length; i++){
					var r;
					do r = Math.floor(Math.random() * allPrompts.length);
					while(!promptIndices[r]);
					promptData.push({
						prompt: allPrompts[r],
						answers: [],
						player_votes: 0,
						audience_votes: 0,
						no_answer: false,
						jinx: false
					});
					promptIndices[r] = false;
				}
				promptIndices = [];
				for(let i = 0; i < playerIds.length; i++) promptIndices.push(true);
				var promptOrder = [];
				for(let i = 0; i < playerIds.length; i++){
					var r;
					do r = Math.floor(Math.random() * playerIds.length);
					while(!promptIndices[r]);
					promptOrder.push(r);
					promptIndices[r] = false;
				}
				for(let i = 0; i < playerIds.length; i++){
					playerData.push({
						prompts: [],
						answered: 0,
						votes_left: 0,
						score: 0
					});
				}
				for(let i = 0; i < playerIds.length; i++){
					const promptIndex1 = promptOrder[i];
					const promptIndex2 = promptOrder[(i + 1) % playerIds.length];
					const prompt1 = promptData[promptIndex1 < promptIndex2 ? promptIndex1 : promptIndex2];
					const prompt2 = promptData[promptIndex1 > promptIndex2 ? promptIndex1 : promptIndex2];
					playerData[playerOrder[i]].prompts.push(prompt1.prompt);
					playerData[playerOrder[i]].prompts.push(prompt2.prompt);
					prompt1.answers.push({
						player: playerOrder[i],
						answer: false,
						safety: false,
						player_votes: [],
						audience_votes: 0,
						vote_percentage: 0,
						score: 0,
						winner_bonus: false,
						quiplash_bonus: false,
						super_quiplash_bonus: false
					});
					prompt2.answers.push({
						player: playerOrder[i],
						answer: false,
						safety: false,
						player_votes: [],
						audience_votes: 0,
						vote_percentage: 0,
						score: 0,
						winner_bonus: false,
						quiplash_bonus: false,
						super_quiplash_bonus: false
					});
				}
			}
			else{
				var prompt = allPrompts[Math.floor(Math.random() * allPrompts.length)];
				promptData = [{
					prompt: prompt,
					answers: [],
					answered: [],
					player_votes: 0,
					audience_votes: 0
				}];
				for(let i = 0; i < playerIds.length; i++){
					playerData.push({
						prompts: [prompt],
						answered: 0,
						votes_left: 0,
						score: 0
					});
					promptData[0].answers.push({
						player: playerOrder[i],
						answer: false,
						player_votes: [],
						audience_votes: 0,
						vote_percentage: 0,
						score: 0
					});
				}
			}
		}
		else if(curState == states.CURRENT_PROMPT){
			const answers = promptData[currentPrompt].answers;
			var answered = 0;
			var jinx = true;
			var pAnswer = false;
			for(let i = 0; i < answers.length; i++){
				var currentAnswer = answers[i].answer;
				if(currentAnswer){
					answered++;
					if(jinx){
						jinx &= !answers[i].safety && (!pAnswer || currentAnswer == pAnswer);
						pAnswer = currentAnswer;
					}
				}
			}
			if(answered < 2) promptData[currentPrompt].no_answer = true;
			else if(jinx) promptData[currentPrompt].jinx = true;
			else{
				const votesPerPlayer = round < 2 ? 1 : (answered < 4 ? 1 : answered < 5 ? 2 : 3);
				if(round >= 2){
					promptData[currentPrompt].answered = answered;
					promptData[currentPrompt].votes_per_player = votesPerPlayer;
				}
				for(let i = 0; i < playerIds.length; i++){
					var voting = true;
					if(round < 2){
						for(let j = 0; j < answers.length; j++) voting &= i != answers[j].player;
					}
					else if(answered == 2){
						for(let j = 0; j < answers.length; j++) if(answers[j].answer) voting &= i != answers[j].player;
					}
					playerData[i].votes_left = voting ? votesPerPlayer : 0;
				}
				for(var a in audience) if(audience[a] && allUsers[a] && allUsers[a].getAudience()) audience[a].voting = true;
			}
		}
		else if(curState == states.PROMPT_VOTES){
			if(promptData[currentPrompt].no_answer || promptData[currentPrompt].jinx) curState = states.PROMPT_SCORES;
			else{
				const totalPlayerVotes = promptData[currentPrompt].player_votes;
				const totalAudienceVotes = promptData[currentPrompt].audience_votes;
				if(totalPlayerVotes + totalAudienceVotes > 0){
					const answers = promptData[currentPrompt].answers;
					for(let i = 0; i < answers.length; i++){
						const multiplier = (round + 1) * (answers[i].safety ? 0.5 : 1);
						const playerVotes = answers[i].player_votes ? answers[i].player_votes.length : 0;
						const audienceVotes = answers[i].audience_votes;
						if(playerVotes + audienceVotes > 0) answers[i].vote_percentage = Math.floor((playerVotes + audienceVotes) * 100.0 / (totalPlayerVotes + totalAudienceVotes));
					}
					if(round < 2){
						for(let i = 0; i < answers.length; i++){
							const multiplier = (round + 1) * (answers[i].safety ? 0.5 : 1);
							const playerVotes = answers[i].player_votes ? answers[i].player_votes.length : 0;
							const audienceVotes = answers[i].audience_votes;
							if(playerVotes + audienceVotes > 0){
								answers[i].score = Math.floor(multiplier * answers[i].vote_percentage * 10);
								playerData[answers[i].player].score += answers[i].score;
								if(totalPlayerVotes > 2 && playerVotes == totalPlayerVotes && totalAudienceVotes > 0 && audienceVotes == totalAudienceVotes){
									answers[i].super_quiplash_bonus = Math.floor(multiplier * 500);
									playerData[answers[i].player].score += Math.floor(multiplier * 500);
								}
								else if(totalPlayerVotes > 2 && playerVotes == totalPlayerVotes && (totalAudienceVotes == 0 || audienceVotes > totalAudienceVotes / 2)){
									answers[i].quiplash_bonus = Math.floor(multiplier * 250);
									playerData[answers[i].player].score += Math.floor(multiplier * 250);
								}
								else if(playerVotes + audienceVotes > (totalPlayerVotes + totalAudienceVotes) / 2){
									answers[i].winner_bonus = Math.floor(multiplier * 100);
									playerData[answers[i].player].score += Math.floor(multiplier * 100);
								}
							}
						}
					}
					else{
						var indices = {};
						for(let i = 0; i < answers.length; i++) indices[i] = true;
						var order = [];
						for(let i = 0; i < answers.length; i++){
							var maxIndex = 0;
							var maxPercentage = 0;
							for(let j = 0; j < answers.length; j++){
								if(indices[j]){
									var curPercentage = answers[j].vote_percentage;
									if(curPercentage > maxPercentage){
										maxIndex = j;
										maxPercentage = curPercentage;
									}
								}
							}
							order.push(maxIndex);
							indices[maxIndex] = false;
						}
						var maxPercentage = 0;
						var curScore = answers.length * 500;
						for(let i = 0; i < answers.length; i++){
							if(curScore > 0 && answers[order[i]].answer){
								var curPercentage = answers[order[i]].vote_percentage;
								if(curPercentage > 0){
									if(i > 0 && curPercentage < maxPercentage) curScore = (answers.length - i) * 500;
									maxPercentage = curPercentage;
									answers[order[i]].score = curScore;
									playerData[answers[order[i]].player].score = curScore;
								}
								else curScore = 0;
							}
						}
					}
				}
			}
		}
		if(curState == states.PROMPT_SCORES){
			const answers = promptData[currentPrompt].answers;
			if(promptData[currentPrompt].no_answer){
				for(let i = 0; i < answers.length; i++){
					if(answers[i].answer){
						if(round < 2){
							const multiplier = (round + 1) * (answers[i].safety ? 0.5 : 1);
							answers[i].score = Math.floor(multiplier * 1000);
							answers[i].winner_bonus = Math.floor(multiplier * 100);
							playerData[answers[i].player].score += answers[i].winner_bonus;
						}
						else answers[i].score = answers.length * 500;
						playerData[answers[i].player].score += answers[i].score;
					}
				}
			}
			else if(promptData[currentPrompt].jinx && round >= 2){
				var noAnswer = false;
				for(let i = 0; i < answers.length; i++) noAnswer |= !answers[i].answer;
				if(noAnswer){
					for(let i = 0; i < answers.length; i++){
						if(answers[i].answer){
							answers[i].score = answers.length * 500;
							playerData[answers[i].player].score += answers[i].score;
						}
					}
				}
			}
		}
		else if(curState == states.SCORES_SORTED){
			for(let i = 0; i < playerData.length; i++) allUsers[playerIds[i]].addToScore(playerData[i].score);
			sortedPlayers = [];
			var playerIndices = [];
			for(let i = 0; i < playerIds.length; i++) playerIndices.push(true);
			for(let i = 0; i < playerIds.length; i++){
				var maxIndex = 0;
				var maxScore = 0;
				var first = true;
				for(let j = 0; j < playerIds.length; j++){
					if(playerIndices[j]){
						var currentScore = allUsers[playerIds[j]].getScore();
						if(first || currentScore > maxScore){
							first = false;
							maxIndex = j;
							maxScore = currentScore;
						}
					}
				}
				sortedPlayers.push(maxIndex);
				playerIndices[maxIndex] = false;
			}
		}
		gameState.setState(curState, {});
		for(var u in allUsers) if(allUsers[u]) allUsers[u].sendStateUpdate(this.getUserData(u));
	}	
	
	this.receiveAnswer = function(userId, answer){
		if(gameState.get() != states.ANSWER_PROMPTS) return;
		const allUsers = users.getAll();
		const user = allUsers[userId];
		if(!user || !user.getPlayer()) return;
		var player = false;
		for(let i = 0; i < playerIds.length; i++) if(userId == playerIds[i]) player = i;
		if(player === false) return;
		const answered = playerData[player].answered;
		var playerAnswers = 0;
		for(let i = 0; i < promptData.length; i++){
			if(playerAnswers <= answered){
				var currentAnswers = promptData[i].answers;
				for(let j = 0; j < currentAnswers.length; j++){
					if(player == currentAnswers[j].player){
						if(playerAnswers == answered){
							if(answer) currentAnswers[j].answer = answer;
							else{
								const safety = prefs.safety_quips;
								var r;
								do r = Math.floor(Math.random() * safety.length);
								while(safetyQuips[r]);
								currentAnswers[j].answer = safety[r];
								safetyQuips[r] = true;
								currentAnswers[j].safety = true;
							}
						}
						playerAnswers++;
					}
				}
			}
		}
		playerData[player].answered++;
		if(round < 2 && playerData[player].answered < 2) user.sendPrompt(playerData[player].prompts[playerData[player].answered]);
		else{
			for(var u in allUsers) if(allUsers[u] && allUsers[u].getHost()) allUsers[u].sendPlayersUpdate(this.getUserData(allUsers[u].getUniqueId()).players);
		}
	}
	
	this.receiveVote = function(userId, vote){
		if(gameState.get() != states.CURRENT_PROMPT) return;
		const allUsers = users.getAll();
		const user = allUsers[userId];
		if(!user || !user.getPlayer() && !user.getAudience()) return;
		var answer = promptData[currentPrompt].answers[vote];
		if(!answer) return;
		if(user.getPlayer()){
			var player = false;
			for(let i = 0; i < playerData.length; i++) if(userId == playerIds[i]) player = i;
			if(player === false) return;
			promptData[currentPrompt].player_votes++;
			playerData[player].votes_left--;
			answer.player_votes.push(allUsers[playerIds[player]].getName());
			var votesLeft = playerData[player].votes_left;
			if(votesLeft > 0) user.setVotesLeft(votesLeft);
		}
		else if(user.getAudience()){
			promptData[currentPrompt].audience_votes++;
			answer.audience_votes++;
			audience[userId].voting = false;
			for(var u in allUsers) if(allUsers[u] && allUsers[u].getHost()) allUsers[u].setAudienceVotes(promptData[currentPrompt].audience_votes);
		}
	}
	
	this.endGame = function(){
		gameState.setState(states.END, {});
		const allUsers = users.getAll();
		for(var u in allUsers) if(allUsers[u]) allUsers[u].sendStateUpdate(this.getUserData(u));
	}
	
	this.newLobby = function(){
		playerIds = false;
		audience = {};
		currentPrompt = false;
		gameState.setState(states.LOBBY, {});
		const allUsers = users.getAll();
		for(var u in allUsers) if(allUsers[u] && !allUsers[u].getHost()) users.removeUser(u);
		for(var u in allUsers) if(allUsers[u] && allUsers[u].getHost()) allUsers[u].sendStateUpdate(this.getUserData(u));
	}
	
	this.disconnectAll = function(){
		const allUsers = users.getAll();
		for(var u in allUsers) users.removeUser(u);
	}
	
	this.sendUpdates = function(user, params){
		//var summary = gameState.getSummary();
		//user.sendUpdates(summary, params);
	}
	
	setInterval(function(game){
		return function(){
			const allUsers = users.getAll();
			var audienceCount = game.getAudienceCount();
			for(var a in audience){
				if(audience[a] && audience[a].connected && allUsers[a] && allUsers[a].getAudience()){
					audience[a].connected = false;
					allUsers[a].checkAudienceConnection();
				}
			}
			for(var u in allUsers) if(allUsers[u] && allUsers[u].getHost()) allUsers[u].sendAudienceUpdate(audienceCount);
		}
	}(this), 1000);
}

function Users(){
	var users = {};
	
	this.addUser = function(user, gameId){
		var uniqueId = user.getUniqueId();
		if(typeof uniqueId === 'undefined' || !uniqueId) return;
		user.setGameId(gameId);
		users[uniqueId] = user;
	}
	
	this.getUser = function(userId){
		if(userId in users) return users[userId];
		else return false;
	}
	
	this.removeUser = function(userId){
		if(userId in users){
			users[userId].disconnectUser();
			delete users[userId];
			users[userId] = false;
		}
	}
	
	this.getAll = function(){
		return users;
	}
}

function User(pSocket, pName){
	var socket = pSocket;
	
	this.getUniqueId = function(){
		if(socket && socket.handshake && socket.handshake.session && socket.handshake.session.unique_id) return socket.handshake.session.unique_id;
		return false;
	}
	
	if(socket && socket.handshake && socket.handshake.session){
		//if(typeof socket.handshake.session.unique_id === 'undefined'){
		//	console.log('# User connected.');
		//	socket.handshake.session.unique_id = socket.id;
		//}
		console.log('# User connected.');
		socket.handshake.session.unique_id = socket.id;
		
		socket.handshake.session.in_game = true;
		socket.handshake.session.user_id = this.getUniqueId();
		socket.handshake.session.save();
	}
	
	var isHost = pName == 'host';
	var isPlayer;
	var isAudience = pName == 'audience';
	isPlayer = !(isHost || isAudience);
	var name = isPlayer ? pName : false;
	var score = false;
	
	this.getHost = function(){
		return isHost;
	}
	
	this.getPlayer = function(){
		return isPlayer;
	}
	
	this.getAudience = function(){
		return isAudience;
	}
	
	this.getName = function(){
		return name;
	}
	
	this.resetScore = function(){
		score = 0;
	}
	
	this.addToScore = function(s){
		if(isPlayer) score += s;
	}
	
	this.getScore = function(){
		return score;
	}
	
	this.setGameId = function(gameId){
		socket.handshake.session.game_id = gameId;
	}
	
	this.updateSocket = function(pSocket){
		socket = pSocket;
	}
	
	this.disconnectUser = function(){
		socket.handshake.session.in_game = false;
		socket.handshake.session.unique_id = false;
		socket.handshake.session.user_id = false;
		socket.handshake.session.game_id = false;
		socket.handshake.session.save();
		if(isHost) socket.emit('host_init_nok');
		else socket.emit('game_init_nok');
	}
	
	this.sendPlayersUpdate = function(players){
		if(isHost) socket.emit('host_players_update', players);
	}

	this.sendAudienceUpdate = function(audience){
		if(isHost) socket.emit('host_audience_update', audience);
	}

	this.sendStateUpdate = function(params){
		if(isHost) socket.emit('host_state_update', params);
		else socket.emit('game_state_update', params);
	}
	
	this.sendPrompt = function(prompt){
		if(isPlayer) socket.emit('game_receive_prompt', prompt);
	}
	
	this.setVotesLeft = function(votesLeft){
		if(isPlayer || isAudience) socket.emit('game_set_votes_left', votesLeft);
	}
	
	this.setAudienceVotes = function(audienceVotes){
		if(isHost) socket.emit('host_set_audience_votes', audienceVotes);
	}
	
	this.checkAudienceConnection = function(){
		if(isAudience) socket.emit('game_check_audience_connection');
	}
}

function GameState(){
	var curState = false;
	var stateParams = false;
	var hiddenParams = false;
	
	this.get = function(){
		return curState;
	}
	
	this.setState = function(pState, pStateParams){
		curState = pState;
		stateParams = pStateParams;
	}
	
	this.setHiddenParams = function(pHiddenParams){
		hiddenParams = pHiddenParams;
	}
	
	this.getHiddenParams = function(){
		return hiddenParams;
	}
	
	this.getSummary = function(){
		var obj = {};
		obj.state = curState;
		obj.stateParams = stateParams;
		return obj;
	}
}
