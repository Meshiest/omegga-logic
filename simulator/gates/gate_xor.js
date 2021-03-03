const { SimpleGate } = require('./interface.js');
module.exports = class XorGate extends SimpleGate {
  static getName() { return 'xor'; }
  static getMarker() { return 'PB_DefaultMicroWedgeInnerCorner'; }
  evaluate(sim) {
    const inputs = this.getGroupPowers(this.inputs, sim);
    let ok = false;
    for (const i of inputs) {
      if (ok && i) return false;
      if (i) ok = true;
    }
    return ok;
  }
};
