const { SpecialGate } = require('./interface.js');
module.exports = class Memory extends SpecialGate {
  static getName() { return 'mem'; }
  static getMarker() { return 'PB_DefaultMicroWedgeTriangleCorner'; }
  static getMarkerCount() { return 2; }
  static getConnectables() { return {
    input: n => n > 0 && n <= 16,
    write: 1,
    secondary: n => n > 0 && n <= 16, // addresses up to 16 bit in size
    output: n => n > 0 && n <= 16,
  }; }
  static validateConnectables(markers) {
    if (markers.input.length !== markers.output.length) return 'number of inputs should match number of outputs'
    return;
  };
  init() {
    // number of addressible values in memory
    const numAddrs = 1<<this.connections.secondary.length;
    // create an array of elements based on the size of the input
    this.data = new (this.connections.input.length <= 8 ? Uint8Array : Uint16Array)(numAddrs);
  }
  // get a decimal value from binary input
  getDecFromBin(sim, name) {
    let val = 0;

    for (let i = 0; i < this.connections[name].length; i++) {
      if (sim.getGroupPower(this.connections[name][i]).some(g=>g))
        val |= 1<<i;
    }

    return val;
  }
  evaluate(sim) {
    // determine address based on the secondaries
    let addr = this.getDecFromBin(sim, 'secondary');

    // if write mode is on, update data
    if (sim.getGroupPower(this.connections.write[0]).some(g=>g)) {
      this.data[addr] = this.getDecFromBin(sim, 'input');
    }

    const output = this.data[addr];
    if (!output) return;

    // write output as binary
    for (let i = 0; i < this.connections.output.length; i++) {
      sim.setGroupPower(this.connections.output[i], !!(output & (1<<i)));
    }
  }
};
