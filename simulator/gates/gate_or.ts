import Simulator from '..';
import { SimpleGate } from './interface';
export default class OrGate extends SimpleGate {
  static getName = () => 'or';
  static getDescription = () => 'outputs ON when any input is ON';
  evaluate(sim: Simulator) {
    return sim.getGroupPower(this.inputs).some(i => i);
  }
}
