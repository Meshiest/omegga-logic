import OmeggaPlugin, { OL, PS, PC, Brick } from 'omegga';
import { InputGate } from './simulator/gates/interface';

const { getScaleAxis } = OMEGGA_UTIL.brick;
import './octtree';
import { OctNode, Point } from './octtree';
import Simulator from './simulator';
import Gate from './simulator/gate';

const owners = [
  {
    name: 'logicbrick',
    id: '94e3f858-452d-4b07-9eff-e82a7a7bd734',
  },
  {
    name: 'logicbrick2',
    id: '94e3f858-452d-4b07-9eff-e82a7a7bd735',
  },
  {
    name: 'logicbrickout',
    id: '94e3f858-452d-4b07-9eff-e82a7a7bd736',
  },
];

// enable wedge wire power visualization (no flickering)
const MULTI_FRAME_MODE = true;

const sleep = t => new Promise(resolve => setTimeout(resolve, t));

type Config = {
  'only-authorized': boolean;
  'authorized-users': { id: string; name: string }[];
};
type Storage = { bar: string };

export default class Logic implements OmeggaPlugin<Config, Storage> {
  omegga: OL;
  config: PC<Config>;
  store: PS<Storage>;

  state: Simulator;
  running: boolean;

  constructor(omegga: OL, config: PC<Config>, store: PS<Storage>) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
    this.state = null;
  }

  // check if a name is authorized
  isAuthorized(name) {
    if (!this.config['only-authorized']) return true;
    const player = Omegga.getPlayer(name);
    return (
      player.isHost() ||
      this.config['authorized-users'].some(p => player.id === p.id)
    );
  }

  // render a logic state to bricks
  async renderState() {
    try {
      const { state } = this;
      const owner = MULTI_FRAME_MODE
        ? owners[1 - (state.frame % 2)]
        : owners[0];
      const outputOwner = owners[2];
      const prevOwner = owners[state.frame % 2];

      const out = {
        version: state.save.version,
        brick_owners: [owner, outputOwner],
        materials: ['BMC_Plastic', 'BMC_Glow'],
        brick_assets: ['PB_DefaultMicroBrick', 'PB_DefaultMicroWedge'],
        colors: state.colors,
        bricks: [],
      };

      const orientation: Brick = {
        direction: state.frame % 2 ? 0 : 0,
        rotation: state.frame % 2 ? 2 : 0,
        size: [0, 0, 0],
        position: [0, 0, 0],
      };
      const axis = [
        getScaleAxis(orientation, 0),
        getScaleAxis(orientation, 1),
        getScaleAxis(orientation, 2),
      ];

      // clear owner bricks (causes flash)
      if (!MULTI_FRAME_MODE) await Omegga.clearBricks(owner, true);
      await Omegga.clearBricks(outputOwner, true);

      for (let i = 0; i < state.errors.length; ++i) {
        const { position, error } = state.errors[i];
        out.bricks.push({
          position: [
            position[0],
            position[1],
            position[2] + 30 + (state.frame % 2) * 20,
          ],
          components: {
            BCD_Interact: {
              bPlayInteractSound: true,
              ConsoleTag: '',
              Message: `<color="ffaaaa">${error}</>`,
            },
          },
          asset_name_index: 0, // regular brick
          size: [2, 2, 10],
          color: [255, 0, 0],
          direction: 4,
          rotation: 0,
          material_intensity: 10,
          material_index: 1,
        } as Brick);
      }

      for (let i = 0; i < state.outputs.length; ++i) {
        const gate = state.outputs[i];
        if (gate.on && !gate.ignore) {
          out.bricks.push(...gate.getOutput(state));
        }
      }

      if (!state.hideWires)
        for (let i = 0; i < state.wires.length; ++i) {
          const brick = state.wires[i];
          const on = state.groups[brick.group - 1].currPower;
          if (!on) continue;

          const newBrick = {
            position: [
              brick.position[0],
              brick.position[1],
              brick.position[2] + 2,
            ],
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
        await Omegga.loadSaveData(out, { quiet: true });

      // clear previous owner after loading bricks to reduce flicker
      if (MULTI_FRAME_MODE) await Omegga.clearBricks(prevOwner, true);
      state.incFrame();
    } catch (err) {
      console.error('render error', err);
    }
  }

  // run a sim with the provided data
  async simWithData(data, options: { hideWires?: boolean } = {}) {
    // get the state of the logic
    const start = Date.now();
    const state = new Simulator(data, OMEGGA_UTIL);
    const duration = (Date.now() - start) / 1000;

    Omegga.broadcast('"<b><color=\\"aaaaff\\">Simulation Compile Stats</></>"');
    Omegga.broadcast(
      `"<code><color=\\"ffffff\\"><size=\\"15\\">- read ${data.bricks.length} bricks</></></>"`
    );
    Omegga.broadcast(
      `"<code><color=\\"ffffff\\"><size=\\"15\\">- detected ${state.wires.length} wires</></></>"`
    );
    Omegga.broadcast(
      `"<code><color=\\"ffffff\\"><size=\\"15\\">- detected ${state.groups.length} groups</></></>"`
    );
    Omegga.broadcast(
      `"<code><color=\\"ffffff\\"><size=\\"15\\">- detected ${state.gates.length} gates</></></>"`
    );
    Omegga.broadcast(
      `"<code><color=\\"ffffff\\"><size=\\"15\\">- detected ${state.circuits} circuits (${state.gateOrder.length} gates)</></></>"`
    );
    if (state.circuits === 0)
      Omegga.broadcast(
        `"<code><color=\\"ffbbbb\\"><size=\\"15\\">  (missing inputs, buffers, or is one large cycle)</></></>"`
      );
    Omegga.broadcast(
      `"<code><color=\\"ffffff\\"><size=\\"15\\">- took ${duration.toLocaleString()} seconds</></></>"`
    );

    await Omegga.clearBricks(owners[0], true);
    await Omegga.clearBricks(owners[1], true);
    await Omegga.clearBricks(owners[2], true);

    if (options.hideWires) state.showWires(false);

    state.next();
    this.state = state;
    this.renderState();
  }

  // run the simulator a number of times, w/ wait ms between frames
  async runSim(times: number, wait: number, skip: number) {
    if (this.running) return;
    this.running = true;

    for (let i = 0; i < times; i++) {
      const state = this.state;
      if (!this.running || !state) return;
      state.next();
      if (i % skip === 0 || i === times - 1) {
        await this.renderState();
        if (times !== 1) await sleep(wait);
      }
    }
    this.running = false;
  }

  async init() {
    Omegga.on('cmd:stop', async n => {
      if (!this.isAuthorized(n)) return;
      this.running = false;
      Omegga.broadcast(
        `"<b><color=\\"ffffaa\\">${n}</></> paused the simulation."`
      );
    });

    Omegga.on('interact', async ({ player, position, message }) => {
      // sim must be running
      if (!player) return;
      const match = message.match(Gate.REGEX);

      // interact must be on a gate
      if (!match) return;

      const inverted = Boolean(match.groups.inverted);
      const index = match.groups.rest === 'index';

      // get the id of the brick from the octree
      const id = this.state?.tree.get(new Point(...position)) ?? -1;
      const brick = this.state?.save.bricks[id] ?? null;
      const gate = brick && this.state.gates[brick?.gate];

      if (match.groups.type === Gate.GATE_PREFIX) {
        const gateType = Gate.gateMap[match.groups.kind];
        if (!gateType) {
          Omegga.middlePrint(
            player.id,
            `${match.groups.kind} is not a valid gate type`
          );
        }

        if (gate && gate instanceof InputGate) {
          gate.interact();
          Omegga.middlePrint(player.id, `"Interacted with ${gate.gate}"`);
        } else {
          const name = gateType.getName();
          const description = gateType.getDescription();
          const connectables = gateType.getConnectables();

          const prelude = `
<size=\\"20\\"><color=\\"afa\\"><b>${name}</></><size=\\"14\\">${
            inverted ? ' (inverted)' : ''
          }${brick?.gate ? ` #${brick.gate}` : ''}</></>
<size=\\"16\\"><color=\\"bbb\\">${description}</></>
${Object.entries(connectables)
  .map(
    ([k, v]) =>
      `${k}: ${
        typeof v === 'number'
          ? v
          : OMEGGA_UTIL.chat.sanitize(v.toString().replace('(n)=>', ''))
      }${
        gate?.['connections']?.[k] ? ` (${gate['connections'][k].length})` : ''
      }`
  )
  .join('\n')}`
            .trim()
            .replace(/\n/g, '<br>');

          Omegga.middlePrint(player.id, `"${prelude}"`);
        }
      } else if (match.groups.type === Gate.IO_PREFIX) {
        Omegga.middlePrint(
          player.id,
          `"IO: ${match.groups.kind}${
            index
              ? ' (index)'
              : match.groups.rest
              ? ` (${match.groups.rest})`
              : ''
          }${inverted ? ' (inverted)' : ''}"`
        );
      }
    });

    Omegga.on('cmd:next', async (n, amount, speed, skip) => {
      try {
        if (!this.isAuthorized(n)) return;

        if (this.running || !this.state) return;

        const times = amount && amount.match(/^\d+$/) ? +amount : 1;
        const wait = speed && speed.match(/^\d+$/) ? +speed : 500;
        const skipAmt = skip && skip.match(/^\d+$/) ? +skip : 1;

        if (times === 1)
          Omegga.broadcast(
            `"<b><color=\\"ffffaa\\">${n}</></> simulated a single frame."`
          );
        else
          Omegga.broadcast(
            `"<b><color=\\"ffffaa\\">${n}</></> started simulation for ${times} ticks over ${Math.round(
              ((times / skipAmt) * wait) / 1000
            )} seconds (${Math.round((1000 / wait) * skipAmt)} tps)."`
          );

        this.runSim(times, wait, skipAmt);
      } catch (err) {
        console.error(err);
      }
    });

    Omegga.on('cmd:go', async (n, args = '') => {
      try {
        if (!this.isAuthorized(n)) return;
        const isClipboard = args.includes('c');
        const isRunning = args.includes('r');
        const hideWires = args.includes('w');
        this.running = false;
        Omegga.broadcast(
          `"<b><color=\\"ffffaa\\">${n}</></> compiled ${
            isClipboard ? 'clipboard ' : ''
          }logic simulation${hideWires ? ' without wires' : ''}."`
        );

        const data = await (isClipboard
          ? Omegga.getPlayer(n).getTemplateBoundsData()
          : Omegga.getSaveData());
        if (!data) return;
        await this.simWithData(data, { hideWires });

        if (isRunning) {
          Omegga.broadcast(
            `"<b><color=\\"ffffaa\\">${n}</></> started simulation."`
          );
          this.runSim(10000, 500, 1);
        }
      } catch (err) {
        console.error(err);
      }
    });

    Omegga.on('cmd:clg', n => {
      if (!this.isAuthorized(n)) return;
      this.running = false;
      Omegga.broadcast(
        `"<b><color=\\"ffffaa\\">${n}</></> cleared logic bricks."`
      );
      Omegga.clearBricks(owners[0], true);
      Omegga.clearBricks(owners[1], true);
      Omegga.clearBricks(owners[2], true);
    });

    // TODO: remove this - previews the octree
    Omegga.on('cmd:logicgriddebug', (name: string) => {
      if (!this.isAuthorized(name)) return;
      if (!this.state) return;
      const player = Omegga.getPlayer(name);

      const bricks = [];
      const brickNode = (n: OctNode<number>) => {
        if ('value' in n.value && n.value.value !== this.state.tree.fill) {
          const brick = this.state.save.bricks[n.value.value];
          const size = 1 << n.depth;
          bricks.push({
            ...brick,
            owner_index: 1,
            asset_name_index: 0,
            size: [size, size, size],
            position: [
              n.pos.x * 2 + size,
              n.pos.y * 2 + size,
              n.pos.z * 2 + size,
            ],
            components: {
              BCD_Interact: {
                Message: `i=${n.value.value}
[${n.pos.x}, ${n.pos.y}, ${n.pos.z}]
${[
  (gate =>
    typeof gate !== 'undefined' &&
    `gate: #${gate ?? ''} ${this.state.gates[gate].gate ?? ''}`)(brick.gate),
  (wire =>
    typeof wire !== 'undefined' &&
    `wire: #${wire ?? ''} ${this.state.wires[wire]?.group ?? ''}`)(brick.wire),
  ((index, type, gate) =>
    type &&
    `io: ${type}.${index} [${[
      ...(this.state.gates[gate]?.['connections']?.[type][index] ?? new Set()),
    ].join(' ')}]`)(brick.ioIndex, brick.ioType, brick.ownerGate),
]
  .filter(Boolean)
  .join('\n')}
${
  this.state.save.bricks[n.value.value].components?.BCD_Interact?.ConsoleTag ??
  ''
}
${
  '' &&
  JSON.stringify(this.state.save.bricks[n.value.value].bounds).replace(/"/g, '')
}
`
                  .trim()
                  .replace(/\n+/g, '<br>'),
                bPlayInteractSound: false,
                ConsoleTag: '',
              },
            },
          } as Brick);
        }
        if ('nodes' in n.value) {
          n.value.nodes.forEach(brickNode);
        }
      };
      for (const chunk of this.state.tree.chunks) {
        brickNode(chunk);
      }
      if (bricks.length > 0)
        player.loadSaveData({
          materials: this.state.save.materials,
          colors: this.state.save.colors,
          brick_assets: ['PB_DefaultMicroBrick'],
          brick_owners: [player],
          bricks,
        });
    });

    /*     Omegga.on('cmd:removemessage', async (name: string) => {
      const player = Omegga.getPlayer(name);
      if (!player.isHost()) return;

      try {
        const data = await player.getTemplateBoundsData();
        if (!data || data.version !== 10) return;

        for (const brick of data.bricks) {
          if (!('BCD_Interact' in brick.components)) continue;
          brick.components.BCD_Interact.Message = '';
        }

        await player.loadSaveData(data);
      } catch (err) {
        console.error('error in recomponent', err);
      }
    }); */

    return {
      registeredCommands: ['clg', 'go', 'next', 'stop', 'logicgriddebug'],
    };
  }

  async stop() {}
}
