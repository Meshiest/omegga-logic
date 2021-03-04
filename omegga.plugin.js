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

  // render a logic state to bricks
  static async renderState(state) {
    const owner =  MULTI_FRAME_MODE ? owners[1 - state.frame % 2] : owners[0];
    const prevOwner = owners[state.frame % 2];

    const out = {
      version: 10,
      brick_owners: [owner],
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

    for (let i = 0; i < state.wires.length; i++) {
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

      out.bricks.push(newBrick);
    }
    await Omegga.loadSaveData(out, {quiet: true});
    // clear previous owner after loading bricks to reduce flicker
    if (MULTI_FRAME_MODE)
      await Omegga.clearBricks(prevOwner, {quiet: true});
  }

  async init() {
    Omegga.on('cmd:stop', async n => {
      if (!Omegga.getPlayer(n).isHost()) return;
      this.running = false;
    });

    Omegga.on('cmd:next', async (n, amount, speed) => {
      try {
        if (!Omegga.getPlayer(n).isHost()) return;

        if (this.running) return;

        const times = amount && amount.match(/^\d+$/) ? +amount : 1;
        const wait = speed && speed.match(/^\d+$/) ? +speed : 500;
        this.running = true;

        for (let i = 0; i < times; i++) {
          const state = this.state;
          if (!this.running || !state) return;
          state.next();
          await Logic.renderState(state);
          await sleep(wait);
        }
        this.running = false;

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

    Omegga.on('cmd:go', async n => {
      try {
        if (!Omegga.getPlayer(n).isHost()) return;

        const data = await Omegga.getSaveData();

        // get the state of the logic
        const state = new Simulator(data, global.OMEGGA_UTIL);
        this.state = state;

        Omegga.broadcast('"Stats:"');
        Omegga.broadcast(`"- read ${data.brick_count} bricks"`);
        Omegga.broadcast(`"- detected ${state.wires.length} wires"`);
        Omegga.broadcast(`"- detected ${state.groups.length} groups"`);
        Omegga.broadcast(`"- detected ${state.gates.length} gates"`);

        await Omegga.clearBricks(owners[0], {quiet: true});
        await Omegga.clearBricks(owners[1], {quiet: true});

        state.next();
        await Logic.renderState(state);

      } catch (err) {
        console.error(err);
      }
    });
    Omegga.on('cmd:clg', async n => {
      if (!Omegga.getPlayer(n).isHost()) return;
      this.running = false;
      await Omegga.clearBricks(owners[0], {quiet: true});
      await Omegga.clearBricks(owners[1], {quiet: true});
    });

    return {registeredCommands: ['clg', 'go', 'next', 'stop']};
  }

  async stop() {

  }
};