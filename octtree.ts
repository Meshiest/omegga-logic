const CHUNK_SIZE = 1024;
const RIGHT = 1;
const TOP = 2;
const BACK = 4;

type DistArgs = [x: number, y: number, z: number] | [p: Point];

// a point in space
export class Point {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static rect(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number
  ) {
    return [
      new Point(x - w / 2, y - h / 2, z - d / 2),
      new Point(x + w / 2, y + h / 2, z + d / 2),
    ];
  }

  // get a chunk from a point
  getChunk() {
    return new Point(
      Math.floor(this.x / CHUNK_SIZE),
      Math.floor(this.y / CHUNK_SIZE),
      Math.floor(this.z / CHUNK_SIZE)
    );
  }

  // returns true if this point is between the other two
  in(min: Point, max: Point) {
    return (
      min.x <= this.x &&
      this.x <= max.x &&
      min.y <= this.y &&
      this.y <= max.y &&
      min.z <= this.z &&
      this.z <= max.z
    );
  }

  // get the octant the point should be in for a node
  getOctant(child: Point, depth: number) {
    if (depth === 0) return 0;

    return (
      ((child.x - this.x) >> (depth - 1) > 0 ? RIGHT : 0) |
      ((child.y - this.y) >> (depth - 1) > 0 ? TOP : 0) |
      ((child.z - this.z) >> (depth - 1) > 0 ? BACK : 0)
    );
  }

  // get the middle of a chunk
  getChunkMidpoint() {
    return new Point(
      this.x * CHUNK_SIZE,
      this.y * CHUNK_SIZE,
      this.z * CHUNK_SIZE
    );
  }

  // compare points
  eq(point: Point) {
    return this.x == point.x && this.y == point.y && this.z == point.z;
  }

  // return a copy of this point shifted
  shifted(x: number, y: number, z: number) {
    return new Point(this.x + x, this.y + y, this.z + z);
  }

  dist(...args: DistArgs) {
    const [x, y, z] = args.length === 3 ? args : args[0].arr();
    return Math.hypot(this.x - x, this.y - y, this.z - z);
  }

  arr() {
    return [this.x, this.y, this.z];
  }

  // stringified points are <x, y, z>
  toString() {
    return `<${this.x}, ${this.y}, ${this.z}>`;
  }
}

type OctNodeValue<T> =
  // | { unchanged: true } // unused, for diffing
  { value: T | null } | { nodes: OctNode<T>[] };

// a node in the tree
export class OctNode<T> {
  pos: Point;
  depth: number;
  value: OctNodeValue<T>;
  chunk?: Point;

  constructor(pos: Point, depth: number, value: T | null) {
    this.pos = pos;
    this.depth = depth;
    this.value = { value };
  }

  // true if this node is contained by the bounds
  isInside(min: Point, max: Point) {
    const size = 1 << this.depth;
    // check if this bounds are entirely within
    return (
      this.pos.x >= min.x &&
      this.pos.x + size <= max.x &&
      this.pos.y >= min.y &&
      this.pos.y + size <= max.y &&
      this.pos.z >= min.z &&
      this.pos.z + size <= max.z
    );
  }

  isOutside(min: Point, max: Point) {
    const size = 1 << this.depth;
    return (
      this.pos.x + size <= min.x ||
      this.pos.x >= max.x ||
      this.pos.y + size <= min.y ||
      this.pos.y >= max.y ||
      this.pos.z + size <= min.z ||
      this.pos.z >= max.z
    );
  }

  // if every child node has the same value, delete them
  reduce() {
    if (!('nodes' in this.value)) return;

    let ok = true;

    // reduce all the nodes to values
    // check if the other 7 nodes have the same value as the first one
    for (let i = 0; i < 8; i++) {
      // attempt to reduce this node
      this.value.nodes[i].reduce();

      if (
        !('value' in this.value.nodes[i].value) ||
        this.value.nodes[0].value !== this.value.nodes[i].value
      ) {
        ok = false;
      }
    }

    if (ok) {
      // delete the old nodes
      this.value = this.value.nodes[0].value;
    }
  }

  // insert an area into the tree
  insert(value: T, minBound: Point, maxBound: Point) {
    if (this.isInside(minBound, maxBound)) {
      this.value = { value };
      return;
    }

    if (this.depth === 0) return;

    // populate nodes if it's empty
    if ('value' in this.value) {
      // decrease depth
      const depth = this.depth - 1;
      // the shift is half of the child's size
      const shift = 1 << depth;
      // create new nodes in each 8 child octants of this node
      const { value } = this.value;

      this.value = {
        nodes: [
          new OctNode(this.pos.shifted(0, 0, 0), depth, value),
          new OctNode(this.pos.shifted(shift, 0, 0), depth, value),
          new OctNode(this.pos.shifted(0, shift, 0), depth, value),
          new OctNode(this.pos.shifted(shift, shift, 0), depth, value),
          new OctNode(this.pos.shifted(0, 0, shift), depth, value),
          new OctNode(this.pos.shifted(shift, 0, shift), depth, value),
          new OctNode(this.pos.shifted(0, shift, shift), depth, value),
          new OctNode(this.pos.shifted(shift, shift, shift), depth, value),
        ],
      };
    }

    if ('nodes' in this.value) {
      for (const n of this.value.nodes) {
        if (!n.isOutside(minBound, maxBound))
          n.insert(value, minBound, maxBound);
      }
    }
  }

