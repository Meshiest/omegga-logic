const { searchBoundsSide } = require('../util.js');
const { Point } = require('../../octtree.js');

class LogicGate {
  static getMarker() { throw 'unimplemented getMarker'; }
  static getMarkerCount() { return 1; }
  static getName() { throw 'unimplemented getName'; }

  // if the brick needs to extend the metadata at build time, it can do it here
  // be careful putting the provided arguments in the meta as it may create a cyclic
  // object which may hurt performance
  static extendMeta(meta, {brick, sim, markerBricks, markers, indicator}) {}
  evaluate(sim) { throw 'unimplemented evaluate'; }

  constructor(brick, meta) {
    this.brick = brick;
    this.meta = meta;
    this.gate = this.constructor.getName();
  }
  init() {}
  findConnections(sim) {}

  // get inverted state
  isInverted() { return this.meta.inverted; }
}

// gates specifically for output
class OutputGate extends LogicGate {
  constructor(brick, meta) {
    super(brick, meta);
    this.isOutput = true;
    this.on = false;
  }

  // get the brick output
  getOutput() { return []; }

  // output gate evaluations do not need to be re-implemented
  // this sets "on" for the output gate
  evaluate(sim) {
    // ignore pointless outputs
    if (this.inputs.size === 0) return;
    this.on = sim.getGroupPower(this.inputs).some(s => s);
  }

  findConnections(sim) {
    // output gates only have inputs
    this.inputs = new Set();
    for (let i = 0; i < 4; ++i) {
      for (const j of searchBoundsSide(sim.tree, this.meta.bounds, i)) {
        const group = sim.save.bricks[j].group;
        if (group) {
          this.inputs.add(group);
        }
      }
    }
  }
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
    for (let i = 0; i < 4; ++i) {
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

    for (let i = 0; i < 4; ++i) {
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
  // determine if the provided connectables are OK, return the error otherwise
  static validateConnectables(markers) { return; };
  findConnections(sim) {
    this.connections = {};
    const order = [
      (a, b) => (a.min.y - b.min.y) || (a.min.x - b.min.x) || 0,
      (a, b) => (b.min.x - a.min.x) || (a.min.y - b.min.y) || 0,
      (a, b) => (b.min.y - a.min.y) || (b.min.x - a.min.x) || 0,
      (a, b) => (a.min.x - b.min.x) || (b.min.y - a.min.y) || 0,
    ][this.meta.direction];

    for (const connType in this.meta.connectables) {
      const nodes = this.meta.connectables[connType];
      const sets = this.connections[connType] = Array(nodes.length);

      // sort nodes in the order based on direction
      nodes.sort(order);

      for (let n = 0; n < nodes.length; ++n) {
        // shifted bound down to gate level
        const bound = {
          min: new Point(nodes[n].min.x, nodes[n].min.y, this.meta.bounds.min.z),
          max: new Point(nodes[n].max.x, nodes[n].max.y, this.meta.bounds.max.z),
        };

        sets[n] = new Set();
        sets[n].inverted = nodes[n].inverted;
        for (let i = 0; i < 4; ++i) {
          for (const j of searchBoundsSide(sim.tree, bound, i)) {
            const group = sim.save.bricks[j].group;
            if (group) {
              sets[n].add(group);
            }
          }
        }
      }
    }
  }
}

module.exports = {
  LogicGate,
  OutputGate, InputGate, SimpleGate, SpecialGate,
};