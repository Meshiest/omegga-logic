const { Point } = require('../octtree.js');

// benchmarking
const times = {};
const benchStart = name => times[name] = Date.now();
const benchEnd = name => console.info(name, 'took', (Date.now()-times[name])/1000 + 's');

// check an asset/material for a match
const isAsset = (save, brick, name) => save.brick_assets[brick.asset_name_index] === name;
const isMaterial = (save, brick, name) => save.materials[brick.material_index] === name;
const isBlack = ([r, g, b,]) => !r && !g && !b;

// convert a save to an octtree
const populateTreeFromSave = (save, tree, util) => {
  for (let i = 0; i < save.bricks.length; i++) {
    const brick = save.bricks[i];
    // get normalized sizes for every brick
    const normal_size = util.brick.getBrickSize(brick, save.brick_assets);
    const size = [
      normal_size[util.brick.getScaleAxis(brick, 0)],
      normal_size[util.brick.getScaleAxis(brick, 1)],
      normal_size[util.brick.getScaleAxis(brick, 2)],
    ];

    // build boundaries from the normalized size
    brick.bounds = {
      min: new Point(brick.position[0] - size[0], brick.position[1] - size[1], brick.position[2] - size[2]),
      max: new Point(brick.position[0] + size[0], brick.position[1] + size[1], brick.position[2] + size[2]),
    };
    brick.normal_size = size;

    // add it into the tree
    tree.insert(i, brick.bounds.min, brick.bounds.max);
  }
};

// search a specific side of a brick
const searchBoundsSide = (tree, bounds, side) => {
  switch (side) {
  case 0: return tree.search( // search x positive
    new Point(bounds.max.x  , bounds.min.y  , bounds.min.z),
    new Point(bounds.max.x+1, bounds.max.y  , bounds.max.z));
  case 1: return tree.search( // search y positive
    new Point(bounds.min.x  , bounds.max.y  , bounds.min.z),
    new Point(bounds.max.x  , bounds.max.y+1, bounds.max.z));
  case 2: return tree.search( // search x negative
    new Point(bounds.min.x-1, bounds.min.y  , bounds.min.z),
    new Point(bounds.min.x  , bounds.max.y  , bounds.max.z));
  case 3: return tree.search( // search y negative
    new Point(bounds.min.x  , bounds.min.y-1, bounds.min.z),
    new Point(bounds.max.x  , bounds.min.y  , bounds.max.z));
  }
  return new Set();
};

// get direction index from two positions
const getDirection = (a, b) =>
  Math.floor(Math.atan2(
    a[1] - b[1],
    a[0] - b[0]
  ) / Math.PI * 2 + 2);

module.exports = {
  benchStart, benchEnd,
  isAsset, isMaterial, isBlack,
  getDirection,

  populateTreeFromSave,
  searchBoundsSide,
};