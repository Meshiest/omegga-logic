import { InputGate } from './interface';

export default class ButtonInput extends InputGate {
  static getName = () => 'button';
  static getDescription = () => 'outputs ON for 1 tick when clicked';

  pressed: number;

  interact() {
    this.pressed = 1;
  }

  evaluate() {
    // buttons are pressed for a number of ticks
    const active = this.pressed > 0;
    if (this.pressed > 0) this.pressed--;
    return active;
  }
}
