import Simulator from '..';
import { SpecialGate, GateMeta } from './interface';
export default class Multiplexer extends SpecialGate {
  static getName = () => 'mux';
  static getDescription = () => 'outputs ON when binary addressed input is ON';

  static validateConnectables(markers: GateMeta['connectables']) {
    const numInput = markers.input.length;
    const numOutput = markers.output.length;
    if (numInput % numOutput !== 0)
      return `#inputs must be divisible by #outputs`;
    return;
  }
  static getConnectables = () => ({
    input: (n: number) => n > 0, // inputs
    address: (n: number) => n <= 32, // addresses
    output: (n: number) => n > 0, // output
  });

  outputConnectables = ['output'];

  evaluate(sim: Simulator) {
    const {
      address: addresses,
      input: inputs,
      output: outputs,
    } = this.connections;
    // determine address based on the addresses
    let addr = 0;
    for (let i = 0; i < addresses.length; ++i) {
      if (
        sim.getGroupPower(addresses[i]).some(g => g) !== addresses[i].inverted
      )
        addr |= 1 << i;
    }

    // set output to the power of the selected input
    for (let i = 0; i < outputs.length; ++i) {
      const o = outputs[i];
      const input = inputs[addr * outputs.length + i];
      sim.setGroupPower(
        o,
        (input
          ? sim.getGroupPower(input).some(g => g) !== input.inverted
          : false) !== o.inverted
      );
    }
  }
}
