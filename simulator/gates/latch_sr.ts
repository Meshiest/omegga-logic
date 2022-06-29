import Simulator from '..';
import { SpecialGate } from './interface';
export default class SRLatch extends SpecialGate {
  static getName = () => 'sr_latch';
  static getConnectables = () => ({
    input: 1,
    reset: 1,
    output: (n: number) => n > 0,
  });

  outputConnectables = ['output'];

  state: boolean;

  init() {
    this.state = false;
  }

  evaluate(sim: Simulator) {
    const {
      input: [input],
      reset: [reset],
      output: outputs,
    } = this.connections;

    const set = sim.getGroupPower(input).some(s => s) !== input.inverted;
    const curReset = sim.getGroupPower(reset).some(s => s) !== reset.inverted;

    if (set !== curReset) {
      this.state = set;
    }

    for (const o of outputs) sim.setGroupPower(o, this.state !== o.inverted);
  }
}
