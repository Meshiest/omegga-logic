import { InputGate } from './interface';

export default class LeverInput extends InputGate {
  static getName = () => 'lever';
  static getDescription = () =>
    'toggles output between ON and OFF when clicked';

  pressed: boolean;
  interact() {
    this.pressed = !this.pressed;
  }
  evaluate() {
    return !!this.pressed;
  }
}
