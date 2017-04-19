/* A constructor for the Agent
 * g: GameManager. Will be used to procure information about the game
 */
function Agent(g) {
	// Set up values
	this.game = g;
	this.events = {};
	let prevQ = this.game.storageManager.getQData();
	this.Q = prevQ ? prevQ : {};
	this.gamma = 0.7;

	// Start the agent as a coroutine
	this.start();
}

/* Sets a callback for an event
 * event: Event. The event to set a callback for.
 * callback: Function. The callback to be set.
 */
Agent.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

/* Emits a signal from this class
 * event: Event. The event to emit a signal from.
 * data: Any. The data to be emitted in the signal.
 */
Agent.prototype.emit = function (event, data) {
	var callbacks = this.events[event];
	if (callbacks) {
		callbacks.forEach(function (callback) {
			callback(data);
		});
	}
};

/* Starts the agent running
 */
Agent.prototype.start = function() {
	// To avoid name conflicts within code blocks, use self
	var self = this;

	// Use an interval so that a timestep triggers a move
	setInterval(function() {
		// If the game is over, restart
		if (self.game.isGameTerminated()) {
			self.emit("restart");
			// Store our training data at this point as well
			self.game.storageManager.setQData(self.Q);
			// Don't do anything else if we restarted
			return;
		}

		// Call to Q learning algorithm to get the best move
		let move = self.Qlearn();

		// Emit the move to make it happen
		self.emit("move", move);
	}, 10);
};

/* Qlearning algorithm behind the agent
 * return: Int. An integer representing the move with the best Q value.
 */
Agent.prototype.Qlearn = function() {
	// Keep track of best Q value and corresponding move
	let best = -1;
	let bestQ = -1;

	// Convert the grid to a string for our game state
	let gridString = this.game.grid.toString();

	// If the Q matrix has not seen this game state, set all Q values to 0 for it
	if (!this.Q[gridString]) {
		this.Q[gridString] = [0, 0, 0, 0];
	}

	// Check all possible actions (up, down, left, right)
	for (let action = 0; action < 4; action++) {
		// Precalculate the next board state
		let next = this.precalc(action);

		// Calculate Q value using formula assuming learning rate of 1, then store
		let qValue = this.Q[gridString][action];
		qValue += this.reward(next);
		qValue += this.gamma * this.maxQ(next.grid);
		this.Q[gridString][action] = qValue;

		// If current Q value is better than the best, use this action
		if (bestQ == -1 || qValue > bestQ) {
			best = action;
			bestQ = qValue;
		}
	}

	// Return the best action
	return best;
};

/* Precalculates the next game state after a given action
 * action: Int. An integer representing the move to be made.
 * return: GameManager. The next expected game state after the action.
 */
Agent.prototype.precalc = function(action) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this.game.clone();

  if (self.isGameTerminated()) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = self.getVector(action);
  var traversals = self.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  self.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value * 2);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty 2048 tile
          if (merged.value === 2048) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    self.moved = true;
  } else {
  	self.moved = false;
  }

  return self;
}

/* Calculates the reward for moving to a given game state
 * game: GameManager. The game state to find a reward for.
 * return: Int. An integer value representing the reward.
 */
Agent.prototype.reward = function(game) {
	// If the move was invalid, ignore it by returning -1
	if (!game.moved)
		return -1;
	// Otherwise multiply the score gain by .6 and add it to the change in best tile
	return .6 * (game.score - this.game.score) + this.bestTile(game.grid.cells) - this.bestTile(this.game.grid.cells);
};

/* Find the best Q value for a given game state.
 * grid: Grid. The grid representing the game state for the Q values.
 * return: Int. The best Q value for the given game state.
 */
Agent.prototype.maxQ = function(grid) {
	// If the Q matrix hasn't seen the game state, the best is 0
	if (!this.Q[grid.toString()]) {
		return 0;
	}

	// Otherwise keep track of the best Q and iterate
	let bestQ = -1;
	for (let action = 0; action < 4; action++) {
		if (bestQ == -1 || this.Q[grid.toString()][action] > bestQ) {
			bestQ = this.Q[grid.toString()][action];
		}
	}
	return bestQ;
};

/* Finds the value of the best tile in a given grid.
 * grid: Grid. The grid to be searched through.
 * return: Int. The value of the best tile in a given grid.
 */
Agent.prototype.bestTile = function(grid) {
	// The worst tile has value 2, so keep track from there.
	best = 2;
	for (let i = 0; i < grid.length; i++) {
		for (let j = 0; j < grid[i].length; j ++) {
			// If you find a better one, update.
			if (grid[i][j] && grid[i][j].value > best) {
				best = grid[i][j].value
			}
		}
	}

	return best;
};
