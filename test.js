const borsh = require('borsh');
const fs = require('fs');
const { cases } = require('./tests/schemas');
const { generate } = require('./index');

try {
  fs.mkdirSync('output');
} catch (e) {
  if (e.code != 'EEXIST')
    throw e;
}

cases.forEach(schema => {
  const { header, source } = generate(schema.prefix, schema.definition);
  const headerFull = `#pragma once\n\n#include <stdint.h>\n\n${header}`;
  const sourceFull = `#include "${schema.prefix}.h"\n\n${source}`
  fs.writeFileSync(`output/${schema.prefix}.h`, headerFull);
  fs.writeFileSync(`output/${schema.prefix}.c`, sourceFull);
});

const test_data = cases.map(schema => ({
  prefix: schema.prefix,
  definition: schema.definition,
  examples: schema.examples.map(example => {
    const value = new schema.Type(example);
    const borsh_schema = new Map([[schema.Type, schema.definition]]);
    const buffer = borsh.serialize(borsh_schema, value);
    return {
      input: example,
      output: [...buffer],
    };
  }),
}));

fs.writeFileSync('output/test_data.json', JSON.stringify(test_data));
