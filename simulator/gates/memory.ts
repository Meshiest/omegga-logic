import Simulator from '..';
import { GateMeta, SpecialGate } from './interface';
export default class Memory extends SpecialGate {
  static getName = () => 'mem';
  static getConnectables = () => ({
    input: (n: number) => n > 0 && n <= 64,
    write: (n: number) => n < 2,
    clock: (n: number) => n < 2,
    clear: (n: number) => n < 2,
    address: (n: number) => n <= 16, // addresses up to 16 bit in size, can have 0 for 1 bit memory
    output: (n: number) => n > 0 && n <= 64,
  });

  outputConnectables = ['output'];

  data:
    | Uint8Array
    | Uint8Array
    | Uint8Array
    | Uint8Array
    | Uint16Array
    | Uint32Array
    | BigUint64Array;

  big: boolean;
  lastClock: boolean;
  lastClear: boolean;

  static validateConnectables(markers: GateMeta['connectables']) {
    if (markers.write.length + markers.clock.length < 1)
      return 'missing clock/write';
    if (markers.input.length !== markers.output.length)
      return 'number of inputs should match number of outputs';
    return;
  }
  init() {
    // number of addressible values in memory
    const numAddrs = 1 << this.connections.address.length;
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
    this.lastClock =
      this.connections.clock.length > 0
        ? this.connections.clock[0].inverted
        : false;
    this.lastClear =
      this.connections.clear.length > 0
        ? this.connections.clear[0].inverted
        : false;
  }
  // get a decimal value from binary input
  getDecFromBin(sim: Simulator, name: string) {
    if (this.big) return this.getDecFromBinBig(sim, name);
    let val = 0;

    for (let i = 0; i < this.connections[name].length; i++) {
      if (
        sim.getGroupPower(this.connections[name][i]).some(g => g) !==
        this.connections[name][i].inverted
      )
        val |= 1 << i;
    }

    return val;
  }
  // get a decimal value from binary input but with big ints
  getDecFromBinBig(sim: Simulator, name: string) {
    let val = 0n;

    for (let i = 0; i < this.connections[name].length; i++) {
      if (
        sim.getGroupPower(this.connections[name][i]).some(g => g) !==
        this.connections[name][i].inverted
      )
        val |= 1n << BigInt(i);
    }

    return val;
  }
  evaluate(sim: Simulator) {
    const {
      write: [write],
      clock: [clock],
      clear: [clear],
      output: outputs,
    } = this.connections;
    const addr = Number(this.getDecFromBin(sim, 'address'));

    // clear on rising edge
    if (this.connections.clear.length > 0) {
      const curClear = sim.getGroupPower(clear).some(s => s) !== clear.inverted;
      if (curClear && !this.lastClear) {
        for (let i = 0; i < this.data.length; ++i)
          this.data[i] = this.big ? 0n : 0;
        this.lastClear = curClear;
        for (const o of outputs) sim.setGroupPower(o, o.inverted);
        return;
      }
      this.lastClear = curClear;
    }

    const writeOn =
      write && sim.getGroupPower(write).some(g => g) !== write.inverted;
    const clockOn =
      clock && sim.getGroupPower(clock).some(g => g) !== clock.inverted;

    // if write mode is on or the cell is getting clocked, update data
    if (writeOn || (clockOn && !this.lastClock)) {
      this.data[addr] = this.getDecFromBin(sim, 'input');
    }

    // update last clock
    if (clock) {
      this.lastClock = clockOn;
    }

    if (!this.data[addr]) return;

    if (this.big) {
      const output = this.data[addr] as bigint;
      // write output as binary with big ints
      for (let i = 0; i < outputs.length; i++) {
        const o = outputs[i];
        sim.setGroupPower(o, !!(output & (1n << BigInt(i))) !== o.inverted);
      }
    } else {
      const output = this.data[addr] as number;

      // write output as binary
      for (let i = 0; i < outputs.length; i++) {
        const o = outputs[i];
        sim.setGroupPower(o, !!(output & (1 << i)) !== o.inverted);
      }
    }
  }
}
