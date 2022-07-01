import ChunkTree from 'octtree';
import {
  Brick,
  BrickV10,
  BrsV10,
  ReadSaveObject,
  UnrealColor,
  Vector,
} from 'omegga';

import { Point } from '../octtree';
import Gate from './gate';
import { Connectable } from './gates/interface';
import Wire from './wire';

export interface LogicBrick extends BrickV10 {
  normal_size?: Vector;
  bounds?: { min: Point; max: Point };
  tagMatch?: RegExpMatchArray & {
    groups: {
      inverted?: string;
      type: string;
      rest: string;
      kind: string;
    };
  };

  group?: number;

  // when consumed by the parser
  used?: true;

  gate?: number;

  // available on gates, transforms a vector based on brick's up vector
  up?: (a: Vector) => Vector;

  neighbors?: Set<number>;
  wire?: number;
  ownerGate?: number;
  ioIndex?: number;
  ioType?: string;
}

export interface LogicBRS extends BrsV10 {
  materials: string[];
  bricks: LogicBrick[];
}

// benchmarking
const times = {};
export const benchStart = (name: string) => (times[name] = Date.now());
export const benchEnd = (name: string) =>
  console.info(name, 'took', (Date.now() - times[name]) / 1000 + 's');

// check an asset/material for a match
export const isAsset = (save: LogicBRS, brick: Brick, name: string) =>
  save.brick_assets[brick.asset_name_index] === name;
export const isMaterial = (save: LogicBRS, brick: Brick, name: string) =>
  save.materials[brick.material_index] === name;
export const isBlack = ([r, g, b]: UnrealColor) => !r && !g && !b;

// convert a save to an octtree
export const populateTreeFromSave = (
  save: LogicBRS,
  tree: ChunkTree<number>,
  util: typeof OMEGGA_UTIL
) => {
  for (let i = 0; i < save.bricks.length; i++) {
    const brick = save.bricks[i];
    // get normalized sizes for every brick
    const normal_size = util.brick.getBrickSize(brick, save.brick_assets);
    const size = [
      normal_size[util.brick.getScaleAxis(brick, 0)],
      normal_size[util.brick.getScaleAxis(brick, 1)],
      normal_size[util.brick.getScaleAxis(brick, 2)],
    ];

    // build boundaries from the normalized size
    brick.bounds = {
      min: new Point(
        brick.position[0] - size[0],
        brick.position[1] - size[1],
        brick.position[2] - size[2]
      ),
      max: new Point(
        brick.position[0] + size[0],
        brick.position[1] + size[1],
        brick.position[2] + size[2]
      ),
    };
    brick.normal_size = size as Vector;
    brick.tagMatch = brick.components.BCD_Interact?.ConsoleTag.match(
      Gate.REGEX
    ) as LogicBrick['tagMatch'];

    // skip non logic bricks
    if (!Wire.isWire(brick, save) && !brick.tagMatch) continue;

    tree.insert(i, brick.bounds.min, brick.bounds.max);
  }
};

// search a specific side of a brick
export const searchBoundsSide = (
  tree: ChunkTree<number>,
  bounds: { max: Point; min: Point },
  side: number,
  up: (a: Vector) => Vector
) => {
  let a: Vector, b: Vector;
  let axis = 0;
  switch (side) {
    case 0:
      // search x positive
      a = [0, 0, 0];
      b = [1, 0, 0];
      break;
    case 1:
      // search y positive
      a = [0, 0, 0];
      b = [0, 1, 0];
      break;
    case 2:
      // search x negative
      a = [-1, 0, 0];
      b = [0, 0, 0];
      break;
    case 3:
      // search y negative
      a = [0, -1, 0];
      b = [0, 0, 0];
      break;
    default:
      return new Set<number>();
  }

  a = up(a);
  b = up(b);

  return tree.search(
    new Point(
      bounds[b[0] > 0 ? 'max' : 'min'].x + a[0],
      bounds[b[1] > 0 ? 'max' : 'min'].y + a[1],
      bounds[b[2] > 0 ? 'max' : 'min'].z + a[2]
    ),
    new Point(
      bounds[a[0] < 0 ? 'min' : 'max'].x + b[0],
      bounds[a[1] < 0 ? 'min' : 'max'].y + b[1],
      bounds[a[2] < 0 ? 'min' : 'max'].z + b[2]
    )
  );
};

// get direction index from two positions
export const getDirection = (a: number[], b: number[]) =>
  Math.floor((Math.atan2(a[1] - b[1], a[0] - b[0]) / Math.PI) * 2 + 2);
