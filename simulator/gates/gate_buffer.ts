import Simulator from '..';
import { SimpleGate } from './interface';
export default class BufferGate extends SimpleGate {
  static getName = () => 'buffer';

  prevState: boolean;
  init() {
    this.prevState = false;
  }
  evaluate(sim: Simulator) {
    const state = this.prevState;
    this.prevState = sim.getGroupPower(this.inputs).some(i => i);
    return state;
  }
}
