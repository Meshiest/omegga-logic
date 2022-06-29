import { Vector } from 'omegga';
import Simulator from '..';
import { LogicBrick } from '../util';
import { GateMeta, OutputGate } from './interface';
export default class PixelOutput extends OutputGate {
  static getName = () => '1bitpixel';
  static extendMeta(
    meta: GateMeta,
    { markerBricks }: { markerBricks: LogicBrick[] }
  ) {
    const plate = markerBricks[0];
    meta.output = {
      position: [
        plate.position[0],
        plate.position[1],
        plate.position[2] + plate.normal_size[2] + 3,
      ],
      size: [plate.normal_size[0], plate.normal_size[1], 1],
      normal_size: [plate.normal_size[0], plate.normal_size[1], 1],
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
