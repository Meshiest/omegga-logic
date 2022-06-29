import Simulator from '..';
import { SpecialGate } from './interface';

export default class JKFlipFlop extends SpecialGate {
  static getName = () => 'jk_flipflop';
  static getConnectables = () => ({
    input: 1,
    reset: 1,
    clock: 1,
    output: (n: number) => n > 0,
    clr: (n: number) => n < 2,
  });

  outputConnectables = ['output'];

  state: boolean;
  lastClock: boolean;
  lastClear: boolean;

  init() {
    this.state = false;
    this.lastClock = this.connections.clock[0].inverted;
    this.lastClear =
      this.connections.clr.length > 0
        ? this.connections.clr[0].inverted
        : false;
  }
  evaluate(sim: Simulator) {
    const {
      clock: [clock],
      clr: [clr],
      input: [input],
      reset: [reset],
      output: outputs,
    } = this.connections;

    const curClock = sim.getGroupPower(clock).some(s => s) !== clock.inverted;

    // clear on rising edge
    if (this.connections.clr.length > 0) {
      const curClr = sim.getGroupPower(clr).some(s => s) !== clr.inverted;
      if (curClr && !this.lastClear) {
        this.state = false;
        this.lastClear = curClr;
        for (const o of outputs)
          sim.setGroupPower(o, this.state !== o.inverted);
        return;
      }
      this.lastClear = curClr;
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
