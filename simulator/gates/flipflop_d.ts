import Simulator from '..';
import { SpecialGate } from './interface';
export default class DFlipFlop extends SpecialGate {
  static getName = () => 'd_flipflop';
  static getConnectables = () => ({
    input: 1,
    clock: 1,
    output: (n: number) => n > 0,
  });

  outputConnectables = ['output'];

  state: boolean;
  lastClock: boolean;

  init() {
    this.state = false;
    this.lastClock = this.connections.clock[0].inverted;
  }

  evaluate(sim: Simulator) {
    const {
      clock: [clock],
      input: [input],
      output: outputs,
    } = this.connections;

    const curClock = sim.getGroupPower(clock).some(s => s) !== clock.inverted;

    // clock on rising edge only
    if (curClock && !this.lastClock) {
      this.state = sim.getGroupPower(input).some(s => s) !== input.inverted;
    }
    this.lastClock = curClock;

    for (const o of outputs) sim.setGroupPower(o, this.state !== o.inverted);
  }
}
