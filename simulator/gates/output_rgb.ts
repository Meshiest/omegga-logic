import { Vector, UnrealColor } from 'omegga';
import Simulator from '..';
import { LogicBrick } from '../util';
import { GateMeta, SpecialGate } from './interface';
import PixelOutput from './output_pixel';
export default class RGBOutput extends SpecialGate {
  static getName = () => 'rgbpixel';
  static getDescription = () =>
    'renders a colored pixel when write is ON (if present) based on the inputs being split in to R, G, and B sections.';

  static validateConnectables(markers: GateMeta['connectables']) {
    if (markers.color.length % 3 !== 0) return `#color must be divisible by 3`;
    return;
  }

  static getConnectables = () => ({
    color: (n: number) => n >= 0 && n <= 24, // colors
    write: (n: number) => n <= 1, // on
  });

  static extendMeta(
    meta: GateMeta,
    { brick, sim }: { brick: LogicBrick; sim: Simulator }
  ) {
    const up = meta.up([0, 0, 1]);

    meta.output = {
      position: [
        brick.position[0] + up[0] * (brick.normal_size[0] + 7),
        brick.position[1] + up[1] * (brick.normal_size[1] + 7),
        brick.position[2] + up[2] * (brick.normal_size[2] + 7),
      ],
      size: [
        up[0] === 0 ? brick.normal_size[0] + 5 : 1,
        up[1] === 0 ? brick.normal_size[1] + 5 : 1,
        up[2] === 0 ? brick.normal_size[2] + 5 : 1,
      ],
      normal_size: [
        up[0] === 0 ? brick.normal_size[0] + 5 : 1,
        up[1] === 0 ? brick.normal_size[1] + 5 : 1,
        up[2] === 0 ? brick.normal_size[2] + 5 : 1,
      ],
      color: [255, 255, 255],
      collision: {
        tool: false,
        player: false,
        interaction: false,
        weapon: false,
      },
      owner_index: 1,
      material_intensity: 0,
      material_index: 1,
    };
    meta.brick_color = sim.save.colors[brick.color as number].slice(
      0,
      3
    ) as Vector;
  }

  on: boolean;
  color: Vector;
  getOutput: PixelOutput['getOutput'];

  constructor(brick: LogicBrick, meta: GateMeta) {
    super(brick, meta);
    this.isOutput = true;
    this.on = false;
    this.color = [0, 0, 0];
    // steal output function of the pixel output
    this.getOutput = PixelOutput.prototype.getOutput.bind(this);
  }

  tickTerminal: () => true;

  init() {
    this.on =
      this.connections.write.length === 0 || this.connections.write[0].inverted;
    if (this.connections.color.length === 0) this.color = this.meta.brick_color;
  }

  evaluate(sim: Simulator) {
    const {
      color: colors,
      write: [write],
    } = this.connections;

    // turn on when write is on, if there is a write
    if (write) {
      this.on = sim.getGroupPower(write).some(g => g) !== write.inverted;
    }

    // write color if color nodes are attached and the output is on
    if (colors.length > 0 && this.on) {
      const color = [0, 0, 0];
      const bits = colors.length / 3;
      for (let i = 0; i < colors.length; ++i) {
        if (sim.getGroupPower(colors[i]).some(g => g) !== colors[i].inverted) {
          color[Math.floor(i / bits)] |= 1 << i % bits;
        }
      }

      // convert to appropriate range
      for (let i = 0; i < 3; i++) {
        color[i] = (color[i] * 255) / ((1 << bits) - 1);
      }
      // update the color
      this.color = sim.util.color.linearRGB(color) as Vector;
    }

    if (this.on) {
      this.meta.output.color = this.color as number[] as Vector;
    }
  }
}
