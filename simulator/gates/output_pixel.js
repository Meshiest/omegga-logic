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
      color: [255, 255, 255],
      collision: {
        tool: false,
        player: false,
        interaction: false,
        weapon: false,
      },
      owner_index: 2,
      material_index: 7,
      material_index: 1,
    };
  }
  getOutput() {
    return [this.meta.output];
  }
};
