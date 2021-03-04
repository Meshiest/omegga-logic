const { SimpleGate } = require('./interface.js');
module.exports = class AndGate extends SimpleGate {
  static getName() { return 'and'; }
  static getMarker() { return 'PB_DefaultMicroWedge'; }
  evaluate(sim) {
    const inputs = sim.getGroupPower(this.inputs);
    return inputs.length > 0 && inputs.every(i => i);
  }
};
