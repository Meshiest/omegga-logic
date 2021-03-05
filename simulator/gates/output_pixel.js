const { OutputGate } = require('./interface.js');
module.exports = class PixelOutput extends OutputGate {
  static getName() { return '1bitpixel'; }
  static getMarker() { return 'PB_DefaultTile'; }
  static extendMeta(meta, { markerBricks }) {
    const plate = markerBricks[0];
    meta.output = {
      position: [
        plate.position[0],
        plate.position[1],
        plate.position[2] + plate.normal_size[2] + 3
      ],
      size: [
        plate.normal_size[0],
        plate.normal_size[1],
        1,
      ],
      normal_size: [
        plate.normal_size[0],
        plate.normal_size[1],
        1,
      ],
      color: [255, 255, 255],
      collision: {
        tool: false,
        player: false,
        interaction: false,
        weapon: false,
      },
      owner_index: 1,
      material_index: 7,
      material_index: 1,
    };
  }
  getOutput(sim) {
    const orientation = {direction: sim.frame % 2 ? 0 : 0, rotation: sim.frame % 2 ? 2 : 0};
    const axis = [
      sim.util.brick.getScaleAxis(orientation, 0),
      sim.util.brick.getScaleAxis(orientation, 1),
      sim.util.brick.getScaleAxis(orientation, 2),
    ];

    this.meta.output.asset_name_index = 1;
    this.meta.output.size = [
      this.meta.output.normal_size[axis[0]],
      this.meta.output.normal_size[axis[1]],
      this.meta.output.normal_size[axis[2]],
    ];
    this.meta.output.direction = orientation.direction;
    this.meta.output.rotation = orientation.rotation;

    return [this.meta.output];
  }
};
