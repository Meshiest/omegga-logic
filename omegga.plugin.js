const owner = {
  name: 'logicbrick',
  id: '94e3f858-452d-4b07-9eff-e82a7a7bd734',
};

const { getBrickSize, getScaleAxis } = global.OMEGGA_UTIL.brick;
const ChunkTree = require('./octtree.js');
const { Point } = ChunkTree;

// scan above a provided brick for marker bricks
const getMarkerBricks = (tree, save, b) => {
  // find all bricks above this brick
  const aboveBrickIndices = tree.search(
    new Point(b.bounds.min.x, b.bounds.min.y, b.bounds.max.z),
    new Point(b.bounds.max.x, b.bounds.max.y, b.bounds.max.z + 1),
  );

  const bricks = [];
  for (const i of aboveBrickIndices) {
    const brick = save.bricks[i];
    if (brick.color === b.color &&
      brick.material_index === b.material_index &&
      brick.size[0] <= 1 && brick.size[1] <= 1 && brick.size[2] <= 1) {
      bricks.push(brick);
    }
  }
  return bricks;
};

const sleep = t => new Promise(resolve => setTimeout(resolve, t));


// check an asset/material for a match
const isAsset = (save, brick, name) => save.brick_assets[brick.asset_name_index] === name;
const isMaterial = (save, brick, name) => save.materials[brick.material_index] === name;

// benchmarking
const times = {};
const benchStart = name => times[name] = Date.now();
const benchEnd = name => console.info(name, 'took', (Date.now()-times[name])/1000 + 's');

// gate brick assets to brick types
const GATE_TYPES = {
  'PB_DefaultMicroWedge': 'and',
  'PB_DefaultMicroWedgeOuterCorner': 'or',
  'PB_DefaultMicroWedgeInnerCorner': 'xor',
  'PB_DefaultMicroWedgeTriangleCorner': 'buffer',
  'B_2x2F_Octo_Converter': 'button',
  'B_1x2f_Plate_Center': 'lever',
};

const GATE_INPUTS = ['button', 'lever'];

// gate functions (inputs => output)
const GATE_FNS = {
  and: inputs => inputs.length > 0 && inputs.every(i => i),
  or: inputs => inputs.some(i => i),
  buffer: inputs => inputs.some(i => i),
  xor: inputs => {
    let ok = false;
    for (const i of inputs) {
      if (ok && i) return false;
      if (i) ok = true;
    }
    return ok;
  },
  button: (_, gate) => {
    if (gate.pressed > 0) {
      gate.pressed --;
    }
    return gate.pressed > 0;
  },
  lever: (_, gate) => {
    return !!gate.pressed;
  }
};

// determine if two bounds overlap
const boundsOverlap = (a, b) => {
  const xOverlapAtoB = a[0][0] <= b[0][0] && b[0][0] <= a[0][1] || a[0][0] <= b[0][1] && b[0][1] <= a[0][1];
  const yOverlapAtoB = a[1][0] <= b[1][0] && b[1][0] <= a[1][1] || a[1][0] <= b[1][1] && b[1][1] <= a[1][1];
  const zOverlapAtoB = a[2][0] <= b[2][0] && b[2][0] <= a[2][1] || a[2][0] <= b[2][1] && b[2][1] <= a[2][1];
  const xOverlapBtoA = b[0][0] <= a[0][0] && a[0][0] <= b[0][1] || b[0][0] <= a[0][1] && a[0][1] <= b[0][1];
  const yOverlapBtoA = b[1][0] <= a[1][0] && a[1][0] <= b[1][1] || b[1][0] <= a[1][1] && a[1][1] <= b[1][1];
  const zOverlapBtoA = b[2][0] <= a[2][0] && a[2][0] <= b[2][1] || b[2][0] <= a[2][1] && a[2][1] <= b[2][1];

  return xOverlapAtoB && yOverlapAtoB && zOverlapAtoB ||
    xOverlapBtoA && yOverlapBtoA && zOverlapBtoA;
};

// get direction index from two positions
const getDirection = (a, b) =>
  Math.floor(Math.atan2(
    a[1] - b[1],
    a[0] - b[0]
  ) / Math.PI * 2 + 2);

