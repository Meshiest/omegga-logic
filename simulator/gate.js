const { isAsset, isMaterial, getDirection } = require('./util.js');
const { Point } = require('../octtree.js');

class Gate {
  // brick asset and material that all gates must be made of
  static CHIP_ASSET = 'PB_DefaultSmoothTile';
  static CHIP_MATERIAL = 'BMC_Metallic';

  // flag that marks this gate as a special gate
  static SPECIAL_GATE_ID = 'PB_DefaultMicroWedgeCorner';

  // indicators for each special bricks
  static SPECIAL_MARKERS = {
    PB_DefaultWedge: 'input',
    PB_DefaultRampCrest: 'secondary',
    PB_DefaultRampCrestEnd: 'output',
    B_1x1F_Round: 'reset',
    B_1x1F_Octo: 'clock',
    B_Small_Flower: 'clr',
    PB_DefaultTile: 'write',
    PB_DefaultMicroBrick: 'color',
    PB_DefaultRampCrestCorner: '',
    PB_DefaultMicroWedgeCorner: '',
    PB_DefaultSideWedgeTile: '',
    PB_DefaultSideWedge: '',
  };

  // map brick assets to gates
  static specialGates = [];
  static gateAssetMap = {};

  // add the gate to the gate map
  static registerGate(gate) {
    this.gateAssetMap[gate.getMarker()] = gate;
  }

  // add the special gate to the gate list
  static registerSpecial(gate) {
    this.specialGates.push(gate);
  }

  // determine if a brick is a wire
  static isGate(brick, sim) {
    return isAsset(sim.save, brick, this.CHIP_ASSET) &&
      isMaterial(sim.save, brick, this.CHIP_MATERIAL) &&
      brick.direction === 4 && this.assemble(brick, sim);
  }

  // find bricks above this brick that have the same material and color
  static getMarkers(b, sim) {
    // find all bricks above this brick
    const aboveBrickIndices = sim.tree.search(
      new Point(b.bounds.min.x, b.bounds.min.y, b.bounds.max.z),
      new Point(b.bounds.max.x, b.bounds.max.y, b.bounds.max.z + 1),
    );

    // get valid bricks from the above bricks
    const bricks = [];
    for (const i of aboveBrickIndices) {
      const brick = sim.save.bricks[i];
      if (brick !== b &&
        brick.color === b.color &&
        brick.material_index === b.material_index) {
        brick.used = true;
        bricks.push(brick);
      }
    }

    return bricks;
  }

  // extract gate type from a brick
  static assemble(brick, sim) {
    // detect marker brick assets
    const markerBricks = this.getMarkers(brick, sim);

    // get the brick assets from the marker bricks
    const markers = {};
    for (const b of markerBricks) {
      const asset = sim.save.brick_assets[b.asset_name_index];
      markers[asset] = (markers[asset] || 0) + 1;
    }

    // ignore empty markers
    if (!markerBricks.length) {
      console.log('!! missing markers on gate @', brick.position);
      return 'error';
    }

    // the microbrick is the inverted marker
    const inverted = !!markers.PB_DefaultMicroBrick;

    let Gate, indicator, connectables, count = 0;

    // special gates have separate indicators than regular gates
    if (markers[this.SPECIAL_GATE_ID]) {
      // find the indicator brick and gate marker
      for (const m of markerBricks) {
        const markerAsset = sim.save.brick_assets[m.asset_name_index];
        if (markerAsset === this.SPECIAL_GATE_ID)
          indicator = m;

        if (!Gate) {
          for (const g of this.specialGates) {
            const markerCount = g.getMarkerCount();
            if (g.getMarker() === markerAsset && (markerCount < 0 || markers[markerAsset] === markerCount)) {
              Gate = g;
              break;
            }
          }
        } else if (indicator) break;
      }

      // missing indicator
      if (!indicator) {
        console.log('!! failed to find indicator for gate @', brick.position, markers);
        return 'error';
      }

      // missing gate
      if (!Gate) {
        console.log('!! failed to identify gate @', brick.position, markers);
        return 'error';
      }

      connectables = {};

      // find the meaningful markers
      const requirements = Gate.getConnectables();
      for (const ioType in requirements) {
        const req = requirements[ioType];
        const items = markerBricks.filter(b => this.SPECIAL_MARKERS[sim.save.brick_assets[b.asset_name_index]] === ioType);
        if (typeof req === 'function' ? !req(items.length) : req !== items.length) {
          console.log('!!', Gate.getName(), '@', brick.position, 'has unsatisifed', ioType);
          console.log(markers);
          return 'error';
        }
        connectables[ioType] = items.map(i => {
          const bounds = i.bounds;
          bounds.inverted = i.direction === 5;
          return bounds;
        });
      }
      const err = Gate.validateConnectables(connectables);
      if (err) {
        console.log('!!', Gate.getName(), '@', brick.position, 'invalid connections:', err);
        return 'error';
      }
    } else {
      // find the regular gate indicator
      for (const m of markerBricks) {
        const foundGate = this.gateAssetMap[sim.save.brick_assets[m.asset_name_index]];
        if (foundGate) {
          indicator = m;
          Gate = foundGate;
        }
      }

      if (!indicator) {
        console.log('!! failed to find indicator for gate @', brick.position, markers);
        return 'error';
      }

      if (!Gate) {
        console.log('!! failed to find gate @', brick.position, markers);
        return 'error';
      }
    }

    // get the gate's rotation
    const direction = getDirection(brick.position, indicator.position);

    const meta = {
      bounds: brick.bounds, position: brick.position,
      inverted, direction, connectables,
    };

    Gate.extendMeta(meta, {brick, sim, markerBricks, markers, indicator});

    return new Gate(brick, meta);
  }
};

module.exports = Gate;