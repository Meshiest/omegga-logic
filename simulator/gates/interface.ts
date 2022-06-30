import { Brick, Vector, UnrealColor } from 'omegga';
import Simulator from '..';
import { Point } from '../../octtree';
import { LogicBrick, searchBoundsSide } from '../util';

export type Connectable = {
  min: Point;
  max: Point;
  inverted: boolean;
} & Omit<LogicBrick['tagMatch']['groups'], 'inverted'>;

export type GateMeta = {
  bounds: { min: Point; max: Point };
  inverted: boolean;
  position: Vector;
  up: LogicBrick['up'];
  direction: number;
  connectables?: Record<string, Connectable[]>;
  output?: Partial<LogicBrick>;
  brick_color?: Vector;
};

export type LogicGateStatic = {
  new (brick: LogicBrick, meta: GateMeta): LogicGate;
  getName(): string;
  extendMeta(
    _meta: GateMeta,
    _options: {
      brick: LogicBrick;
      sim: Simulator;
      markerBricks: LogicBrick[];
      markers: Record<string, number>;
    }
  );
  getConnectables(): Record<string, number | ((n: number) => boolean)>;
  validateConnectables(
    connectables: GateMeta['connectables']
  ): string | undefined;
};

export class LogicGate {
  static getName() {
    throw 'unimplemented getName';
  }

  static getConnectables(): Record<string, number | ((n: number) => boolean)> {
    return {};
  }

  // if the brick needs to extend the metadata at build time, it can do it here
  // be careful putting the provided arguments in the meta as it may create a cyclic
  // object which may hurt performance
  static extendMeta(
    _meta: GateMeta,
    _options: {
      brick: LogicBrick;
      sim: Simulator;
      markerBricks: LogicBrick[];
      markers: Record<string, number>;
    }
  ) {}

  brick: LogicBrick;
  gate: string;
  meta: GateMeta;

  outputs: Set<number>;

  // data output
  isOutput = false;

  // user input
  isInput = false;

  // should be an entrypoint for ticks
  isEntryPoint = false;

  // gate was poorly compiled
  ignore = false;

  evaluate(sim: Simulator): boolean | void {
    throw 'unimplemented evaluate';
  }

  // called when the tick finishes
  settle(sim: Simulator): void {}

  constructor(brick: LogicBrick, meta: GateMeta) {
    this.brick = brick;
    this.meta = meta;
    this.gate = this.constructor['getName']();
  }

  /** wire groups this gate will visit this tick */
  getNext(): Set<number> {
    throw 'unimplemented visit';
  }

  /** wire groups this gate will take input from this tick */
  getPrev(): Set<number> {
    throw 'unimplemented visit';
  }

  init() {}
  findConnections(sim: Simulator) {}

  // get inverted state
  isInverted() {
    return this.meta.inverted;
  }
}

// gates specifically for output
export class OutputGate extends LogicGate {
  on: boolean;

  static validateConnectables(
    _connectables: GateMeta['connectables']
  ): undefined {
    return;
  }

  constructor(brick: LogicBrick, meta: GateMeta) {
    super(brick, meta);
    this.isOutput = true;
    this.on = false;
  }

  // outputs do not visit any wires
  getNext(): Set<number> {
    return new Set();
  }

  getPrev(): Set<number> {
    return new Set(this.inputs);
  }

  // get the brick output
  getOutput(sim: Simulator): Partial<Brick>[] {
    return [];
  }

  inputs: Set<number>;

  // output gate evaluations do not need to be re-implemented
  // this sets "on" for the output gate
  evaluate(sim: Simulator): boolean | void {
    // ignore pointless outputs
    if (this.inputs.size === 0) return;
    this.on = sim.getGroupPower(this.inputs).some(s => s);
    return this.on;
  }

  findConnections(sim: Simulator) {
    // output gates only have inputs
    this.inputs = new Set();
    for (let i = 0; i < 4; ++i) {
      for (const j of searchBoundsSide(
        sim.tree,
        this.meta.bounds,
        i,
        this.meta.up
      )) {
        const group = sim.save.bricks[j].group;
        if (group) this.inputs.add(group);
      }
    }
  }
}
// gates specifically for player input
export class InputGate extends LogicGate {
  isEntryPoint = true;

