const { SpecialGate } = require('./interface.js');
module.exports = class Multiplexer extends SpecialGate {
  static getName() { return 'mux'; }
  static getMarker() { return 'PB_DefaultMicroWedgeTriangleCorner'; }
  static getMarkerCount() { return 1; }
  static validateConnectables(markers) {
    const addrSize = Math.log2(markers.input.length);
    if (addrSize % 1 !== 0)
      return `number of inputs must be a power of 2 (have ${markers.input.length})`;
    if (addrSize !== markers.secondary.length)
      return `not enough address inputs (expected ${addrSize})`;
    return;
  };
  static getConnectables() { return {
    input: n => n > 0, // inputs
    secondary: n => n > 0, // addresses
    output: 1, // output
  }; }
  init() {
    this.addrSize = Math.log2(this.connections.input.length);
  }
  evaluate(sim) {
    // determine address based on the secondaries
    let addr = 0;
    for (let i = 0; i < this.connections.secondary.length; i++) {
      if (sim.getGroupPower(this.connections.secondary[i]).some(g=>g))
        addr |= 1<<i;
    }

    // set output to the power of the selected input
    sim.setGroupPower(
      this.connections.output[0],
      sim.getGroupPower(this.connections.input[addr]).some(g=>g),
    );
  }
};
