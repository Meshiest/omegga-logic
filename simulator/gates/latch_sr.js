const { SpecialGate } = require('./interface.js');
module.exports = class SRLatch extends SpecialGate {
  static getName() { return 'sr_latch'; }
  static getMarker() { return 'PB_DefaultMicroWedge'; }
  static getConnectables() { return {input: 1, reset: 1, output: 1}; }
  init() {
    this.state = false;
  }
  evaluate(sim) {
    // ignore pointless gates
    if (this.connections.output[0].size === 0) return;

    const set = sim.getGroupPower(this.connections.input[0]).some(s => s);
    const reset = sim.getGroupPower(this.connections.reset[0]).some(s => s);

    if (set !== reset) {
      this.state = set;
    }

    sim.setGroupPower(this.connections.output[0], this.state);
  }
};
