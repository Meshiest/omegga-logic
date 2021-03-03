const { InputGate } = require('./interface.js');
module.exports = class LeverInput extends InputGate {
  static getName() { return 'lever'; }
  static getMarker() { return 'B_1x2f_Plate_Center'; }
  interact() {
    this.pressed = !this.pressed;
  }
  evaluate(state) {
    return !!this.pressed;
  }
};
