import Simulator from '..';
import { SimpleGate } from './interface';

export default class AndGate extends SimpleGate {
  static getName = () => 'and';
  evaluate(sim: Simulator) {
    const inputs = sim.getGroupPower(this.inputs);
    return inputs.length > 0 && inputs.every(i => i);
  }
}
