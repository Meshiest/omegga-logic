import Simulator from '..';
import { SpecialGate, GateMeta } from './interface';
export default class Decoder extends SpecialGate {
  static getName = () => 'dec';
  static getDescription = () =>
    'inputs binary number N, turns on the Nth output. will not output when disabled';

  static getConnectables = () => ({
    input: (n: number) => n > 0, // inputs
    disable: (n: number) => n <= 1, // disable
    output: (n: number) => n > 0, // output
  });

  static validateConnectables(markers: GateMeta['connectables']) {
    if (markers.output.length !== 1 << markers.input.length)
      return `#output must be 2^(#input-1)`;
    return;
  }

  outputConnectables = ['output'];

  evaluate(sim: Simulator) {
    const {
      disable: [disable],
      input: inputs,
      output: outputs,
    } = this.connections;

    // disable if its present
    if (
      disable &&
      sim.getGroupPower(disable).some(g => g) !== disable.inverted
    ) {
      return;
    }

    // determine address based on the addresses
    let addr = 0;
    for (let i = 0; i < inputs.length; ++i) {
      if (sim.getGroupPower(inputs[i]).some(g => g) !== inputs[i].inverted) {
        addr |= 1 << i;
      }
    }

    for (let i = 0; i < outputs.length; ++i) {
      // invert the decoded output
      sim.setGroupPower(outputs[i], (i === addr) !== outputs[i].inverted);
    }
  }
}
