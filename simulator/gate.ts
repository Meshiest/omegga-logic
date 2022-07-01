import Simulator from 'simulator';
import { Point } from '../octtree';
import { Connectable, GateMeta, LogicGateStatic } from './gates/interface';
import { LogicBrick } from './util';

export default class Gate {
  // prefix to put on console tag to invert all gate outputs or node input/outputs
  static INVERT_PREFIX = '!';

  static CONSOLE_TAG_PREFIX = 'logic';
  static GATE_PREFIX = 'gate'; // logic:gate:
  static IO_PREFIX = 'io'; // logic:io:

  static REGEX = new RegExp(
    `^(?<inverted>${Gate.INVERT_PREFIX})?${Gate.CONSOLE_TAG_PREFIX}:(?<type>${Gate.GATE_PREFIX}|${Gate.IO_PREFIX}):(?<kind>[^:]+)(:?(?<rest>.+))?$`,
    'i'
  );

  // map brick assets to gates
  static gateMap: Record<string, LogicGateStatic> = {};

  // add the gate to the gate map
  static registerGate(gate: LogicGateStatic) {
    this.gateMap[gate.getName()] = gate;
  }

  // determine if a brick is a wire
  static isGate(brick: LogicBrick, sim: Simulator) {
    return brick.tagMatch?.groups?.type === Gate.GATE_PREFIX
      ? this.assemble(brick, sim)
      : null;
  }

  // find bricks above this brick that have the same material and color
  static getAboveBricks(brick: LogicBrick, sim: Simulator) {
    // get upward vector relative to this brick
    const upTransform =
      OMEGGA_UTIL.brick.BRICK_CONSTANTS.translationTable[
        OMEGGA_UTIL.brick.d2o(brick.direction, 0)
      ];
    const up = upTransform([0, 0, 1]);
    brick.up = upTransform;

    // find all bricks above this brick
    const aboveBrickIndices = sim.tree.search(
      new Point(
        brick.bounds.min.x + (up[0] < 0 ? up[0] : 0),
        brick.bounds.min.y + (up[1] < 0 ? up[1] : 0),
        brick.bounds.min.z + (up[2] < 0 ? up[2] : 0)
      ),
      new Point(
        brick.bounds.max.x + (up[0] > 0 ? up[0] : 0),
        brick.bounds.max.y + (up[1] > 0 ? up[1] : 0),
        brick.bounds.max.z + (up[2] > 0 ? up[2] : 0)
      )
    );

    // get valid bricks from the above bricks
    const bricks: LogicBrick[] = [];
    for (const i of aboveBrickIndices) {
      const above = sim.save.bricks[i];
      if (above !== brick && above.tagMatch?.groups?.type === Gate.IO_PREFIX) {
        above.used = true;
        bricks.push(above);
      }
    }

    return bricks;
  }

  // extract gate type from a brick
  static assemble(brick: LogicBrick, sim: Simulator) {
    const inverted = Boolean(brick.tagMatch.groups.inverted);

    const gateType = brick.tagMatch.groups.kind;

    const NewGate: LogicGateStatic = this.gateMap[gateType];

    if (!NewGate) return `invalid gate type ${gateType}`;

    // detect marker brick assets
    const aboveBricks = this.getAboveBricks(brick, sim);

    // get the brick assets from the marker bricks
    const markers: Record<string, number> = {};
    for (const b of aboveBricks) {
      const asset = sim.save.brick_assets[b.asset_name_index];
      markers[asset] = (markers[asset] || 0) + 1;
    }

    // ignore empty markers
    // if (!aboveBricks.length) return 'missing IO bricks on gate';

    const connectables: Record<string, Connectable[]> = {};

    // find the meaningful markers
    const requirements = NewGate.getConnectables();
    for (const ioType in requirements) {
      const req = requirements[ioType];
      const items = aboveBricks.filter(b => b.tagMatch.groups.kind === ioType);

      if (
        typeof req === 'function' ? !req(items.length) : req !== items.length
      ) {
        return `${NewGate.getName()}: unsatisifed '${ioType}' IO`;
      }
      connectables[ioType] = items.map(i => ({
        brick: i,
        ...i.bounds,
        ...i.tagMatch.groups,
        inverted: Boolean(i.tagMatch.groups.inverted),
      }));
    }
    const err = NewGate.validateConnectables?.(connectables);
    if (err) {
      return `${NewGate.getName()}: invalid connections: ${err}`;
    }

    const meta: GateMeta = {
      bounds: brick.bounds,
      position: brick.position,
      up: brick.up,
      direction: brick.direction,
      inverted,
      connectables,
    };

    NewGate.extendMeta(meta, {
      brick,
      sim,
      markerBricks: aboveBricks,
      markers,
    });

    return new NewGate(brick, meta);
  }
}
