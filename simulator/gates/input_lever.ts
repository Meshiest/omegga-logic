import { InputGate } from './interface';

export default class LeverInput extends InputGate {
  static getName = () => 'lever';

  pressed: boolean;
  interact() {
    this.pressed = !this.pressed;
  }
  evaluate() {
    return !!this.pressed;
  }
}
