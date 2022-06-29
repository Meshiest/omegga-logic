import Simulator from 'simulator';
import { isAsset, isBlack, isMaterial, LogicBrick, LogicBRS } from './util';

export default class Wire {
  // build wire groupings
  static buildGroups(sim: Simulator) {
    const groups: {
      wires: number[];
      currPower: boolean;
      nextPower: boolean;
    }[] = [];

    // find neighboring wires
    for (let i = 0; i < sim.wires.length; ++i) {
      const a = sim.wires[i];
      if (typeof a.color !== 'number') continue;

      // find adjacent bricks
      const neighboringBricks = sim.tree.search(
        a.bounds.min.shifted(-1, -1, -1),
        a.bounds.max.shifted(1, 1, 1)
      );
      neighboringBricks.delete(i);

      // iterate through neighboring bricks, add all wires to the neighbor list
      for (const j of neighboringBricks) {
        const b = sim.save.bricks[j];
        if (
          typeof b.wire !== 'undefined' &&
          (a.color === b.color || isBlack(sim.save.colors[a.color]))
        ) {
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
        currPower: false,
        nextPower: false,
      });
    }

    return groups;
  }

  // determine if a brick is a wire
  static isWire(brick: LogicBrick, data: LogicBRS | Simulator) {
    if (
      !isAsset(
        'save' in data ? data.save : data,
        brick,
        'PB_DefaultMicroBrick'
      ) ||
      !isMaterial('save' in data ? data.save : data, brick, 'BMC_Plastic')
    )
      return false;

    return (
      (brick.normal_size[0] === 1 ? 1 : 0) +
        (brick.normal_size[1] === 1 ? 1 : 0) +
        (brick.normal_size[2] === 1 ? 1 : 0) >
      1
    );
  }
}
