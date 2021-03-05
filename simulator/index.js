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

Gate.registerGate(require('./gates/output_pixel.js'));

Gate.registerSpecial(require('./gates/latch_sr.js'));
Gate.registerSpecial(require('./gates/flipflop_d.js'));
Gate.registerSpecial(require('./gates/flipflop_jk.js'));
Gate.registerSpecial(require('./gates/adder.js'));

Gate.registerSpecial(require('./gates/multiplexer.js'));
Gate.registerSpecial(require('./gates/memory.js'));

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
    console.log(' -- build started');
    this.wires = [];
    this.groups = [];
    this.gates = [];
    this.outputs = [];
    this.errors = [];

    benchStart('build');

    benchStart('octtree');
    populateTreeFromSave(this.save, this.tree, this.util);
    benchEnd('octtree');

    benchStart('selection');
    // classify each brick from the save
    for (let i = 0; i < this.save.bricks.length; ++i) {
      const brick = this.save.bricks[i];
      // if a brick is a gate, store the gate
      const gate = Gate.isGate(brick, this);
      if (gate !== 'error' && gate) {
        brick.used = true;
        brick.gate = this.gates.length;
        gate.brick = i;
        this.gates.push(gate);
        if (gate.isOutput) {
          this.outputs.push(gate);
        }
      }

      // if the brick is a wire, add it to the list of wires
      else if (Wire.isWire(brick, this)) {
        brick.used = true;
        brick.neighbors = new Set();
        brick.wire = this.wires.length;
        this.wires.push(brick);
      }

      if (gate === 'error') {
        this.errors.push(brick.position);
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
      gate.init();
    }
    benchEnd('gates');
    benchEnd('build');
    console.info(count, 'unused bricks');
    console.log(' -- build complete');
  }

  // set the next power of a group
  setGroupPower(set, value) {
    if (!set || !value) return;
    // set the groups next power
    for (const o of set) {
      const group = this.groups[o-1];
      group.nextPower = group.nextPower || value;
    }
  }

  // get inputs from the gate
  getGroupPower(set) {
    const group = Array.from(set)
    for (let i = 0; i < group.length; ++i) {
      group[i] = this.groups[group[i]-1].currPower;
    }
    return group;
  }

  next() {
    ++this.frame;
    for (const gate of this.gates) {
      // skip pointless gates
      if (gate.ignore) continue;

      // calculate the output
      const output = gate.evaluate(this) != gate.isInverted();

      if (typeof output === 'boolean')
        this.setGroupPower(gate.outputs, output);
    }

    // update power states for the group
    for (const group of this.groups) {
      group.currPower = group.nextPower;
      group.nextPower = false;
    }
  }
};