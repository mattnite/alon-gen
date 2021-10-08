const fixed_size_types = {
  u8: true,
  u16: true,
  u32: true,
  u64: true,
  f32: true,
  f64: true,
  string: false,
  optional: false,
  struct: false,
};

const sizes = {
  u8: 1,
  u16: 2,
  u32: 4,
  u64: 8,
  f32: 4,
  f64: 8,
};

const c_types = {
  u8: 'uint8_t',
  u16: 'uint16_t',
  u32: 'uint32_t',
  u64: 'uint64_t',
  f32: 'float',
  f64: 'double',
};

function generate(name, schema) {
  return {
    header: genHeader(name, schema),
    source: genSource(name, schema),
  };
}

function genHeader(name, schema) {
  return structDefn(name, schema) + '\n\n' + funcProto(name) + ';\n';
}

function genSource(name, schema) {
  let ret = `${funcProto(name)} {\n`;
  let offset = 0;
  schema.fields.forEach(([fieldName, fieldType]) => {
    const c_type = c_types[fieldType];
    const size = sizes[fieldType];
    if (offset % size != 0)
      offset += (size - (offset % size));
    ret = ret.concat(`  out->${fieldName} = (${c_type}*)(input + ${offset});\n`);
    offset += sizes[fieldType];
  });
  ret = ret.concat('  return 0;\n};\n');

  return ret;
}

function funcProto(name) {
  return `int alon_${name}_deserialize(uint8_t *input, struct alon_${name}* out)`;
}

function structDefn(name, schema) {
  let ret = `struct alon_${name} {\n`;
  schema.fields.forEach(([fieldName, fieldType]) =>
    ret = ret.concat(`    ${c_types[fieldType]}* ${fieldName};\n`));

  return ret.concat('};\n');
}


class Test {
  constructor (val) {
    this.x = val.x;
    this.y = val.y;
    this.z = val.z;
    this.q = val.q;
  }
};

function deserializeField(schema, fieldName, fieldType, reader) {
    try {
        if (typeof fieldType === 'string') {
            return reader[`read${capitalizeFirstLetter(fieldType)}`]();
        }
        if (fieldType instanceof Array) {
            if (typeof fieldType[0] === 'number') {
                return reader.readFixedArray(fieldType[0]);
            }
            else if (typeof fieldType[1] === 'number') {
                const arr = [];
                for (let i = 0; i < fieldType[1]; i++) {
                    arr.push(deserializeField(schema, null, fieldType[0], reader));
                }
                return arr;
            }
            else {
                return reader.readArray(() => deserializeField(schema, fieldName, fieldType[0], reader));
            }
        }
        if (fieldType.kind === 'option') {
            const option = reader.readU8();
            if (option) {
                return deserializeField(schema, fieldName, fieldType.type, reader);
            }
            return undefined;
        }
        return deserializeStruct(schema, fieldType, reader);
    }
    catch (error) {
        if (error instanceof BorshError) {
            error.addToFieldPath(fieldName);
        }
        throw error;
    }
}

function deserializeStruct(schema, classType, reader) {
    if (typeof classType.borshDeserialize === 'function') {
        return classType.borshDeserialize(reader);
    }
    const structSchema = schema.get(classType);
    if (!structSchema) {
        throw new BorshError(`Class ${classType.name} is missing in schema`);
    }
    if (structSchema.kind === 'struct') {
        const result = {};
        for (const [fieldName, fieldType] of schema.get(classType).fields) {
            result[fieldName] = deserializeField(schema, fieldName, fieldType, reader);
        }
        return new classType(result);
    }
    if (structSchema.kind === 'enum') {
        const idx = reader.readU8();
        if (idx >= structSchema.values.length) {
            throw new BorshError(`Enum index: ${idx} is out of range`);
        }
        const [fieldName, fieldType] = structSchema.values[idx];
        const fieldValue = deserializeField(schema, fieldName, fieldType, reader);
        return new classType({ [fieldName]: fieldValue });
    }
    throw new BorshError(`Unexpected schema kind: ${structSchema.kind} for ${classType.constructor.name}`);
}

/// Deserializes object from bytes using schema.
function deserialize(schema, classType, buffer, Reader = BinaryReader) {
    const reader = new Reader(buffer);
    const result = deserializeStruct(schema, classType, reader);
    if (reader.offset < buffer.length) {
        throw new BorshError(`Unexpected ${buffer.length - reader.offset} bytes after deserialized data`);
    }
    return result;
}

exports.generate = generate;
