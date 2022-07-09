import { getDirection } from './../util';
import { Point } from 'octtree';
import Simulator from '..';
import { SpecialGate, GateMeta, Connectable } from './interface';
export default class Multiplexer extends SpecialGate {
  static getName = () => 'rom';
  static getDescription = () =>
    'outputs multiple bits at an address based on stored value. place config on the bottom right';

  static validateConnectables(markers: GateMeta['connectables']) {
    if (!markers.config[0].rest?.match(/\d+/))
      return 'config requires :<NUMBER> suffix for size of byte (:8)';

    const size = Number(markers.config[0].rest);

    if (size === 0 || size > 32)
      return `config size (${size}) must be less than 32 and greater than 0`;

    const numAddress = markers.address.length;
    const numOutput = markers.output.length;
    const numData = markers.data.length;

    if (numData % size !== 0)
      return `#data (${numData}) must be divisible by the size of byte (${size})`;

    if (numOutput % size !== 0)
      return `#outputs (${numOutput}) must be divisible by the size of byte (${size})`;

    if (1 << numAddress < numData / numOutput)
      return `2^(#address-1) (${
        1 << numAddress
      }) must be at least the number of bits (${numData}) divided by the number of outputs (${numOutput})`;

    return;
  }
  static getConnectables = () => ({
    config: 1, // config marker
    address: (n: number) => n <= 32, // addresses
    output: (n: number) => n > 0, // output
    data: (n: number) => n > 0, // rom data
  });

  outputConnectables = ['output'];

  rom:
    | Uint8Array
    | Uint8Array
    | Uint8Array
    | Uint8Array
    | Uint16Array
    | Uint32Array;

  numWords: number;
  wordSize: number;
  numOutputs: number;

  init() {
    const DataClass = [
      Uint8Array,
      Uint8Array,
      Uint8Array,
      Uint8Array,
      Uint16Array,
      Uint32Array,
    ][
      this.connections.address.length
        ? Math.ceil(Math.log2(this.connections.address.length))
        : 0
    ];

    this.numWords = this.meta.connectables.data.length / this.wordSize;
    this.numOutputs = this.meta.connectables.output.length / this.wordSize;

    this.rom = new DataClass(this.numWords).fill(0);
    for (let i = 0; i < this.meta.connectables.data.length; i++) {
      const node = this.meta.connectables.data[i];
      if (node.inverted) {
        this.rom[Math.floor(i / this.wordSize)] |= 1 << i % this.wordSize;
      }
    }
  }

  evaluate(sim: Simulator) {
    const { address: addresses, output: outputs } = this.connections;
    // determine address based on the addresses
    let addr = 0;
    for (let i = 0; i < addresses.length; ++i) {
      if (
        sim.getGroupPower(addresses[i]).some(g => g) !== addresses[i].inverted
      )
        addr |= 1 << i;
    }

    // set output to the power of the addressed byte
    for (let i = 0; i < outputs.length; ++i) {
      const output = outputs[i];
      const byte = this.rom[addr + Math.floor(i / this.wordSize)];

      sim.setGroupPower(
        output,
        Boolean(byte & (1 << i % this.wordSize)) !== output.inverted
      );
    }
  }

  findConnections(sim: Simulator) {
    this.connections = {};
    const dir = this.meta.direction;

    let rotation: number;

    const DIR_TO_AXIS = {
      0: [1, 2],
      1: [1, 2],
      2: [0, 2],
      3: [0, 2],
      4: [0, 1],
      5: [0, 1],
    };

    const [ox, oy] = {
      0: ['y', 'z'],
      1: ['y', 'z'],
      2: ['x', 'z'],
      3: ['x', 'z'],
      4: ['x', 'y'],
      5: ['x', 'y'],
    }[dir];

    const order = [
      (a, b) => a.min[oy] - b.min[oy] || a.min[ox] - b.min[ox] || 0,
      (a, b) => b.min[ox] - a.min[ox] || a.min[oy] - b.min[oy] || 0,
      (a, b) => b.min[oy] - a.min[oy] || b.min[ox] - a.min[ox] || 0,
      (a, b) => a.min[ox] - b.min[ox] || b.min[oy] - a.min[oy] || 0,
    ];

    for (const connType in this.meta.connectables) {
      const nodes = this.meta.connectables[connType];

      switch (connType) {
        case 'config': {
          const center = this.brick.position;
          const corner = nodes[0].brick.position;
          const [x, y] = DIR_TO_AXIS[dir];

          rotation = getDirection(
            [center[x], center[y]],
            [corner[x], corner[y]]
          );

          this.wordSize = Number(nodes[0].brick.tagMatch.groups.rest);

          nodes[0].brick.ioType = connType;
          nodes[0].brick.ioIndex = 0;
          nodes[0].brick.ownerGate = this.brick.gate;
          break;
        }
        case 'data': {
          nodes.sort(order[rotation]);
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const { color, material_index } = node.brick;
            const isWhite =
              (typeof color === 'number' ? sim.save.colors[color] : color)[0] >
              126;
            const isGlow = sim.save.materials[material_index] === 'BMC_Glow';
            if (isWhite || isGlow) {
              node.inverted = true;
            }

            nodes[i].brick.ioType = connType;
            nodes[i].brick.ioIndex = i;
            nodes[i].brick.ownerGate = this.brick.gate;
          }
          break;
        }
        default: {
          this.connectNode(sim, connType);
          break;
        }
      }
    }
  }
}
