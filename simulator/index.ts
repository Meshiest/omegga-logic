import ChunkTree from '../octtree';

import { UnrealColor, Vector } from 'omegga';
import Gate from './gate';
import { LogicGate } from './gates/interface';
import {
  benchEnd,
  benchStart,
  LogicBrick,
  LogicBRS,
  populateTreeFromSave,
} from './util';
import Wire from './wire';

import AndGate from './gates/gate_and';
Gate.registerGate(AndGate);

import OrGate from './gates/gate_or';
Gate.registerGate(OrGate);

import XorGate from './gates/gate_xor';
Gate.registerGate(XorGate);

import BufferGate from './gates/gate_buffer';
Gate.registerGate(BufferGate);

import ButtonInput from './gates/input_button';
Gate.registerGate(ButtonInput);

import LeverInput from './gates/input_lever';
Gate.registerGate(LeverInput);

import PixelOutput from './gates/output_pixel';
Gate.registerGate(PixelOutput);

// old registerSpecial
import SRGate from './gates/latch_sr';
Gate.registerGate(SRGate);

import DataGate from './gates/flipflop_d';
Gate.registerGate(DataGate);

import JKGate from './gates/flipflop_jk';
Gate.registerGate(JKGate);

import AdderGate from './gates/adder';
Gate.registerGate(AdderGate);

import MuxGate from './gates/multiplexer';
Gate.registerGate(MuxGate);

import MemoryGate from './gates/memory';
Gate.registerGate(MemoryGate);

import RGBOutput from './gates/output_rgb';
Gate.registerGate(RGBOutput);

// logic simulator
export default class Simulator {
  util: typeof OMEGGA_UTIL;
  hideWires: boolean;
  frame: number;
  save: LogicBRS;
  colors: UnrealColor[];
  tree: ChunkTree<number>;
  gates: LogicGate[];
  outputs: LogicGate[];

  entryPoints: Set<number>;

  wires: LogicBrick[];
  groups: ReturnType<typeof Wire.buildGroups>;
  errors: { position: Vector; error: string }[];

  constructor(save: LogicBRS, util: typeof OMEGGA_UTIL) {
    this.util = util;
    this.hideWires = false;
    this.frame = 0;
    this.save = save;
    this.colors = save.colors;
    this.tree = new ChunkTree(-1);
    this.compile();
  }

  showWires(val) {
    this.hideWires = !val;
  }

  incFrame() {
    ++this.frame;
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

      if (typeof gate === 'string') {
        this.errors.push({ position: brick.position, error: gate });
        console.warn('!!', gate, '@', brick.position);
        continue;
      }

      if (gate) {
        brick.used = true;
        brick.gate = this.gates.length;
        gate.brick = brick;
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
    const groupToGate: { in: Set<number>; out: Set<number> }[] = Array(
      this.groups.length
    );
    this.groups = Wire.buildGroups(this);
    for (let i = 0; i < this.groups.length; ++i)
      groupToGate[i] = { in: new Set(), out: new Set() };

    benchEnd('wire groups');

    benchStart('gates');
    const gateToGroup: { in: Set<number>; out: Set<number> }[] = Array(
      this.gates.length
    );

    // find appropriate connections to the gates
    for (let i = 0; i < this.gates.length; ++i) {
      const gate = this.gates[i];
      gate.findConnections(this);
      gate.init();

      // iterate adjacent groups
      const groups = {
        out: gate.getNext(),
        in: gate.getPrev(),
      };

      gateToGroup[i] = groups;

      // link other groups
      for (const group of groups.in) groupToGate[group].out.add(i);
      for (const group of groups.out) groupToGate[group].in.add(i);
    }

    benchEnd('gates');
    benchStart('cycles');

    this.entryPoints = new Set<number>();
    const gateToGate: { in: Set<number>; out: Set<number> }[] = Array(
      this.gates.length
    );

    // gate to gate links
    for (let i = 0; i < this.gates.length; ++i) {
      const conns = { in: new Set<number>(), out: new Set<number>() };
      // add all output gates for input groups
      for (const inGroup of gateToGroup[i].in)
        for (const outGate of groupToGate[inGroup].out) conns.in.add(outGate);

      // add all input gates for output groups
      for (const outGroup of gateToGroup[i].out)
        for (const inGate of groupToGate[outGroup].in) conns.out.add(inGate);

      // no input gates -> this is an entrypoint
      if (conns.in.size === 0) this.entryPoints.add(i);

      gateToGate[i] = conns;
    }

    type GateOrder = { index: number; next: GateOrder[] };
    const gateOrder: GateOrder[] = [];

    const visitedGates = new Set<number>(this.entryPoints);
    const finishedGates = new Set<number>();
    let cycleDetected = false;

    // TODO: finish cycle detection
    /* const queue = [...this.entryPoints];
    while (queue.length > 0) {
      const i = queue.shift();
      if (finishedGates.has(i)) continue;

      if ([...gateToGate[i].in].every(g => finishedGates.has(g)))

      for (const next of gateToGate[i].out) {

      }
    } */

    benchEnd('cycles');
    benchEnd('build');
    console.info(count, 'unused bricks');
    console.log(' -- build complete');

    if (cycleDetected) return false;
    return true;
  }

  // set the next power of a group
  setGroupPower(set: Set<number>, value: boolean) {
    if (!set || !value) return;
    // set the groups next power
    for (const o of set) {
      const group = this.groups[o - 1];
      group.nextPower = group.nextPower || value;
    }
  }

  // get inputs from the gate
  getGroupPower(set: Set<number>) {
    return Array.from(set).map(o => this.groups[o - 1].currPower);
  }

  next() {
    for (const gate of this.gates) {
      // calculate the output
      const output = gate.evaluate(this);

      if (typeof output === 'boolean' && gate.outputs) {
        this.setGroupPower(gate.outputs, output !== gate.isInverted());
      }
    }

    // update power states for the group
    for (const group of this.groups) {
      group.currPower = group.nextPower;
      group.nextPower = false;
    }
  }
}
