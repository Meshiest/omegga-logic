const { SpecialGate } = require('./interface.js');
module.exports = class Adder extends SpecialGate {
  static getName() { return 'adder'; }
  static getMarker() { return 'PB_DefaultMicroWedge'; }
  static getMarkerCount() { return 4; }
  static getConnectables() { return {input: n => n === 2 || n === 3, secondary: 1, output: 1}; }
  init() {
    this.state = false;
  }
  evaluate(sim) {
    // ignore pointless gates
    if (this.connections.output[0].size === 0) return;

    const values = this.connections.input.map(val => sim.getGroupPower(val).some(s => s));
    const sum = values[0] + values[1] + (values.length > 2 ? values[2] : 0)

    sim.setGroupPower(this.connections.secondary[0], sum > 1);
    sim.setGroupPower(this.connections.output[0], sum % 2 === 1);
  }
};
