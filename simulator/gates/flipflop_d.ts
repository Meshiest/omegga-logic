import Simulator from '..';
import { GateMeta, SpecialGate } from './interface';
export default class DFlipFlop extends SpecialGate {
  static getName = () => 'd_flipflop';
  static getDescription = () =>
    'outputs stored value. when write or clock is ON, set stored value to input';

  static getConnectables = () => ({
    input: 1,
    clock: (n: number) => n <= 1,
    write: (n: number) => n <= 1,
    output: (n: number) => n > 0,
  });

  outputConnectables = ['output'];

  state: boolean;
  lastClock: boolean;

  static validateConnectables(markers: GateMeta['connectables']) {
    if (markers.write.length + markers.clock.length !== 1)
      return 'missing clock/write';
  }

  init() {
    this.state = false;
    this.lastClock = this.connections.clock[0]?.inverted;
  }

  evaluate(sim: Simulator) {
    const {
      clock: [clock],
      write: [write],
      input: [input],
      output: outputs,
    } = this.connections;

    if (clock) {
      const curClock =
        sim.getGroupPower(clock).some(s => s) !== clock?.inverted;

      // clock on rising edge only
      if (curClock && !this.lastClock) {
        this.state = sim.getGroupPower(input).some(s => s) !== input.inverted;
      }
      this.lastClock = curClock;
    } else if (write) {
      const isWrite = sim.getGroupPower(write).some(s => s) !== write?.inverted;
      if (isWrite) {
        this.state = sim.getGroupPower(input).some(s => s) !== input.inverted;
      }
    }

    for (const o of outputs) sim.setGroupPower(o, this.state !== o.inverted);
  }
}