  constructor(brick: LogicBrick, meta: GateMeta) {
    super(brick, meta);
    this.isInput = true;
  }

  static validateConnectables(
    _connectables: GateMeta['connectables']
  ): undefined {
    return;
  }

  getNext(): Set<number> {
    return new Set(this.outputs);
  }

  // inputs do not have any previous groups
  getPrev(): Set<number> {
    return new Set();
  }

  interact() {}
  findConnections(sim: Simulator) {
    // (user) input gates only have outputs as the input is handled by the user
    this.outputs = new Set();
    for (let i = 0; i < 4; ++i) {
      for (const j of searchBoundsSide(
        sim.tree,
        this.meta.bounds,
        i,
        this.meta.up
      )) {
        const group = sim.save.bricks[j].group;
        if (group) {
          this.outputs.add(group);
        }
      }
    }
  }
}

// gates that have special inputs and outputs based on markers
export class SpecialGate extends LogicGate {
  connections: Record<string, (Set<number> & { inverted: boolean })[]>;

  // determine if the provided connectables are OK, return the error otherwise
  static validateConnectables(
    _connectables: GateMeta['connectables']
  ): string | undefined {
    return;
  }

  outputConnectables: string[] = [];

  getNext(): Set<number> {
    return new Set(
      Object.keys(this.connections)
        .flatMap(k =>
          this.outputConnectables.includes(k) ? this.connections[k] : []
        )
        .flatMap(o => [...o])
    );
  }

  getPrev(): Set<number> {
    return new Set(
      Object.keys(this.connections)
        .flatMap(k =>
          this.outputConnectables.includes(k) ? [] : this.connections[k]
        )
        .flatMap(o => [...o])
    );
  }

  findConnections(sim: Simulator) {
    this.connections = {};
    const order = (a: Connectable, b: Connectable) =>
      a.rest.localeCompare(b.rest);

    for (const connType in this.meta.connectables) {
      const nodes = this.meta.connectables[connType];
      const sets = (this.connections[connType] = Array(nodes.length));

      // sort nodes in the order based on direction
      nodes.sort(order);

      const dir = this.meta.direction;

      for (let n = 0; n < nodes.length; ++n) {
        // shifted bound down to gate level
        const bound = {
          min: new Point(
            dir === 0 || dir === 1 ? this.meta.bounds.min.x : nodes[n].min.x,
            dir === 2 || dir === 3 ? this.meta.bounds.min.y : nodes[n].min.y,
            dir === 4 || dir === 5 ? this.meta.bounds.min.z : nodes[n].min.z
          ),
          max: new Point(
            dir === 0 || dir === 1 ? this.meta.bounds.max.x : nodes[n].max.x,
            dir === 2 || dir === 3 ? this.meta.bounds.max.y : nodes[n].max.y,
            dir === 4 || dir === 5 ? this.meta.bounds.max.z : nodes[n].max.z
          ),
        };

        sets[n] = new Set<number>();
        sets[n].inverted = nodes[n].inverted;

        for (let i = 0; i < 4; ++i) {
          for (const j of searchBoundsSide(sim.tree, bound, i, this.meta.up)) {
            const group = sim.save.bricks[j].group;
            if (group) sets[n].add(group);
          }
        }
      }
    }
  }
}

export class SimpleGate extends SpecialGate {
  outputs: Set<number> & { inverted: boolean };

  static getConnectables(): Record<string, number | ((n: number) => boolean)> {
    return { input: 1, output: 1 };
  }

  inputs: Set<number> & { inverted: boolean };
  outputConnectables = ['output'];

  getNext(): Set<number> {
    return new Set(this.outputs);
  }

  getPrev(): Set<number> {
    return new Set(this.inputs);
  }

  // lazy developer moment
  findConnections(sim: Simulator) {
    super.findConnections(sim);
    this.inputs = this.connections.input[0];
    this.outputs = this.connections.output[0];
  }
}
