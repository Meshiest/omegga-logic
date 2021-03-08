const { SpecialGate } = require('./interface.js');
module.exports = class Multiplexer extends SpecialGate {
  static getName() { return 'mux'; }
  static getMarker() { return 'PB_DefaultMicroWedgeTriangleCorner'; }
  static getMarkerCount() { return 1; }
  static validateConnectables(markers) {
    const numInput = markers.input.length;
    const numOutput = markers.output.length;
    if (numInput % numOutput !== 0)
      return `#inputs must be divisible by #outputs`;
    return;
  };
  static getConnectables() { return {
    input: n => n > 0, // inputs
    secondary: n => n <= 32, // addresses
    output: n => n > 0, // output
  }; }
  init() {
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
      sim.setGroupPower(o, (input ? sim.getGroupPower(input).some(g=>g) !== input.inverted : false) !== o.inverted);
    }
  }
};
