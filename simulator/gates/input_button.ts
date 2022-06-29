import { InputGate } from './interface';

export default class ButtonInput extends InputGate {
  static getName = () => 'button';
  static getMarker = () => 'B_2x2F_Octo_Converter';

  pressed: number;

  interact() {
    this.pressed = 3;
  }

  evaluate() {
    // buttons are pressed for a number of ticks
    if (this.pressed > 0) {
      this.pressed--;
    }
    return this.pressed > 0;
  }
}
