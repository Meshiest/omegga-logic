const { SpecialGate } = require('./interface.js');
module.exports = class DFlipFlop extends SpecialGate {
  static getName() { return 'd_flipflop'; }
  static getMarker() { return 'PB_DefaultMicroWedge'; }
  static getMarkerCount() { return 2; }
  static getConnectables() { return {input: 1, clock: 1, output: 1}; }
  init() {
    this.state = false;
    this.lastClock = false;
  }
  evaluate(sim) {
    // ignore pointless gates
    if (this.connections.output[0].size === 0) return;

    const clock = sim.getGroupPower(this.connections.clock[0]).some(s => s);

    // clock on rising edge only
    if (clock && !this.lastClock) {
      this.state = sim.getGroupPower(this.connections.input[0]).some(s => s);
    }
    this.lastClock = clock;

    sim.setGroupPower(this.connections.output[0], this.state);
  }
};
