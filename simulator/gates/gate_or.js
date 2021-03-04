const { SimpleGate } = require('./interface.js');
module.exports = class OrGate extends SimpleGate {
  static getName() { return 'or'; }
  static getMarker() { return 'PB_DefaultMicroWedgeOuterCorner'; }
  evaluate(sim) {
    const inputs = sim.getGroupPower(this.inputs);
    return inputs.some(i => i);
  }
};
