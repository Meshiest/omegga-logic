const { SpecialGate } = require('./interface.js');
module.exports = class LeverInput extends SpecialGate {
  static getName() { return 'sr_latch'; }
  static getMarker() { return 'PB_DefaultMicroWedge'; }
  static getConnectables() { return {input: 1, reset: 1, output: 1}; }
  evaluate() {
    return false;
  }
};
