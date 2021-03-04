const { SpecialGate } = require('./interface.js');
module.exports = class DummyMemory extends SpecialGate {
  static getName() { return 'memory'; }
  static getMarker() { return 'PB_DefaultMicroWedgeTriangleCorner'; }
  static getMarkerCount() { return 1; }
  static getConnectables() { return {input: n => n > 0, output: n => n > 0}; }
  init() {

  }
  evaluate(sim) {
    // testing the sorting of connections
    sim.setGroupPower(this.connections.output[sim.frame % this.connections.output.length], true);
    sim.setGroupPower(this.connections.input[sim.frame % this.connections.input.length], true);
  }
};
