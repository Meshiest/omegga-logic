const { SpecialGate } = require('./interface.js');
module.exports = class Memory extends SpecialGate {
  static getName() { return 'mem'; }
  static getMarker() { return 'PB_DefaultMicroWedgeTriangleCorner'; }
  static getMarkerCount() { return 2; }
  static getConnectables() { return {
    input: n => n > 0 && n <= 64,
    write: n => 1,
    secondary: n => n <= 16, // addresses up to 16 bit in size, can have 0 for 1 bit memory
    output: n => n > 0 && n <= 64,
  }; }
  static validateConnectables(markers) {
    if (markers.input.length !== markers.output.length) return 'number of inputs should match number of outputs'
    return;
  };
  init() {
    // number of addressible values in memory
    const numAddrs = 1<<this.connections.secondary.length;
    const DataClass = [
      Uint8Array,
      Uint8Array,
      Uint8Array,
      Uint8Array,
      Uint16Array,
      Uint32Array,
      BigUint64Array,
    ][Math.ceil(Math.log2(this.connections.input.length))];

    // create an array of elements based on the size of the input
    this.data = new DataClass(numAddrs);
    this.big = this.connections.input.length === 64;
  }
  // get a decimal value from binary input
  getDecFromBin(sim, name) {
    if (this.big) return this.getDecFromBinBig(sim, name);
    let val = 0;

    for (let i = 0; i < this.connections[name].length; i++) {
      if (sim.getGroupPower(this.connections[name][i]).some(g=>g) !== this.connections[name][i].inverted)
        val |= 1<<i;
    }

    return val;
  }
  // get a decimal value from binary input but with big ints
  getDecFromBinBig(sim, name) {
    let val = 0n;

    for (let i = 0n; i < this.connections[name].length; i++) {
      if (sim.getGroupPower(this.connections[name][i]).some(g=>g) !== this.connections[name][i].inverted)
        val |= 1n<<i;
    }

    return val;
  }
  evaluate(sim) {
    const { write: [write], output: outputs } = this.connections;
    // determine address based on the secondaries
    let addr = this.getDecFromBin(sim, 'secondary');

    // if write mode is on, update data
    if (sim.getGroupPower(write).some(g=>g) !== write.inverted) {
      this.data[addr] = this.getDecFromBin(sim, 'input');
    }

    const output = this.data[addr];
    if (!output) return;

    if (this.big) {
      // write output as binary with big ints
      for (let i = 0n; i < outputs.length; i++) {
        const o = outputs[i];
        sim.setGroupPower(o, !!(output & (1n<<i)) !== o.inverted);
      }
    } else {
      // write output as binary
      for (let i = 0; i < outputs.length; i++) {
        const o = outputs[i];
        sim.setGroupPower(o, !!(output & (1<<i)) !== o.inverted);
      }
    }
  }
};
