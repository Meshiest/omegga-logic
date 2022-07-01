import Simulator from '..';
import { SpecialGate } from './interface';

export default class JKFlipFlop extends SpecialGate {
  static getName = () => 'jk_flipflop';
  static getDescription = () =>
    'when input is ON during clock, turn output ON. when reset is ON, turn OFF';
  static getConnectables = () => ({
    input: 1,
    reset: 1,
    clock: 1,
    output: (n: number) => n > 0,
    clear: (n: number) => n <= 1,
  });

  outputConnectables = ['output'];

  state: boolean;
  lastClock: boolean;
  lastClear: boolean;

  init() {
    this.state = false;
    this.lastClock = this.connections.clock[0].inverted;
    this.lastClear =
      this.connections.clear.length > 0
        ? this.connections.clear[0].inverted
        : false;
  }
  evaluate(sim: Simulator) {
    const {
      clock: [clock],
      clear: [clear],
      input: [input],
      reset: [reset],
      output: outputs,
    } = this.connections;

    const curClock = sim.getGroupPower(clock).some(s => s) !== clock.inverted;

    // clear on rising edge
    if (this.connections.clear.length > 0) {
      const curClear = sim.getGroupPower(clear).some(s => s) !== clear.inverted;
      if (curClear && !this.lastClear) {
        this.state = false;
        this.lastClear = curClear;
        for (const o of outputs)
          sim.setGroupPower(o, this.state !== o.inverted);
        return;
      }
      this.lastClear = curClear;
    }

    // set on clock
    if (curClock && !this.lastClock) {
      const j = sim.getGroupPower(input).some(s => s) !== input.inverted;
      const k = sim.getGroupPower(reset).some(s => s) !== reset.inverted;
      this.state = j != k ? j : j && !this.state;
    }
    this.lastClock = curClock;

    for (const o of outputs) sim.setGroupPower(o, this.state !== o.inverted);
  }
}
