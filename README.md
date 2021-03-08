# Logic

A logic simulator for [omegga](https://github.com/brickadia-community/omegga).

## Install

* `omegga install gh:meshiest/logic`

## Usage

1. Load the `logic gates.brs` file for logic gate prefabs.
2. Read the simulator rules below.
3. Build some gates and wires.
4. Run the simulation

## Simulator rules

### Construction

* Wires must be 2x micro cube (smallest available) pipes (2x2xN) and have plastic material
* Wires can connect to any wire of the same color within 1 microbrick in any direction (even diagonal)
* Black wires (#000000) can connect to any color wire.
* Gates must have smooth tile base plates and have metal material
* Gate indicators must be the same color and material as the baseplate
* For gates where direction matters (and, or, not, xor):
  * Indicators must be directly on top of the gate
  * Indicators must be in the top right corner of output direction
  * Gate output detects all wires touching the gate in the output direction
  * Gate inputs detects all wires touching the gate in other directions
  * Gates can be inverted with a 2x micro cube indicator
* For gates with connectables (mux, mem, add, sr, d, jk):
  * Gate indicator is a micro corner wedge + another indicator
  * Connectables must be on top of the gate
  * Wires connect to connectables adjacently
  * Connectables are ordered based on inverse distance to the corner indicator (furthest is first, closest is last)
  * Flipping connectables upside down inverts them
* All i/o to gates is adjacent (wires cannot communicate with gates diagonally)
* Wires cannot connect to the top and bottom of gates

### Simulation

* All gates are evaluated at the same time (cycle based simulator)
* Default power state is off, so if a gate is not powering a wire it will be off.
* Gates with clocks clock on the rising edge (off->on)

## Gates

### Simple Gates

|gate|indicators|description|
|-|-|-|
|`and`|1 micro wedge|output is on when all input wires are on|
|`or`|1 micro wedge outer corner|output is on when any input wires are on|
|`xor`|1 micro wedge inner corner|output is on when one input wire is on|
|`buffer`|1 micro wedge triangle corner|same as `or` for now|

### Inputs (Triggered by !press)

|gate|indicators|description|
|-|-|-|
|`button`|2x2f octo converter|when interacted, powers for 3 ticks|
|`lever`|1x2f plate center|when interacted, toggles power|

### Special Gates

#### Connectables
|name|indicators|description|
|-|-|-|
|`input`|wedge|an input|
|`output`|ramp crest end|an output|
|`secondary`|ramp crest|a secondary input/output|
|`reset`|1x1f round|a reset input|
|`clock`|1x1f octo|a clock input (rising edge)|
|`clr`|small flower|a clr input (rising edge)|
|`write`|tile|a write input|

|gate|connectables|description|
|-|-|-|
|`srlatch`|`input`, `reset`, `output`|standard SR latch|
|`dflipflop`|`input`, `clock`, `output`|standard D flip flop|
|`jkflipflop`|`input`, `clock`, `reset`, `output` (optional `clr`)|standard JK flip flop (`input`=J, `reset`=K)|
|`add`|`input`, `output`|an adder, counts the number of on inputs and outputs encoded value|
|`mux`|`input`, `secondary`, `output`|a multiplexer. requires ((1<<#`secondary`)*#`output`) inputs, `secondary` is the address, output is the value of the addressed `input`|
|`mem`|`input`, `secondary`, (`write` OR `clock`), `output`, (optional `clr`)|a memory cell. stores (1<<#`secondary`) #`input`-bit values, `secondary` is the address. writes only when `write` is on or `clock` is clocked, outputs the currently addressed cell. There must be an equal number of inputs and outputs. `clr` clears all data.|


## Commands

* `/go` - compile the simulation
  * `/go c` - compile the simulation for only bricks in clipboard
  * `/go r` - automatically run the next 10000 frames
  * `/go rc` - clipboard + auto run next 10k
  * `/go w` - run without rendering wires (outputs only)
* `/next` - render the next frame of the simulation
  * `/next 500 100` - render the next 500 frames of the simulation at 10fps (100ms per frame)
  * `/next 500 100 5` - render the next 500 frames of the simulation at 50fps (100ms per 5 frames)
* `/clg` - clear wire signal bricks
* `!press` - press buttons/levers
