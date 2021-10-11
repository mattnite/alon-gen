exports.cases = [
  {
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
    prefix: 'double_padded',
    definition: {
      kind: 'struct',
      fields: [
        ['x', 'u8'],
        ['y', 'u32'],
      ],
    },
    examples: [
      {x: 0, y: 0},
      {x: 50, y: 1000},
    ],
  },
  {
    prefix: 'single_string',
    definition: {
      kind: 'struct',
      fields: [
        ['x', 'string'],
      ],
    },
    examples: [
      { x: "" },
      { x: "something" },
    ],
  },
  {
    prefix: 'two_strings',
    definition: {
      kind: 'struct',
      fields: [
        ['x', 'string'],
        ['y', 'string'],
      ],
    },
    examples: [
      { x: "", y: "" },
      { x: "foo", y: "bar", }
    ],
  },
  {
    prefix: 'fixed_buffer',
    definition: {
      kind: 'struct',
      fields: [
        ['x', [3]],
      ],
    },
    examples: [
      { x: [0, 0, 0] },
      { x: [1, 2, 3] },
      { x: [255, 255, 255]},
    ],
  },
  {
    prefix: 'string_first',
    definition: {
      kind: 'struct',
      fields: [
        ['x', 'string'],
        ['y', 'u8'],
        ['z', 'u64'],
        ['q', [3]],
      ],
    },
    examples: [
      { x: "", y: 0, z: 0, q: [0, 0, 0]},
      { x: "bruh", y: 127, z: 42069, q: [3, 2, 1]},
    ],
  },
  {
    prefix: 'optional_string',
    definition: {
      kind: 'struct',
      fields: [
        ['x', { kind: 'option', type: 'string' }],
      ],
    },
    examples: [
      { x: null },
      { x: "" },
      { x: "bruh" },
    ],
  },
  {
    prefix: 'optional_u64',
    definition: {
      kind: 'struct',
      fields: [
        ['x', { kind: 'option', type: 'u64' }],
      ],
    },
    examples: [
      { x: null },
      { x: 0 },
      { x: 666 },
    ],
  },
  {
    prefix: 'string_fixed_array',
    definition: {
        kind: 'struct',
        fields: [
          ['x', ['string', 2]]
        ],
    },
    examples: [
      { x: ['', '' ] },
      { x: ['brhu', 'what' ] },
    ],
  },
  {
    prefix: 'u16_fixed_array',
    definition: {
      kind: 'struct',
      fields: [
        ['x', ['u16', 3]]
      ],
    },
    examples: [
      { x: [0, 0, 0] },
      { x: [420, 69, 666] },
    ],
  },
];
