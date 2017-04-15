function Agent(g) {
	this.game = g;
	this.events = {};
	let prevQ = this.game.storageManager.getQData();
	this.Q = prevQ ? prevQ : {};
	this.gamma = 0.7;

	this.start();
}

Agent.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

Agent.prototype.emit = function (event, data) {
	var callbacks = this.events[event];
	if (callbacks) {
		callbacks.forEach(function (callback) {
			callback(data);
		});
	}
};

Agent.prototype.start = function() {
	var self = this;

    setInterval(function() {
		if (self.game.isGameTerminated()) {
			self.emit("restart");
			return;
		}

		let move = self.Qlearn();
		self.game.storageManager.setQData(self.Q);

		self.emit("move", move);
	}, 10);
};

Agent.prototype.Qlearn = function() {
	let best = -1;
	let bestQ = -1;

	let gridString = this.game.grid.toString();

	if (!this.Q[gridString]) {
		this.Q[gridString] = [0, 0, 0, 0];
	}

	for (let action = 0; action < 4; action++) {
		let next = this.precalc(action);

		let qValue = this.Q[gridString][action];
		qValue += this.reward(next);
		qValue += this.gamma * this.maxQ(next.grid);
		this.Q[gridString][action] = qValue;

		if (bestQ == -1 || qValue > bestQ) {
			best = action;
			bestQ = qValue;
		}
	}

	return best;
};

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

Agent.prototype.reward = function(game) {
	if (!game.moved)
		return -1;
	return .6 * (game.score - this.game.score) + this.bestTile(game.grid.cells) - this.bestTile(this.game.grid.cells);
};

Agent.prototype.maxQ = function(grid) {
	if (!this.Q[grid.toString()]) {
		return 0;
	}

	let bestQ = -1;
	for (let action = 0; action < 4; action++) {
		if (bestQ == -1 || this.Q[grid.toString()][action] > bestQ) {
			bestQ = this.Q[grid.toString()][action];
		}
	}
	return bestQ;
};

Agent.prototype.bestTile = function(grid) {
	best = 2;
	for (let i = 0; i < grid.length; i++) {
		for (let j = 0; j < grid[i].length; j ++) {
			if (grid[i][j] && grid[i][j].value > best) {
				best = grid[i][j].value
			}
		}
	}

	return best;
};