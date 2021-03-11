const { SpecialGate } = require('./interface.js');
const PixelOutput = require('./output_pixel.js');
module.exports = class RGBOutput extends SpecialGate {
  static getName() { return 'rgbpixel'; }
  static getMarker() { return 'PB_DefaultMicroBrick'; }
  static getMarkerCount() { return -1; }
  static validateConnectables(markers) {
    if (markers.color.length % 3 !== 0)
      return `#markers must be divisible by 3`;
    return;
  };
  static extendMeta(meta, {brick, sim}) {
    meta.output = {
      position: [
        brick.position[0],
        brick.position[1],
        brick.position[2] + brick.normal_size[2] + 7,
      ],
      size: [
        brick.normal_size[0]+5,
        brick.normal_size[1]+5,
        1,
      ],
      normal_size: [
        brick.normal_size[0]+5,
        brick.normal_size[1]+5,
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
      material_intensity: 0,
      material_index: 1,
    };
    meta.brick_color = sim.save.colors[brick.color];
  }
  static getConnectables() { return {
    color: n => n >= 0 && n < 24, // colors
    write: n => n < 2, // on
  }; }
  constructor(brick, meta) {
    super(brick, meta);
    this.isOutput = true;
    this.on = false;
    this.color = [0, 0, 0];
    // steal output function of the pixel output
    this.getOutput = PixelOutput.prototype.getOutput.bind(this);
  }
  init() {
    this.on = this.connections.write.length === 0 || this.connections.write[0].inverted;
    if (this.connections.color.length === 0)
      this.color = this.meta.brick_color;
  }
  evaluate(sim) {
    const { color: colors, write: [write] } = this.connections;

    // turn on when write is on, if there is a write
    if (write) {
      this.on = sim.getGroupPower(write).some(g=>g) !== write.inverted;
    }

    // write color if color nodes are attached and the output is on
    if (colors.length > 0 && this.on) {
      const color = [0, 0, 0];
      const bits = colors.length/3;
      for (let i = 0; i < colors.length; ++i) {
        if (sim.getGroupPower(colors[i]).some(g=>g) !== colors[i].inverted)
          color[Math.floor(i/bits)] |= 1<<(i%bits);
      }


      // convert to appropriate range
      for (let i = 0; i < 3; i++) {
        color[i] = color[i]*255/((1<<bits)-1);
      }
      // update the color
      this.color = sim.util.color.linearRGB(color);
    }

    if (this.on) {
      this.meta.output.color = this.color;
    }
  }
};
