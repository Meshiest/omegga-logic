import ChunkTree from '../octtree';

import { UnrealColor, Vector } from 'omegga';
import Gate from './gate';
import { LogicGate, OutputGate } from './gates/interface';
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
  outputs: OutputGate[];
  circuits: number;

  /** order in which gates are simulated */
  gateOrder: number[];

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
    this.entryPoints = new Set();
    this.circuits = 0;

    benchStart('build');

    benchStart('octtree');
    populateTreeFromSave(this.save, this.tree, this.util);
    benchEnd('octtree');

    benchStart('selection');
    // classify each brick from the save
    let unusedBricks = 0;
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
          this.outputs.push(gate as OutputGate);
        }
      }

      // if the brick is a wire, add it to the list of wires
      else if (Wire.isWire(brick, this)) {
        brick.used = true;
        brick.neighbors = new Set();
        brick.wire = this.wires.length;
        this.wires.push(brick);
      } else {
        unusedBricks++;
      }
    }
    benchEnd('selection');

    benchStart('wire groups');
    this.groups = Wire.buildGroups(this);

    const groupToGate: { in: Set<number>; out: Set<number> }[] = Array(
      this.groups.length
    );
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
      for (const group of groups.in) groupToGate[group - 1].out.add(i);
      for (const group of groups.out) groupToGate[group - 1].in.add(i);
    }

    benchEnd('gates');
    benchStart('cycles');

    let cycles = 0;

    this.entryPoints = new Set<number>();
    const gateToGate: { in: Set<number>; out: Set<number> }[] = Array(
      this.gates.length
    );

    // gate to gate links
    for (let i = 0; i < this.gates.length; ++i) {
      const conns = { in: new Set<number>(), out: new Set<number>() };
      // add all output gates for input groups
      for (const inGroup of gateToGroup[i].in) {
        for (const inGate of groupToGate[inGroup - 1].in) {
          conns.in.add(inGate);
        }
      }

      // add all input gates for output groups
      for (const outGroup of gateToGroup[i].out) {
        for (const outGate of groupToGate[outGroup - 1].out) {
          conns.out.add(outGate);
        }
      }

      // no input gates -> this is an entrypoint
      if (conns.in.size === 0 || this.gates[i].isEntryPoint)
        this.entryPoints.add(i);

      gateToGate[i] = conns;
    }

    const gateOrder: number[] = [];

    const sim = this;
    function* getGateOrder(i: number, mode = 3) {
      // iterate all (non entrypoint) nodes before this one
      if (!sim.entryPoints.has(i) && mode & 1) {
        for (const prev of gateToGate[i].in) {
          if (!sim.entryPoints.has(prev)) {
            yield* getGateOrder(prev, 1);
          }
        }
      }

      yield i;

      // iterate all (non entrypoint) nodes after this one
      if (mode & 2) {
        for (const next of gateToGate[i].out) {
          if (!sim.entryPoints.has(next)) {
            yield* getGateOrder(next, 2);
          }
        }
      }
    }

    const visited = new Set<number>();
    /* console.debug(
      '[debug] entries',
      ...[...this.entryPoints].map(
        i => `${i}:${this.gates[i].constructor['getName']()}`
      )
    ); */

    for (const i of this.entryPoints) {
      if (visited.has(i)) continue;
      visited.add(i);

      // ignore standalone gates
      if (gateToGroup[i].in.size === 0 && gateToGroup[i].out.size === 0) {
        this.gates[i].ignore = true;
        continue;
      }

      const seen = new Set<number>();

      const order = getGateOrder(i);
      let path = [];
      let cycle = false;
      for (const gate of order) {
        visited.add(gate);
        path.push(gate);

        if (seen.has(gate)) {
          for (const g of seen) {
            cycles++;
            cycle = true;
            this.gates[g].ignore = true;
            this.errors.push({
              position: this.gates[g].brick.position,
              error: 'cycle detected. add a buffer',
            });
          }
          break;
        }

        seen.add(gate);
      }

      if (!cycle) {
        this.circuits++;
        gateOrder.push(...path);
        /* console.debug(
          '[debug] circuit',
          i,
          'in',
          [...gateToGroup[i].in],
          'out',
          [...gateToGroup[i].out],
          'path',
          ...path.map(i => `${i}:${this.gates[i].constructor['getName']()}`)
        ); */
      }
    }

    this.gateOrder = gateOrder.filter(g => !this.gates[g].ignore);

    benchEnd('cycles');
    benchEnd('build');
    console.info(unusedBricks, 'unused bricks');
    console.info(cycles, 'cycles');
    console.log(' -- build complete');
    return true;
  }

  // set the next power of a group
  setGroupPower(set: Set<number>, value: boolean) {
    if (!set || !value) return;
    // set the groups next power
    for (const o of set) {
      // legacy where each gate took 1 tick to propagate
      // const group = this.groups[o - 1];
      // group.nextPower = group.nextPower || value;
      this.groups[o - 1].currPower ||= value;
    }
  }

  // get inputs from the gate
  getGroupPower(set: Set<number>) {
    return Array.from(set).map(o => this.groups[o - 1].currPower);
  }

  next() {
    // update power states for the group
    for (const group of this.groups) {
      group.currPower = false;
      // group.nextPower = false;
    }

    for (const i of this.gateOrder) {
      const gate = this.gates[i];
      if (gate.ignore) continue;

      // calculate the output
      const output = gate.evaluate(this);

      if (typeof output === 'boolean' && gate.outputs)
        this.setGroupPower(gate.outputs, output !== gate.isInverted());
    }

    for (const gate of this.gates) gate.settle(this);

    /* for (const group of this.groups) {
      group.currPower = false;
      group.nextPower = false;
    } */
  }
}
