import { Vector } from 'omegga';
import Simulator from '..';
import { LogicBrick } from '../util';
import { GateMeta, OutputGate } from './interface';
export default class PixelOutput extends OutputGate {
  static getName = () => 'pixel';
  static getConnectables = () => ({
    output: 1,
  });
  static getDescription = () => 'renders a white pixel when ON';

  static extendMeta(
    meta: GateMeta,
    { markerBricks }: { markerBricks: LogicBrick[] }
  ) {
    const plate = markerBricks[0];
    const up = meta.up([0, 0, 1]);

    meta.output = {
      position: [
        plate.position[0] + up[0] * (plate.normal_size[0] + 3),
        plate.position[1] + up[1] * (plate.normal_size[1] + 3),
        plate.position[2] + up[2] * (plate.normal_size[2] + 3),
      ],
      size: [
        up[0] === 0 ? plate.normal_size[0] : 1,
        up[1] === 0 ? plate.normal_size[1] : 1,
        up[2] === 0 ? plate.normal_size[2] : 1,
      ],
      normal_size: [
        up[0] === 0 ? plate.normal_size[0] : 1,
        up[1] === 0 ? plate.normal_size[1] : 1,
        up[2] === 0 ? plate.normal_size[2] : 1,
      ],
      color: [255, 255, 255],
      collision: {
        tool: false,
        player: false,
        interaction: false,
        weapon: false,
      },
      owner_index: 1,
      material_index: 1,
    };
  }

  tickTerminal: () => true;

  getOutput(sim: Simulator) {
    const orientation = {
      direction: sim.frame % 2 ? 0 : 0,
      rotation: sim.frame % 2 ? 2 : 0,
      size: [0, 0, 0] as Vector,
      position: [0, 0, 0] as Vector,
    };
    const axis = [
      sim.util.brick.getScaleAxis(orientation, 0),
      sim.util.brick.getScaleAxis(orientation, 1),
      sim.util.brick.getScaleAxis(orientation, 2),
    ];

    this.meta.output.asset_name_index = 1;
    this.meta.output.size = [
      this.meta.output.normal_size[axis[0]],
      this.meta.output.normal_size[axis[1]],
      this.meta.output.normal_size[axis[2]],
    ];
    this.meta.output.direction = orientation.direction;
    this.meta.output.rotation = orientation.rotation;

    return [this.meta.output];
  }
}
