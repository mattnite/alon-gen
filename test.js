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

var headerFull = '#pragma once\n\n#include <stdint.h>\n';
var sourceFull = '#include "alon.h"\n';
cases.forEach(schema => {
  const { header, source } = generate(schema.prefix, schema.definition);
  headerFull = headerFull.concat(header, '\n');
  sourceFull = sourceFull.concat(source, '\n');
});

fs.writeFileSync(`output/alon.h`, headerFull);
fs.writeFileSync(`output/alon.c`, sourceFull);

let test_data = {};
cases.forEach(schema => test_data[schema.prefix] = {
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
});

fs.writeFileSync('output/test_data.json', JSON.stringify(test_data));
