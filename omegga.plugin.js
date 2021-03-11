const { getScaleAxis } = global.OMEGGA_UTIL.brick;
const ChunkTree = require('./octtree.js');
const { Point } = ChunkTree;
const Simulator = require('./simulator/index.js');

const owners = [{
  name: 'logicbrick',
  id: '94e3f858-452d-4b07-9eff-e82a7a7bd734',
}, {
  name: 'logicbrick2',
  id: '94e3f858-452d-4b07-9eff-e82a7a7bd735',
}, {
  name: 'logicbrickout',
  id: '94e3f858-452d-4b07-9eff-e82a7a7bd736',
}];

// enable wedge wire power visualization (no flickering)
const MULTI_FRAME_MODE = true;

const sleep = t => new Promise(resolve => setTimeout(resolve, t));

module.exports = class Logic {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.state = null;
  }

  // check if a name is authorized
  isAuthorized(name) {
    if (!this.config['only-authorized']) return true;
    const player = Omegga.getPlayer(name);
    return player.isHost() || this.config['authorized-users'].some(p => player.id === p.id);
  }

  // render a logic state to bricks
  async renderState() {
    try {
      const { state } = this;
      const owner =  MULTI_FRAME_MODE ? owners[1 - state.frame % 2] : owners[0];
      const outputOwner =  owners[2];
      const prevOwner = owners[state.frame % 2];

      const out = {
        version: state.save.version,
        brick_owners: [owner, outputOwner],
        materials: ['BMC_Plastic', 'BMC_Glow'],
        brick_assets: ['PB_DefaultMicroBrick', 'PB_DefaultMicroWedge'],
        colors: state.colors,
        bricks: [],
      };

      const orientation = {direction: state.frame % 2 ? 0 : 0, rotation: state.frame % 2 ? 2 : 0};
      const axis = [
        getScaleAxis(orientation, 0),
        getScaleAxis(orientation, 1),
        getScaleAxis(orientation, 2),
      ];

      // clear owner bricks (causes flash)
      if (!MULTI_FRAME_MODE)
        await Omegga.clearBricks(owner, {quiet: true});
      await Omegga.clearBricks(outputOwner, {quiet: true});

      for (let i = 0; i < state.errors.length; ++i) {
        const error = state.errors[i];
        out.bricks.push({
          position: [error[0], error[1], error[2] + 30 + (state.frame % 2) * 20],
          asset_name_index: 0, // regular brick
          size: [2, 2, 10],
          color: [255, 0, 0],
          direction: 4,
          rotation: 0,
          material_intensity: 10,
          material_index: 1,
        });
      }

      for (let i = 0; i < state.outputs.length; ++i) {
        const gate = state.outputs[i];
        if (gate.on) {
          out.bricks.push(...gate.getOutput(state));
        }
      }

      if (!state.hideWires)
        for (let i = 0; i < state.wires.length; ++i) {
          const brick = state.wires[i];
          const on = state.groups[brick.group-1].currPower;
          if (!on) continue;

          const newBrick = {
            position: [brick.position[0], brick.position[1], brick.position[2] + 2],
            asset_name_index: 0, // regular brick
            size: brick.normal_size,
            color: brick.color,
            direction: 4,
            rotation: 0,
            collision: {
              tool: false,
              player: false,
              interaction: false,
              weapon: false,
            },
            material_intensity: on ? 7 : 0,
            material_index: 1,
          };

          // use properly scaled microwedges if configured
          if (MULTI_FRAME_MODE) {
            newBrick.asset_name_index = 1;
            newBrick.size = [
              brick.normal_size[axis[0]],
              brick.normal_size[axis[1]],
              brick.normal_size[axis[2]],
            ];
            newBrick.direction = orientation.direction;
            newBrick.rotation = orientation.rotation;
          }

          if (brick.normal_size[2] > 1) {
            newBrick.position[2] += brick.normal_size[2] - 1;
            newBrick.size = [brick.normal_size[0], brick.normal_size[0], 1];
          }

          out.bricks.push(newBrick);
        }
      if (out.bricks.length > 0)
        await Omegga.loadSaveData(out, {quiet: true});

      // clear previous owner after loading bricks to reduce flicker
      if (MULTI_FRAME_MODE)
        await Omegga.clearBricks(prevOwner, {quiet: true});
      state.incFrame();
    } catch (err) {
      console.error('render error', err);
    }
  }

  // run a sim with the provided data
  async simWithData(data, options={}) {
    // get the state of the logic
    const start = Date.now();
    const state = new Simulator(data, global.OMEGGA_UTIL);
    const duration = (Date.now()-start)/1000;

    Omegga.broadcast('"<b><color=\\"aaaaff\\">Simulation Compile Stats</></>"');
    Omegga.broadcast(`"<code><color=\\"ffffff\\"><size=\\"15\\">- read ${data.bricks.length} bricks</></></>"`);
    Omegga.broadcast(`"<code><color=\\"ffffff\\"><size=\\"15\\">- detected ${state.wires.length} wires</></></>"`);
    Omegga.broadcast(`"<code><color=\\"ffffff\\"><size=\\"15\\">- detected ${state.groups.length} groups</></></>"`);
    Omegga.broadcast(`"<code><color=\\"ffffff\\"><size=\\"15\\">- detected ${state.gates.length} gates</></></>"`);
    Omegga.broadcast(`"<code><color=\\"ffffff\\"><size=\\"15\\">- took ${duration.toLocaleString()} seconds</></></>"`);

    await Omegga.clearBricks(owners[0], {quiet: true});
    await Omegga.clearBricks(owners[1], {quiet: true});
    await Omegga.clearBricks(owners[2], {quiet: true});

    if (options.hideWires)
      state.showWires(false);

    state.next();
    this.state = state;
    this.renderState();
  }

  // run the simulator a number of times, w/ wait ms between frames
  async runSim(times, wait, skip) {
    if (this.running) return;
    this.running = true;

    for (let i = 0; i < times; i++) {
      const state = this.state;
      if (!this.running || !state) return;
      state.next();
      if (i % skip === 0 || i === times-1) {
        await this.renderState();
        if (times !== 1)
          await sleep(wait);
      }
    }
    this.running = false;
  }

  async init() {
    Omegga.on('cmd:stop', async n => {
      if (!this.isAuthorized(n)) return;
      this.running = false;
      Omegga.broadcast(`"<b><color=\\"ffffaa\\">${n}</></> paused the simulation."`)
    });

    Omegga.on('cmd:next', async (n, amount, speed, skip) => {
      try {
        if (!this.isAuthorized(n)) return;

        if (this.running || !this.state) return;

        const times = amount && amount.match(/^\d+$/) ? +amount : 1;
        const wait = speed && speed.match(/^\d+$/) ? +speed : 500;
        const skipAmt = skip && skip.match(/^\d+$/) ? +skip : 1;

         if (times === 1)
          Omegga.broadcast(`"<b><color=\\"ffffaa\\">${n}</></> simulated a single frame."`)
        else
          Omegga.broadcast(`"<b><color=\\"ffffaa\\">${n}</></> started simulation for ${times} ticks over ${Math.round(times/skipAmt*wait/1000)} seconds (${Math.round(1000/wait*skipAmt)} tps)."`)

        this.runSim(times, wait, skipAmt);

      } catch (err) {
        console.error(err);
      }
    });

    Omegga.on('chatcmd:press', async n => {
      try {
        const player = Omegga.getPlayer(n);
        const pos = await player.getPosition();
        const gate = this.state.gates.find(g => g.isInput &&
          Math.hypot(g.meta.position[0]-pos[0], g.meta.position[1]-pos[1]) < 10);
        if (gate) {
          gate.interact();
          Omegga.whisper(player, `"interacted with ${gate.gate}"`);
        }
      } catch (err) {
        // no player
      }
    });

    Omegga.on('cmd:press', async n => {
      try {
        const player = Omegga.getPlayer(n);
        const pos = await player.getPosition();
        const gate = this.state.gates.find(g => g.isInput &&
          Math.hypot(g.meta.position[0]-pos[0], g.meta.position[1]-pos[1]) < 10);
        if (gate) {
          gate.interact();
          Omegga.whisper(player, `"interacted with ${gate.gate}"`);
        }
      } catch (err) {
        // no player
      }
    });

    Omegga.on('cmd:go', async (n, args='') => {
      try {
        if (!this.isAuthorized(n)) return;
        const isClipboard = args.includes('c');
        const isRunning = args.includes('r');
        const hideWires = args.includes('w');
        this.running = false;
        Omegga.broadcast(`"<b><color=\\"ffffaa\\">${n}</></> compiled ${isClipboard ? 'clipboard ':''}logic simulation${hideWires?' without wires':''}."`)

        const data = await (isClipboard ? Omegga.getPlayer(n).getTemplateBoundsData() : Omegga.getSaveData());
        if (!data) return;
        await this.simWithData(data, {hideWires});

        if (isRunning) {
          Omegga.broadcast(`"<b><color=\\"ffffaa\\">${n}</></> started simulation."`)
          this.runSim(10000, 500, 1);
        }

      } catch (err) {
        console.error(err);
      }
    });

    Omegga.on('cmd:clg', async n => {
      if (!this.isAuthorized(n)) return;
      this.running = false;
      Omegga.broadcast(`"<b><color=\\"ffffaa\\">${n}</></> cleared logic bricks."`)
      await Omegga.clearBricks(owners[0], {quiet: true});
      await Omegga.clearBricks(owners[1], {quiet: true});
      await Omegga.clearBricks(owners[2], {quiet: true});
    });

    return {registeredCommands: ['clg', 'go', 'next', 'stop', 'press']};
  }

  async stop() {

  }
};