const { searchBoundsSide } = require('../util.js');

class LogicGate {
  static getMarker() { throw 'unimplemented getMarker'; }
  static getName() { throw 'unimplemented getName'; }
  static isValid(brick, markers, sim) { throw 'unimplemented isValid'; }
  evaluate(sim) { throw 'unimplemented evaluate'; }

  constructor(brick, meta) {
    this.brick = brick;
    this.meta = meta;
    this.gate = this.constructor.getName();
  }
  findConnections(sim) {}

  // get inputs from the gate
  getGroupPowers(set, sim) { return Array.from(set).map(i => sim.groups[i-1].currPower); }

  // get inverted state
  isInverted() { return this.meta.inverted; }
}

// gates specifically for output
class OutputGate extends LogicGate {
  // unimplemented
}
  // gates specifically for player input
class InputGate extends LogicGate {
  constructor(brick, meta) {
    super(brick, meta);
    this.isInput = true;
  }

  interact() {}
  findConnections(sim) {
     // (user) input gates only have outputs as the input is handled by the user
    this.outputs = new Set();
    for (let i = 0; i < 4; i++) {
      for (const j of searchBoundsSide(sim.tree, this.meta.bounds, i)) {
        const group = sim.save.bricks[j].group;
        if (group) {
          this.outputs.add(group);
        }
      }
    }
  }
}
  // gates that have an output on one side and inputs on another
class SimpleGate extends LogicGate {
  findConnections(sim) {
    // simple gates have inputs and ouputs. the output side is in the direction of the gate
    this.outputs = new Set();
    this.inputs = new Set();

    for (let i = 0; i < 4; i++) {
      for (const j of searchBoundsSide(sim.tree, this.meta.bounds, i)) {
        const group = sim.save.bricks[j].group;
        if (group) {
          this[i === this.meta.direction ? 'outputs' : 'inputs'].add(group);
        }
      }
    }
  }
}
  // gates that have special inputs and outputs based on markers
class SpecialGate extends LogicGate {
  static getConnectables() { return {}; };
}

module.exports = {
  LogicGate,
  OutputGate, InputGate, SimpleGate, SpecialGate,
};