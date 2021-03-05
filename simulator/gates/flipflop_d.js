const { SpecialGate } = require('./interface.js');
module.exports = class DFlipFlop extends SpecialGate {
  static getName() { return 'd_flipflop'; }
  static getMarker() { return 'PB_DefaultMicroWedge'; }
  static getMarkerCount() { return 2; }
  static getConnectables() { return {input: 1, clock: 1, output: n => n > 0}; }
  init() {
    this.state = false;
    this.lastClock = this.connections.clock[0].inverted;
  }
  evaluate(sim) {
    const { clock: [clock], input: [input], output: outputs} = this.connections;

    const curClock = sim.getGroupPower(clock).some(s => s) !== clock.inverted;

    // clock on rising edge only
    if (curClock && !this.lastClock) {
      this.state = sim.getGroupPower(input).some(s => s) !== input.inverted;
    }
    this.lastClock = curClock;

    for (const o of outputs)
      sim.setGroupPower(o, this.state !== o.inverted);
  }
};
