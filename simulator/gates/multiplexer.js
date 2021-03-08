const { SpecialGate } = require('./interface.js');
module.exports = class Multiplexer extends SpecialGate {
  static getName() { return 'mux'; }
  static getMarker() { return 'PB_DefaultMicroWedgeTriangleCorner'; }
  static getMarkerCount() { return 1; }
  static validateConnectables(markers) {
    const numInput = markers.input.length;
    const numOutput = markers.output.length;
    const addrSize = Math.log2(numInput / numOutput);
    if (numInput % numOutput !== 0)
      return `#inputs must be divisible by #outputs`;
    if (addrSize % 1 !== 0)
      return `(#inputs/#output) must be a power of 2 (have ${numInput} in, ${numOutput} out)`;
    if (addrSize !== markers.secondary.length)
      return `not enough address inputs (expected ${addrSize})`;
    return;
  };
  static getConnectables() { return {
    input: n => n > 0, // inputs
    secondary: n => n > 0, // addresses
    output: n => n > 0, // output
  }; }
  init() {
    this.addrSize = Math.log2(this.connections.input.length);
  }
  evaluate(sim) {
    const { secondary: secondaries, input: inputs, output: outputs } = this.connections;
    // determine address based on the secondaries
    let addr = 0;
    for (let i = 0; i < secondaries.length; ++i) {
      if (sim.getGroupPower(secondaries[i]).some(g=>g) !== secondaries[i].inverted)
        addr |= 1<<i;
    }

    // set output to the power of the selected input
    for (let i = 0; i < outputs.length; ++i) {
      const o = outputs[i];
      const input = inputs[addr * outputs.length + i];
      sim.setGroupPower(o, (sim.getGroupPower(input).some(g=>g) !== input.inverted) !== o.inverted);
    }
  }
};
