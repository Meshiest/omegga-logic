import Simulator from 'simulator';
import { GateMeta, SpecialGate } from './interface';

export default class Adder extends SpecialGate {
  static getName = () => 'adder';
  static getDescription = () =>
    'counts number of ON inputs. outputs binary representation';
  static getConnectables = () => ({
    input: (n: number) => n > 1,
    output: (n: number) => n > 1 && n <= 32,
  });

  outputConnectables = ['output'];

  static validateConnectables(markers: GateMeta['connectables']) {
    if (markers.input.length > 1 << markers.output.length)
      return `not enough outputs for given number of inputs`;
    return;
  }

  state: boolean;
  init() {
    this.state = false;
  }

  evaluate(sim: Simulator) {
    const { output: outputs, input: inputs } = this.connections;

    let sum = 0;
    for (const input of inputs) {
      if (sim.getGroupPower(input).some(s => s) !== input.inverted) ++sum;
    }

    for (let i = 0; i < outputs.length; i++) {
      const o = outputs[i];
      sim.setGroupPower(o, Boolean(sum & (1 << i)) !== o.inverted);
    }
  }
}
