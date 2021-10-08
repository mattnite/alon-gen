
// JS test types

class SingleFixed {
  constructor(val) {
    this.x = val.x;
  }
}

class DoubleFixed {
  constructor(val) {
    this.x = val.x;
    this.y = val.y;
  }
}

exports.cases = [
  {
    Type: SingleFixed,
    prefix: 'single_fixed',
    definition: {
      kind: 'struct',
      fields: [
        ['x', 'u8']
      ],
    },
    examples: [
      { x: 0 },
      { x: 10 },
      { x: 255 },
    ],
  },
  {
    Type: DoubleFixed,
    prefix: 'double_packed',
    definition: {
      kind: 'struct',
      fields: [
        ['x', 'u32'],
        ['y', 'u16'],
      ],
    },
    examples: [
      {x: 0, y: 0},
      {x: 50, y: 1000},
    ],
  },
  {
    Type: DoubleFixed,
    prefix: 'double_padded',
    definition: {
      kind: 'struct',
      fields: [
        ['x', 'u8'],
        ['y', 'u32'],
      ],
    },
    examples: [
    ],
  },
];

//  const schema_obj = {
//    kind: 'struct',
//    fields: [
//      ['x', 'u8'],
//      ['y', 'u64'],
//      ['z', 'string'],
//      ['q', [3]],
//    ],
//  };
//
//  const value = new Test({ x: 255, y: 20, z: '123', q: [1, 2, 3] });
//  const schema = new Map([
//    [Test, schema_obj]
//  ]);
//
//  console.log(generate(schema));