module.exports = class Logic {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.state = {save: {bricks:[]}, wires: [], groups: [], gates: [], tree: new ChunkTree(-1)};
  }

  // determine if a plate is a gate
  static isGate(tree, save, brick) {
    return isAsset(save, brick, 'PB_DefaultSmoothTile') &&
      isMaterial(save, brick, 'BMC_Metallic') &&
      brick.direction === 4 &&
      Logic.getGateType(tree, save, brick);
  }

  // determine if a brick is a wire
  static isWire(save, brick) {
    if (!isAsset(save, brick, 'PB_DefaultMicroBrick') ||
      !isMaterial(save, brick, 'BMC_Plastic')) return false;

    // get the size of the brick accounting for rotation
    const normal_size = getBrickSize(brick, []);
    brick.normal_size = [
      normal_size[getScaleAxis(brick, 0)],
      normal_size[getScaleAxis(brick, 1)],
      normal_size[getScaleAxis(brick, 2)],
    ];
    return brick.normal_size[2] === 1 && !(brick.normal_size[0] !== 1 && brick.normal_size[1] !== 1);
  }

  // extract gate type from a brick
  static getGateType(tree, save, brick) {
    // detect marker brick assets
    const markerBricks = getMarkerBricks(tree, save, brick, 4);

    // get the brick assets from the marker bricks
    const markers = markerBricks.map(b => save.brick_assets[b.asset_name_index]);

    // determine if any of these markers are gate markers
    const gate = GATE_TYPES[markers.find(type => GATE_TYPES[type])];
    if (!gate) {
      console.log('failed to find gate', markers);
      return false;
    }

    // the microbrick is the inverted marker
    const inverted = markers.includes('PB_DefaultMicroBrick');

    // get the normalized bounds of the baseplate
    const normal_size = getBrickSize(brick, []);
    const size = [
      normal_size[getScaleAxis(brick, 0)],
      normal_size[getScaleAxis(brick, 1)],
      normal_size[getScaleAxis(brick, 2)],
    ];
    const bounds = [
      [brick.position[0] - size[0], brick.position[0] + size[0]],
      [brick.position[1] - size[1], brick.position[1] + size[1]],
      [brick.position[2] - size[2], brick.position[2] + size[2]],
    ];

    // get the gate's rotation
    const direction = getDirection(brick.position, markerBricks[0].position);

    return {
      gate,
      inverted,
      position: brick.position,
      bounds,
      direction,
      inputs: new Set(), // input groups
      outputs: new Set(), // output groups
    };
  }

  // determine if a wire bordering a gate is an output
  static isGateOutput(gate, wire) {
    // this is an input gate, every side is an output
    if (GATE_INPUTS.includes(gate.gate)) return true;

    const a = gate.bounds, b = wire.bounds;
    const xOverlapMin = a[0][0] <= b[0][0] && b[0][0] <= a[0][1];
    const xOverlapMax = a[0][0] <= b[0][1] && b[0][1] <= a[0][1];
    const yOverlapMin = a[1][0] <= b[1][0] && b[1][0] <= a[1][1];
    const yOverlapMax = a[1][0] <= b[1][1] && b[1][1] <= a[1][1];

    return (!xOverlapMax && gate.direction === 0 ||
      !yOverlapMax && gate.direction === 1 ||
      !xOverlapMin && gate.direction === 2 ||
      !yOverlapMin && gate.direction === 3);
  }

  // from bricks, assemble a logic state
  static buildStateFromSave(data) {
    const wires = []; // wire bricks
    const gates = []; // logic gate bricks
    const groups = []; // wire groups
    const tree = new ChunkTree(-1);

    benchStart('build');
    benchStart('octtree');
    for (let i = 0; i < data.brick_count; i++) {
      const brick = data.bricks[i];
      const normal_size = getBrickSize(brick, data.brick_assets);
      const size = [
        normal_size[getScaleAxis(brick, 0)],
        normal_size[getScaleAxis(brick, 1)],
        normal_size[getScaleAxis(brick, 2)],
      ];
      brick.bounds = {
        min: new Point(brick.position[0] - size[0], brick.position[1] - size[1], brick.position[2] - size[2]),
        max: new Point(brick.position[0] + size[0], brick.position[1] + size[1], brick.position[2] + size[2]),
      };
      brick.normal_size = size;
      tree.insert(i, brick.bounds.min, brick.bounds.max);
    }
    benchEnd('octtree');

    benchStart('selection');
    let times = [0, 0, 0];
    // classify each brick from the save
    for (const brick of data.bricks) {
      let start = Date.now(), index = 0;
      // if a brick is a gate, store the gate
      const gate = Logic.isGate(tree, data, brick);
      if (gate) {
        index = 1;
        brick.used = true;
        gates.push(gate);
      }

      // if the brick is a wire, add it to the list of wires
      else if (Logic.isWire(data, brick)) {
        index = 2;
        brick.used = true;
        brick.neighbors = new Set();
        brick.bounds = [
          [brick.position[0] - brick.normal_size[0], brick.position[0] + brick.normal_size[0]],
          [brick.position[1] - brick.normal_size[1], brick.position[1] + brick.normal_size[1]],
          [brick.position[2] - brick.normal_size[2], brick.position[2] + brick.normal_size[2]],
        ];
        wires.push(brick);
      }

      times[index] += Date.now() - start;
    }
    benchEnd('selection');

    benchStart('neighbors');
    // check wire borders
    for (let i = 0; i < wires.length; i++) {
      const a = wires[i];

      // determine the gates this wire is bordering
      a.inputs = [];
      a.outputs = [];
      for (let j = 0; j < gates.length; j++) {
        const gate = gates[j];
        if (!boundsOverlap(a.bounds, gate.bounds)) continue;
        if (Logic.isGateOutput(gate, a)) {
          a.inputs.push(j);
        } else {
          a.outputs.push(j);
        }
      }

      // determine the wires this wire is bordering
      for (let j = 0; j < wires.length; j++) {
        if (i === j) continue;
        const b = wires[j];
        if (a.color !== b.color || a.neighbors.has(j)) continue;

        // check if the bounds overlap
        if (boundsOverlap(a.bounds, b.bounds)) {
          a.neighbors.add(j);
          b.neighbors.add(i);
        }
      }
    }
    benchEnd('neighbors');

    benchStart('grouping');
    // assign groups to every wire
    for (let i = 0; i < wires.length; i++) {
      const wire = wires[i];

      // ignore wires already in a group
      if (wire.group) continue;

      // create a new group
      const id = groups.length + 1;
      const group = [];

      // dfs for groupless wires
      const search = [i];
      while (search.length > 0) {
        const j = search.pop();
        const next = wires[j];
        if (next.group) continue;
        next.group = id;
        group.push(j);

        // add neighbors into the search if they are not already in a group
        for (const n of next.neighbors) {
          if (!wires[n].group && !search.includes(n)) search.push(n);
        }
      }

      const inputs = new Set(group.flatMap(i => wires[i].inputs));
      const outputs = new Set(group.flatMap(i => wires[i].outputs));

      for (const i of inputs) gates[i].outputs.add(id);
      for (const i of outputs) gates[i].inputs.add(id);

      // create the group, keep track of inputs and outputs
      groups.push({
        wires: group, inputs, outputs,
        currPower: 0,
        nextPower: 0,
      });
    }
    benchEnd('grouping');
    benchEnd('build');

    for (const gate of gates) {
      // skip pointless gates
      if (!gate.outputs.size && !gate.renders) continue;

      // get the inputs from the adjacent groups' powers
      const inputs = Array.from(gate.inputs).map(i => groups[i-1].currPower);

      // calculate the output
      const output = GATE_FNS[gate.gate](inputs, gate) != gate.inverted;

      // set the output groups current powers for the first cycle
      for (const o of gate.outputs) {
        groups[o-1].currPower = output;
      }
    }

    // build a logic state
    return {
      groups,
      gates,
      wires,
      colors: data.colors.slice(),
    };
  }

  // advance the state of the sim
  static advanceState(state) {
    for (const gate of state.gates) {
      // skip pointless gates
      if (!gate.outputs.size && !gate.renders) continue;

      // get the inputs from the adjacent groups' powers
      const inputs = Array.from(gate.inputs).map(i => state.groups[i-1].currPower);

      // calculate the output
      const output = GATE_FNS[gate.gate](inputs, gate) != gate.inverted;

      // set the output groups powers
      for (const o of gate.outputs) {
        state.groups[o-1].nextPower = output;
      }
    }

    // update power states for the group
    for (const group of state.groups) {
      group.currPower = group.nextPower;
    }
  }

  static async renderState(state) {
    await Omegga.clearBricks(owner, {quiet: true});
    const out = {
      version: 10,
      brick_owners: [owner],
      materials: ['BMC_Plastic', 'BMC_Glow'],
      brick_assets: ['PB_DefaultMicroBrick'],
      colors: state.colors,
      bricks: [],
    };

    for (let i = 0; i < state.wires.length; i++) {
      const brick = state.wires[i];
      const on = state.groups[brick.group-1].currPower;
      if (!on) continue;

      out.bricks.push({
        position: [brick.position[0], brick.position[1], brick.position[2] + 2],
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
      });
    }
    await Omegga.loadSaveData(out, {quiet: true});
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
          if (!this.running) return;
          Logic.advanceState(state);
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
        const gate = this.state.gates.find(g => GATE_INPUTS.includes(g.gate) &&
          Math.hypot(g.position[0]-pos[0], g.position[1]-pos[1]) < 10);
        if (gate) {
          gate.pressed = gate.gate === 'button' ? 3 : !gate.pressed;
          Omegga.whisper(player, `"pressed ${gate.gate} to ${gate.pressed ? 'on' : 'off'}"`);
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
        const state = Logic.buildStateFromSave(data);
        this.state = state;

        Omegga.broadcast('"Stats:"');
        Omegga.broadcast(`"- read ${data.brick_count} bricks"`);
        Omegga.broadcast(`"- detected ${state.wires.length} wires"`);
        Omegga.broadcast(`"- detected ${state.groups.length} groups"`);
        Omegga.broadcast(`"- detected ${state.gates.length} gates"`);

        await Logic.renderState(state);

      } catch (err) {
        console.error(err);
      }
    });
    Omegga.on('cmd:clg', async n => {
      if (!Omegga.getPlayer(n).isHost()) return;
      this.running = false;
      await Omegga.clearBricks(owner, {quiet: true});
    });

    return {registeredCommands: ['clg', 'go', 'next', 'stop']};
  }

  async stop() {

  }
};