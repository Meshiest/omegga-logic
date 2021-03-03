const { InputGate } = require('./interface.js');
module.exports = class ButtonInput extends InputGate {
  static getName() { return 'button'; }
  static getMarker() { return 'B_2x2F_Octo_Converter'; }
  interact() {
    this.pressed = 3;
  }
  evaluate() {
    // buttons are pressed for a number of ticks
    if (this.pressed > 0) {
      this.pressed --;
    }
    return this.pressed > 0;
  }
};
