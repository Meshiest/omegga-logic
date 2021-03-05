const { SpecialGate } = require('./interface.js');
module.exports = class SRLatch extends SpecialGate {
  static getName() { return 'sr_latch'; }
  static getMarker() { return 'PB_DefaultMicroWedge'; }
  static getConnectables() { return {input: 1, reset: 1, output: n => n > 0}; }
  init() {
    this.state = false;
  }
  evaluate(sim) {
    const { input: [input], reset: [reset], output: outputs } = this.connections;

    const set = sim.getGroupPower(input).some(s => s) !== input.inverted;
    const curReset = sim.getGroupPower(reset).some(s => s) !== reset.inverted;

    if (set !== curReset) {
      this.state = set;
    }

    for (const o of outputs)
      sim.setGroupPower(o, this.state !== o.inverted);
  }
};
