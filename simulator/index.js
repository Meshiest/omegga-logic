const ChunkTree = require('../octtree.js');
const { Point } = ChunkTree;

const {
  benchStart, benchEnd,
  populateTreeFromSave,
} = require('./util.js');
const Wire = require('./wire.js');
const Gate = require('./gate.js');

Gate.registerGate(require('./gates/gate_and.js'));
Gate.registerGate(require('./gates/gate_or.js'));
Gate.registerGate(require('./gates/gate_xor.js'));
Gate.registerGate(require('./gates/gate_buffer.js'));

Gate.registerGate(require('./gates/input_button.js'));
Gate.registerGate(require('./gates/input_lever.js'));

// logic simulator
module.exports = class Simulator {
  constructor(save, util) {
    this.util = util;
    this.frame = 0;
    this.save = save;
    this.colors = save.colors;
    this.tree = new ChunkTree(-1);
    this.compile();
  }

  compile() {
    this.wires = [];
    this.groups = [];
    this.gates = [];

    benchStart('build');

    benchStart('octtree');
    populateTreeFromSave(this.save, this.tree, this.util);
    benchEnd('octtree');

    benchStart('selection');
    // classify each brick from the save
    for (let i = 0; i < this.save.brick_count; ++i) {
      const brick = this.save.bricks[i];
      // if a brick is a gate, store the gate
      const gate = Gate.isGate(brick, this);
      if (gate) {
        brick.used = true;
        brick.gate = this.gates.length;
        gate.brick = i;
        this.gates.push(gate);
      }

      // if the brick is a wire, add it to the list of wires
      else if (Wire.isWire(brick, this)) {
        brick.used = true;
        brick.neighbors = new Set();
        brick.wire = this.wires.length;
        this.wires.push(brick);
      }
    }
    benchEnd('selection');

    benchStart('garbage');
    let count = 0;
    for (const b of this.save.bricks) {
      if (!b.used) {
        delete b.bounds;
        delete b.normal_size;
        delete b.size;
        delete b.position;
        ++count;
      }
    }
    benchEnd('garbage');

    benchStart('wire groups');
    this.groups = Wire.buildGroups(this);
    benchEnd('wire groups');

    benchStart('gates');
    // find appropriate connections to the gates
    for (let i = 0; i < this.gates.length; ++i) {
      const gate = this.gates[i];
      gate.findConnections(this);
    }
    benchEnd('gates');
    benchEnd('build');
    console.info(count, 'unused bricks');
  }

  next() {
    ++this.frame;
    for (const gate of this.gates) {
      // skip pointless gates
      if (gate.ignore) continue;

      // calculate the output
      const output = gate.evaluate(this) != gate.isInverted();

      // output if the gate has an output
      if (gate.outputs) {
        // set the output groups powers
        for (const o of gate.outputs) {
          const group = this.groups[o-1];
          group.nextPower = group.nextPower || output;
        }
      }
    }

    // update power states for the group
    for (const group of this.groups) {
      group.currPower = group.nextPower;
      group.nextPower = false;
    }
  }
};