  // search an area
  search(minBound: Point, maxBound: Point, set: Set<T>) {
    set ??= new Set();
    // if there's no nodes...
    if ('value' in this.value) {
      // add this value, this node would only have come up if it was within bounds
      set.add(this.value.value);
      return;
    }

    if ('nodes' in this.value) {
      // search children
      for (const n of this.value.nodes) {
        // if the bounds are not outside of this node, search
        if (!n.isOutside(minBound, maxBound)) {
          n.search(minBound, maxBound, set);
        }
      }
    }
  }

  // get the value at this point
  get(point: Point): T | null {
    if ('value' in this.value) return this.value.value;
    if ('nodes' in this.value)
      return this.value.nodes[this.pos.getOctant(point, this.depth)].get(point);
    return null;
  }
}

export default class ChunkTree<T> {
  chunks: OctNode<T>[];
  fill: T;

  constructor(fill = null) {
    this.chunks = [];
    // empty nodes have this value
    this.fill = fill;
  }

  // reduce all chunks
  reduce() {
    for (const chunk of this.chunks) {
      chunk.reduce();
    }
  }

  // iterate across chunks with bounds and run the fn with those bounds
  iterChunksFromBounds(
    minBound: Point,
    maxBound: Point,
    fn: (min: Point, max: Point) => void
  ) {
    // if the boundaries are in different chunks, split the area up by chunk
    const minChunk = minBound.getChunk();
    const maxChunk = maxBound.shifted(-1, -1, -1).getChunk();
    if (
      minChunk.x > maxChunk.x ||
      minChunk.y > maxChunk.y ||
      minChunk.z > maxChunk.z
    )
      throw 'max chunk too small';

    if (!minChunk.eq(maxChunk)) {
      /*// insert in all chunks that overlap
      for (let x = minChunk.x; x <= maxChunk.x; ++x) {
        for (let y = minChunk.y; y <= maxChunk.y; ++y) {
          for (let z = minChunk.z; z <= maxChunk.z; ++z) {
            fn(minBound, maxBound);
          }
        }
      }*/
      for (let x = minChunk.x; x <= maxChunk.x; ++x) {
        // determine the min and max bounds for this chunk
        // these should always be within the same chunk
        // and should cap out at the max bound's position
        const minX = x === minChunk.x ? minBound.x : x * CHUNK_SIZE;
        const maxX = Math.min(
          Math.floor(minX / CHUNK_SIZE + 1) * CHUNK_SIZE,
          maxBound.x
        );

        for (let y = minChunk.y; y <= maxChunk.y; ++y) {
          // same thing as above but for y
          const minY = y === minChunk.y ? minBound.y : y * CHUNK_SIZE;
          const maxY = Math.min(
            Math.floor(minY / CHUNK_SIZE + 1) * CHUNK_SIZE,
            maxBound.y
          );

          for (let z = minChunk.z; z <= maxChunk.z; ++z) {
            // same thing as above but for z
            const minZ = z === minChunk.z ? minBound.z : z * CHUNK_SIZE;
            const maxZ = Math.min(
              Math.floor(minZ / CHUNK_SIZE + 1) * CHUNK_SIZE,
              maxBound.z
            );

            // run the fn on the new single-chunk bounds
            fn(new Point(minX, minY, minZ), new Point(maxX, maxY, maxZ));
          }
        }
      }
      return;
    } // otherwise the boundaries are in the same chunk so it's okay to run the function

    fn(minBound, maxBound);
  }

  // get a chunk at a point
  getChunkAt(point: Point, create = false) {
    const chunkPos = point.getChunk();

    // find the the corresponding chunk octtree
    let chunk = this.chunks.find(c => c.chunk.eq(chunkPos));
    if (!chunk && create) {
      // create a new chunk because one does not exist
      chunk = new OctNode(chunkPos.getChunkMidpoint(), 10, this.fill);
      chunk.chunk = chunkPos;
      this.chunks.push(chunk);
    }

    return chunk;
  }

  // search all values in an area
  search(minBound: Point, maxBound: Point) {
    // the set of all result values
    const results = new Set<T>();

    // run the following code in the chunks covered by these boundaries:
    this.iterChunksFromBounds(minBound, maxBound, (min, max) => {
      const chunk = this.getChunkAt(min);
      if (chunk) {
        // search the chunk if it exists
        chunk.search(min, max, results);
      }
    });

    // remove the empty item1
    results.delete(this.fill);

    return results;
  }

  // get the value at a point
  get(point: Point) {
    const chunk = this.getChunkAt(point);
    return chunk ? chunk.get(point) : this.fill;
  }

  // insert an area into chunks
  insert(value: T, minBound: Point, maxBound: Point) {
    // run the following code in the chunks covered by these boundaries:
    this.iterChunksFromBounds(minBound, maxBound, (min, max) => {
      // insert the value into the oct tree
      this.getChunkAt(min, true).insert(value, min, max);
    });
  }
}
