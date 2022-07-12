import Simulator from '..';
import { SimpleGate } from './interface';
export default class BufferGate extends SimpleGate {
  static getName = () => 'buffer';
  static getDescription = () =>
    'outputs ON one tick after any input is ON. prevents cycles';

  state: boolean;
  isEntryPoint = true;

  init() {
    this.state = false;
  }
  evaluate(_sim: Simulator) {
    return this.state;
  }
  settle(sim: Simulator) {
    this.state = sim.getGroupPower(this.inputs).some(i => i);
  }
}
