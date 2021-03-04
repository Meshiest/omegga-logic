const { isAsset, isMaterial } = require('./util.js');

module.exports = class Wire {
  // build wire groupings
  static buildGroups(sim) {
    const groups = [];

    // find neighboring wires
    for (let i = 0; i < sim.wires.length; ++i) {
      const a = sim.wires[i];

      // find adjacent bricks
      const neighboringBricks = sim.tree.search(
        a.bounds.min.shifted(-1, -1, -1),
        a.bounds.max.shifted(1, 1, 1),
      );
      neighboringBricks.delete(i);

      // iterate through neighboring bricks, add all wires to the neighbor list
      for (const j of neighboringBricks) {
        const b = sim.save.bricks[j];
        if (typeof b.wire !== 'undefined' && a.color === b.color) {
          a.neighbors.add(b.wire);
          b.neighbors.add(i);
        }
      }
    }

    // assign groups to every wire
    for (let i = 0; i < sim.wires.length; i++) {
      const wire = sim.wires[i];

      // ignore wires already in a group
      if (wire.group) continue;

      // create a new group
      const id = groups.length + 1;
      const group = [];

      // dfs for groupless wires
      const search = [i];
      while (search.length > 0) {
        const j = search.pop();
        const next = sim.wires[j];
        if (next.group) continue;
        next.group = id;
        group.push(j);

        // add neighbors into the search if they are not already in a group
        for (const n of next.neighbors) {
          if (!sim.wires[n].group && !search.includes(n)) search.push(n);
        }
      }

      // create the group
      groups.push({
        wires: group,
        currPower: 0,
        nextPower: 0,
      });
    }

    return groups;
  }

  // determine if a brick is a wire
  static isWire(brick, sim) {
    if (!isAsset(sim.save, brick, 'PB_DefaultMicroBrick') ||
      !isMaterial(sim.save, brick, 'BMC_Plastic')) return false;

    // get the size of the brick accounting for rotation
    const normal_size = sim.util.brick.getBrickSize(brick, []);
    brick.normal_size = [
      normal_size[sim.util.brick.getScaleAxis(brick, 0)],
      normal_size[sim.util.brick.getScaleAxis(brick, 1)],
      normal_size[sim.util.brick.getScaleAxis(brick, 2)],
    ];

    return (brick.normal_size[0] === 1) + (brick.normal_size[1] === 1) + (brick.normal_size[2] === 1) > 1;
  }
};