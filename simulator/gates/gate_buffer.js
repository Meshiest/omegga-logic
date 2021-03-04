const { SimpleGate } = require('./interface.js');
module.exports = class BufferGate extends SimpleGate {
  static getName() { return 'buffer'; }
  static getMarker() { return 'PB_DefaultMicroWedgeTriangleCorner'; }
  evaluate(sim) {
    const inputs = sim.getGroupPower(this.inputs);
    return inputs.some(i => i);
  }
};
