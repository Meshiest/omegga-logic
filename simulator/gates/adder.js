const { SpecialGate } = require('./interface.js');
module.exports = class Adder extends SpecialGate {
  static getName() { return 'adder'; }
  static getMarker() { return 'PB_DefaultMicroWedge'; }
  static getMarkerCount() { return 4; }
  static getConnectables() { return {input: n => n > 1, output: n => n > 1 && n <= 32}; }
  static validateConnectables(markers) {
    if (markers.input.length > (1<<markers.output.length))
      return `not enough outputs for given number of inputs`;
    return;
  };
  init() {
    this.state = false;
  }
  evaluate(sim) {
    const { output: outputs, input: inputs } = this.connections;

    let sum = 0;
    for (const input of inputs) {
      if (sim.getGroupPower(input).some(s => s) !== input.inverted)
        ++sum;
    }

    for (let i = 0; i < outputs.length; i++) {
      const o = outputs[i];
      sim.setGroupPower(o, (!!(sum & (1<<i))) !== o.inverted);
    }
  }
};
