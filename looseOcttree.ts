import { Point, CHUNK_DEPTH, CHUNK_SIZE } from './octtree';

// when depth is 0, this is the same as having a normal octree
const LOOSE_DEPTH = 1;
const MAX_LOOSE_CHILDREN = 10;

type LooseOctNodeValue<T> =
  // | { unchanged: true } // unused, for diffing
  { children: Set<T> | null } | { nodes: LooseOctNode<T>[] };

type LookupFn<T> = (i: T) => { min: Point; max: Point };

// a node in the tree
export class LooseOctNode<T> {
  pos: Point;
  depth: number;
  value: LooseOctNodeValue<T>;
  chunk?: Point;
  lookup: LookupFn<T>;

  constructor(pos: Point, depth: number, value: T | null, lookup: LookupFn<T>) {
    this.pos = pos;
    this.depth = depth;
    this.lookup = lookup;

    const children = new Set<T>();
    if (value !== null) children.add(value);

    this.value = { children };
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
  __reduce() {
    if (!('nodes' in this.value)) return;

    // reduce all the nodes to values
    // check if the other 7 nodes have the same value as the first one
    for (let i = 0; i < 8; i++) {
      // attempt to reduce this node
      this.value.nodes[i].__reduce();

      if (!('value' in this.value.nodes[i].value)) {
        return;
      }

      // TODO: reimplement
      if (this.value.nodes[0].value !== this.value.nodes[i].value) {
        return;
      }
    }

    // delete the old nodes
    this.value = this.value.nodes[0].value;
  }

  // insert an area into the tree
  insert(value: T, minBound: Point, maxBound: Point) {
    // add it to this node's children if
    if (
      // sufficiently deep
      this.depth <= LOOSE_DEPTH ||
      // or inside this node AND there a fewer than 4 children
      ('children' in this.value &&
        this.value.children.size < MAX_LOOSE_CHILDREN &&
        this.isInside(minBound, maxBound))
    ) {
      if (!('children' in this.value)) this.value = { children: new Set<T>() };
      this.value.children.add(value);
      return;
    }

    // populate nodes if it's empty
    if ('children' in this.value) {
      // decrease depth
      const d = this.depth - 1;
      // the shift is half of the child's size
      const shift = 1 << d;

      // create new nodes in each 8 child octants of this node
      const lookup = this.lookup;

      const { children } = this.value;

      // create new descendant nodes
      this.value = {
        nodes: [
          new LooseOctNode(this.pos.shifted(0, 0, 0), d, null, lookup),
          new LooseOctNode(this.pos.shifted(shift, 0, 0), d, null, lookup),
          new LooseOctNode(this.pos.shifted(0, shift, 0), d, null, lookup),
          new LooseOctNode(this.pos.shifted(shift, shift, 0), d, null, lookup),
          new LooseOctNode(this.pos.shifted(0, 0, shift), d, null, lookup),
          new LooseOctNode(this.pos.shifted(shift, 0, shift), d, null, lookup),
          new LooseOctNode(this.pos.shifted(0, shift, shift), d, null, lookup),
          new LooseOctNode(
            this.pos.shifted(shift, shift, shift),
            d,
            null,
            lookup
          ),
        ],
      };

      // re-add the children to the nodes only if they're not fully outside
      for (const i of children) {
        const { min, max } = this.lookup(i);

        for (const n of this.value.nodes) {
          if (!n.isOutside(min, max)) n.insert(value, min, max);
        }
      }
    }

    // add the value to the descendant nodes
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
    if ('children' in this.value) {
      // add this value, this node would only have come up if it was within bounds
      for (const i of this.value.children) {
        const { min, max } = this.lookup(i);

        // this volume is not outside the given range
        if (
          !(
            max.x <= minBound.x ||
            min.x >= maxBound.x ||
            max.y <= minBound.y ||
            min.y >= maxBound.y ||
            max.z <= minBound.z ||
            min.z >= maxBound.z
          )
        )
          set.add(i);
      }
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
    if ('children' in this.value) {
      for (const i of this.value.children) {
        const { min, max } = this.lookup(i);
        if (point.in(min, max)) return i;
      }
    }
    if ('nodes' in this.value)
      return this.value.nodes[this.pos.getOctant(point, this.depth)].get(point);
    return null;
  }
}

export default class LooseChunkTree<T> {
  chunks: LooseOctNode<T>[];
  fill: T;
  lookup: LookupFn<T>;

  constructor(fill = null, lookup: LookupFn<T>) {
    this.lookup = lookup;

    this.chunks = [];
    // empty nodes have this value
    this.fill = fill;
  }

  // reduce all chunks
  __reduce() {
    for (const chunk of this.chunks) {
      chunk.__reduce();
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
      chunk = new LooseOctNode(
        chunkPos.getChunkMidpoint(),
        CHUNK_DEPTH,
        null,
        this.lookup
      );
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
