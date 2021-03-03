const CHUNK_SIZE = 1024;
const RIGHT = 1;
const BACK = 2;
const BOTTOM = 4;

// a point in space
class Point {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  // get a chunk from a point
  getChunk() {
    return new Point(
      Math.floor(this.x/CHUNK_SIZE),
      Math.floor(this.y/CHUNK_SIZE),
      Math.floor(this.z/CHUNK_SIZE)
    );
  }

  // returns true if this point is between the other two
  in(min, max) {
    return min.x <= this.x && this.x <= max.x &&
      min.y <= this.y && this.y <= max.y &&
      min.z <= this.z && this.z <= max.z;
  }

  // get the octant the point should be in for a node
  getOctant(point) {
    return (point.x >= this.x ? RIGHT : 0) | (point.y >= this.y ? BACK : 0) | (point.z >= this.z ? BOTTOM : 0);
  }

  // get the middle of a chunk
  getChunkMidpoint() {
    return new Point(
      this.x*CHUNK_SIZE + CHUNK_SIZE/2,
      this.y*CHUNK_SIZE + CHUNK_SIZE/2,
      this.z*CHUNK_SIZE + CHUNK_SIZE/2,
    );
  }

  // compare points
  eq(point) {
    return this.x == point.x && this.y == point.y && this.z == point.z;
  }

  // return a copy of this point shifted
  shifted(x, y, z) {
    return new Point(this.x + x, this.y + y, this.z + z);
  }

  // stringified points are <x, y, z>
  toString() {
    return `<${this.x}, ${this.y}, ${this.z}>`;
  }
}

// a node in the tree
class Node {
  constructor(point, depth, value) {
    this.point = point;
    this.depth = depth;
    this.value = value;
    this.nodes = [];
  }

  wouldFillNode(min, max) {
    const size = (1<<this.depth);
    return (max.x - min.x) == size && (max.y - min.y) == size && (max.z - min.z) == size;
  }

  // if every child node has the same value, delete them
  reduce() {
    if (this.nodes.length === 0) return;

    let ok = true;

    // reduce all the nodes to values
    // check if the other 7 nodes have the same value as the first one
    for (let i = 0; i < 8; i++) {
      // attempt to reduce this node
      this.nodes[i].reduce();
      if (this.nodes[0].value !== this.nodes[i].value ||
        this.nodes[i].nodes.length > 0) {
        ok = false;
      }
    }

    if (ok) {
      // delete the old nodes
      this.value = this.nodes[0].value;
      this.nodes = [];
    }
  }

  // insert an area into the tree
  insert(value, minBound, maxBound) {
    if (this.wouldFillNode(minBound, maxBound)) {
      this.value = value;
      return;
    } else if (this.depth === 0) {
      throw `0 depth nodes should fit in bounds (${minBound} .. ${maxBound} > ${1<<this.depth})`;
    }

    const halfSize = 1 << this.depth;

    if (maxBound.x - halfSize > this.point.x ||
        minBound.x + halfSize < this.point.x ||
        maxBound.y - halfSize > this.point.y ||
        minBound.y + halfSize < this.point.y ||
        maxBound.z - halfSize > this.point.z ||
        minBound.z + halfSize < this.point.z)
      throw 'bounds too large for node';

    // if the bounding box overlaps the midpoint, break it into chunks
    // if (minBound.x < this.point.x && this.point.x < maxBound.x) {
    if (maxBound.x - minBound.x > halfSize || minBound.x < this.point.x && this.point.x < maxBound.x) {
      this.insert(value, new Point(this.point.x, minBound.y, minBound.z), maxBound);
      this.insert(value, minBound, new Point(this.point.x, maxBound.y, maxBound.z));
      return;
    }
    // if (minBound.y < this.point.y && this.point.y < maxBound.y) {
    if (maxBound.y - minBound.y > halfSize || minBound.y < this.point.y && this.point.y < maxBound.y) {
      this.insert(value, new Point(minBound.x, this.point.y, minBound.z), maxBound);
      this.insert(value, minBound, new Point(maxBound.x, this.point.y, maxBound.z));
      return;
    }
    // if (minBound.z < this.point.z && this.point.z < maxBound.z) {
    if (maxBound.z - minBound.z > halfSize || minBound.z < this.point.z && this.point.z < maxBound.z) {
      this.insert(value, new Point(minBound.x, minBound.y, this.point.z), maxBound);
      this.insert(value, minBound, new Point(maxBound.x, maxBound.y, this.point.z));
      return;
    }

    // populate nodes if it's empty
    if (this.nodes.length === 0) {
      // decrease depth
      const childDepth = this.depth - 1;
      // the shift is half of the child's size
      const childShift = Math.pow(2, childDepth - 1);
      // create new nodes in each 8 child octants of this node
      this.nodes = [
        new Node(this.point.shifted(-childShift, -childShift, -childShift), childDepth, this.value),
        new Node(this.point.shifted( childShift, -childShift, -childShift), childDepth, this.value),
        new Node(this.point.shifted(-childShift,  childShift, -childShift), childDepth, this.value),
        new Node(this.point.shifted( childShift,  childShift, -childShift), childDepth, this.value),
        new Node(this.point.shifted(-childShift, -childShift,  childShift), childDepth, this.value),
        new Node(this.point.shifted( childShift, -childShift,  childShift), childDepth, this.value),
        new Node(this.point.shifted(-childShift,  childShift,  childShift), childDepth, this.value),
        new Node(this.point.shifted( childShift,  childShift,  childShift), childDepth, this.value),
      ];
    }


    // find the octant this node belongs to and insert it
    const octant = this.point.getOctant(minBound);
    this.nodes[octant].insert(value, minBound, maxBound);
  }

