# Logic

A logic simulator for [omegga](https://github.com/brickadia-community/omegga).

## Install

- `omegga install gh:meshiest/logic`

## Usage

1. Load the `logic bricks v2.brs` file for logic gate prefabs.
2. Read the simulator rules below.
3. Build some gates and wires.
4. Run the simulation

## Simulator rules

### Construction

- Wires must be 2x micro cube (smallest available) pipes (2x2xN) and have plastic material
- Wires can connect to any wire of the same color within 1 microbrick in any direction (even diagonal)
- Black wires (#000000) can connect to any color wire.
- Gates can be made of any color, material, or brick type.
  - Add `logic:gate:GATE` to the console tag on a brick's interact component. (eg. `logic:gate:AND`)
- Gate connectables
  - Add `logic:io:NAME` to the console tag on a brick's interact component (eg. `logic:io:input`)
  - Connectables must be on top of the gate (Z Positive). This is hard to tell with microbricks.
  - Wires connect to connectables adjacently
  - Connectables are ordered by content after the `NAME[:<rest>]`. `logic:io:input:00`, `logic:io:input:01`. This is a **string compare** so `10` will come before `1` but not `01`.
  - Adding an `!` to the beginning of the interact tag (`!logic:gate:and`, `!logic:io:input`) **inverts** the input (on non-simple gates) or all output on the gate.
- All i/o to gates is adjacent (wires cannot communicate with gates diagonally)
- Wires cannot connect to the top and bottom of gates

### Simulation

- All gates are evaluated in order with input gates and `buffer`s first.
- Default power state is off, so if a gate is not powering a wire it will be off.
- Gates with clocks clock on the rising edge (off->on)
- Cycles must be broken with the `buffer` gate.

## Gates

### Simple Gates

| gate     | indicators        | description                              |
| -------- | ----------------- | ---------------------------------------- |
| `and`    | `input`, `output` | output is on when all input wires are on |
| `or`     | `input`, `output` | output is on when any input wires are on |
| `xor`    | `input`, `output` | output is on when one input wire is on   |
| `buffer` | `input`, `output` | delays input by 1 tick                   |

### Inputs (Triggered by clicking on the gate)

| gate     | description                        |
| -------- | ---------------------------------- |
| `button` | when interacted, powers for 1 tick |
| `lever`  | when interacted, toggles power     |

### Outputs (Render bricks)

| gate       | connectables                | description                                                                                                                                                                      |
| ---------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pixel`    | `output`                    | Renders a glowing brick above the tile when powered                                                                                                                              |
| `rgbpixel` | `color`, (optional `write`) | Renders above the baseplate with a brick 1stud bigger in each direction. Color based on bit input of the `color`. Always ON if no `write`, on if tile is powered or inverted+off |

| gate          | connectables                                                         | description                                                                                                                                                                                                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sr_latch`    | `input`, `reset`, `output`                                           | standard SR latch                                                                                                                                                                                                                                                                                                                              |
| `d_flipflop`  | `input`, `clock` OR `write`, `output`                                | standard D flip flop                                                                                                                                                                                                                                                                                                                           |
| `jk_flipflop` | `input`, `clock`, `reset`, `output` (optional `clear`)               | standard JK flip flop (`input`=J, `reset`=K)                                                                                                                                                                                                                                                                                                   |
| `adder`       | `input`, `output`                                                    | an adder, counts the number of on inputs and outputs encoded value                                                                                                                                                                                                                                                                             |
| `mux`         | `input`, `address`, `output`                                         | a multiplexer. requires #`output` to be divisible by #`input`s, `address` is the address, output is the value of the addressed `input`                                                                                                                                                                                                         |
| `decoder`     | `input`, `disable`, `output`                                         | a decoder. requires #`output` to be 2^(#`input`-1), `disable` turns off output `input`                                                                                                                                                                                                                                                         |
| `mem`         | `input`, `address`, (`write` OR `clock`), `output`, (optional `clr`) | a memory cell. stores (1<<#`address`) #`input`-bit values, `address` is the address. writes only when `write` is on or `clock` is clocked, outputs the currently addressed cell. There must be an equal number of inputs and outputs. `clr` clears all data. Adding `:fast` at the end of `io:write` will make the memory read before writing. |
| `rom`         | `address`, `config`, `output`, `data`                                | ROM. requires #`output` to be divisible by the data sent to config (`logic:io:config:8`, 8 being the word size. ) `address` is the address, can output multiple words in series                                                                                                                                                                |

## Commands

- `/go` - compile the simulation
  - `/go c` - compile the simulation for only bricks in clipboard
  - `/go r` - automatically run the next 10000 frames
  - `/go rc` - clipboard + auto run next 10k
  - `/go w` - run without rendering wires (outputs only)
- `/next` - render the next frame of the simulation
  - `/next 500 100` - render the next 500 frames of the simulation at 10fps (100ms per frame)
  - `/next 500 100 5` - render the next 500 frames of the simulation at 50fps (100ms per 5 frames)
- `/clg` - clear wire signal bricks
- `!press` - press buttons/levers
