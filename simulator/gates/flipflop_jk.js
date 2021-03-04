const { SpecialGate } = require('./interface.js');
module.exports = class JKFlipFlop extends SpecialGate {
  static getName() { return 'jk_flipflop'; }
  static getMarker() { return 'PB_DefaultMicroWedge'; }
  static getMarkerCount() { return 3; }
  static getConnectables() { return {input: 1, reset: 1, clock: 1, output: 1, clr: n => n < 2}; }
  init() {
    this.state = false;
    this.lastClock = false;
    this.lastClear = false;
  }
  evaluate(sim) {
    // ignore pointless gates
    if (this.connections.output[0].size === 0) return;

    const clock = sim.getGroupPower(this.connections.clock[0]).some(s => s);

    // clear on rising edge
    if (this.connections.clr.length > 0) {
      const clr = sim.getGroupPower(this.connections.clr[0]).some(s => s);
      if (clr && !this.lastClear) {
        this.state = false;
        this.lastClear = clr;
        sim.setGroupPower(this.connections.output[0], this.state);
        return;
      }
      this.lastClear = clr;
    }

    // set on clock
    if (clock && !this.lastClock) {
      const j = sim.getGroupPower(this.connections.input[0]).some(s => s)
      const k = sim.getGroupPower(this.connections.reset[0]).some(s => s)
      this.state = j != k ? j : j && !this.state;
    }
    this.lastClock = clock;

    sim.setGroupPower(this.connections.output[0], this.state);
  }
};