  // search an area
  search(minBound, maxBound, set) {
    if (!set) set = new Set();
    // if there's no nodes...
    if (this.nodes.length === 0) {
      // add this value, this node would only have come up if it was within bounds
      set.add(this.value);
      return;
    }

    // search children
    const halfSize = Math.pow(2, this.depth - 2);
    for (const n of this.nodes) {
      // if the bounds are outside of this node, don't search
      if (n.point.x + halfSize < minBound.x ||
          n.point.x - halfSize > maxBound.x ||
          n.point.y + halfSize < minBound.y ||
          n.point.y - halfSize > maxBound.y ||
          n.point.z + halfSize < minBound.z ||
          n.point.z - halfSize > maxBound.z) {
        continue;
      }

      // search the octant
      n.search(minBound, maxBound, set);
    }
  }
}

module.exports = class ChunkTree {
  static Point = Point;
  static Node = Node;

  constructor(fill=undefined) {
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
  iterChunksFromBounds(minBound, maxBound, fn) {
    // if the boundaries are in different chunks, split the area up by chunk
    const minChunk = minBound.getChunk();
    const maxChunk = maxBound.shifted(-1, -1, -1).getChunk();
    if (minChunk.x > maxChunk.x || minChunk.y > maxChunk.y || minChunk.z > maxChunk.z)
      throw 'max chunk too small';

    if (!minChunk.eq(maxChunk)) {
      for (let x = minChunk.x; x <= maxChunk.x; ++x) {
        // determine the min and max bounds for this chunk
        // these should always be within the same chunk
        // and should cap out at the max bound's position
        const minX = x === minChunk.x ? minBound.x : x * CHUNK_SIZE;
        const maxX = Math.min(Math.floor(minX/CHUNK_SIZE+1)*CHUNK_SIZE, maxBound.x);

        for (let y = minChunk.y; y <= maxChunk.y; ++y) {
          // same thing as above but for y
          const minY = y === minChunk.y ? minBound.y : y * CHUNK_SIZE;
          const maxY = Math.min(Math.floor(minY/CHUNK_SIZE+1)*CHUNK_SIZE, maxBound.y);

          for (let z = minChunk.z; z <= maxChunk.z; ++z) {
            // same thing as above but for z
            const minZ = z === minChunk.z ? minBound.z : z * CHUNK_SIZE;
            const maxZ = Math.min(Math.floor(minZ/CHUNK_SIZE+1)*CHUNK_SIZE, maxBound.z);

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
  getChunkAt(point, create=false) {
    const chunkPos = point.getChunk();

    // find the the corresponding chunk octtree
    let chunk = this.chunks.find(c => c.chunk.eq(chunkPos));
    if (!chunk && create) {
      // create a new chunk because one does not exist
      chunk = new Node(chunkPos.getChunkMidpoint(), 10, this.fill);
      chunk.chunk = chunkPos;
      this.chunks.push(chunk);
    }

    return chunk;
  }

  // search all values in an area
  search(minBound, maxBound) {
    // the set of all result values
    const results = new Set();

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

  // insert an area into chunks
  insert(value, minBound, maxBound) {
    // run the following code in the chunks covered by these boundaries:
    this.iterChunksFromBounds(minBound, maxBound, (min, max) => {
      // insert the value into the oct tree
      this.getChunkAt(min, true).insert(value, min, max);
    });
  }
};