import Simulator from '..';
import { SimpleGate } from './interface';

export default class XorGate extends SimpleGate {
  static getName = () => 'xor';
  evaluate(sim: Simulator) {
    const inputs = sim.getGroupPower(this.inputs);
    let ok = false;
    for (const i of inputs) {
      if (ok && i) return false;
      if (i) ok = true;
    }
    return ok;
  }
}
