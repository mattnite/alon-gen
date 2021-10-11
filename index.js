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
  string: 'char*',
};

function generate(name, schema) {
  return {
    header: genHeader(name, schema),
    source: genSource(name, schema),
  };
}

function genHeader(name, schema) {
  return '\n' + structDefn(name, schema) + '\n' + funcProto(name) + ';';
}

function genSource(name, schema) {
  let ret = `\n${funcProto(name)} {\n`;
  let state = {
    offset: 0,
    isDynamic: false,
    text: "",
    scope: [],
  };

  state = genStruct(state, name, schema);
  if (!state.isDynamic && state.offset > 0) {
    ret = ret.concat(
      `    if (len < ${state.offset}) {\n`,
      `        return -ENOBUFS;\n`,
      `    }\n\n`);
  }

  return ret.concat(state.text, '    return 0;\n}\n');
}

function genStruct(state, name, schema) {
  if (state.scope.length == 0)
    state.scope.push("out");
  else
    state.scope.push(name);

  switch (schema.kind) {
    case 'struct':
      for (const [fieldName, fieldType] of schema.fields) {
        state = genField(state, fieldName, fieldType);
      }
      break;
    case 'enum':
      throw 'TODO: enums';
      break;
    default:
      throw `unknown kind: ${schema.kind}`;
  }

  state.scope.pop();
  return state;
}

function genField(state, name, schema) {
 if (typeof schema === 'string')
   return genBasicType(state, name, schema);
 else if (schema instanceof Array)
   return genFixedArray(state, name, schema);
 else if (schema.kind === 'option')
   return genOption(state, name, schema);
 else
   return genStruct(state, name, schema);
}

function deref(scope, name) {
  if (scope.length == 1)
    return `out->${name}`;
  else
    return `out->${scope.slice(1).join('.')}.${name}`;
}

// schema is assumed to be a string
function genBasicType(state, name, schema) {
  if (schema === 'string') {
    if (!state.isDynamic) {
      // u32 precedes string contents
      state.text = state.text.concat(
        `    uint64_t offset = ${state.offset};\n`);
      state.isDynamic = true;
    }

    const member = deref(state.scope, name);
    state.text = state.text.concat(
      `    {\n`,
      `        if (len < offset + sizeof(uint32_t))\n`,
      `            return -ENOBUFS;\n`,
      `\n`,
      `        uint32_t str_len;\n`,
      `        memcpy(&str_len, buf + offset, sizeof(uint32_t));\n`,
      `        offset += sizeof(uint32_t);\n`,
      `        if (len < offset + str_len)\n`,
      `            return -ENOBUFS;\n`,
      `\n`,
      `        ${member} = calloc(1, str_len + 1);\n`,
      `        if (NULL == ${member})\n`,
      `            return -ENOMEM;\n`,
      `\n`,
      `        memcpy(${member}, buf + offset, str_len);\n`,
      `        ${member}[str_len] = 0;\n`,
      `        offset += str_len;\n`,
      `    }\n`,
      `\n`,
    );
  } else if (state.isDynamic) {
    const member = deref(state.scope, name);
    state.text = state.text.concat(
      `    if (len < offset + sizeof(${c_types[schema]}))\n`,
      `        return -ENOBUFS;\n`,
      `\n`,
      `    memcpy(&${member}, buf + offset, sizeof(${c_types[schema]}));\n`,
      `    offset += sizeof(${c_types[schema]});\n`);
  } else {
    state.text = state.text.concat(
      `    memcpy(&${deref(state.scope, name)}, buf + ${state.offset}, sizeof(${c_types[schema]}));\n`);
    state.offset += sizes[schema];
  }

  return state;
}

function genFixedArray(state, name, schema) {
  if (schema.length > 1 && schema[0] === 'string') {
    // todo: type checking
    if (!state.isDynamic) {
      // u32 precedes string contents
      state.text = state.text.concat(
        `    uint64_t offset = ${state.offset};\n`);
      state.isDynamic = true;
    }

    const member = deref(state.scope, name);
    state.text = state.text.concat(
      `    for (uint64_t i = 0; i < ${schema[1]}; i++) {\n`,
      `        if (len < offset + sizeof(uint32_t))\n`,
      `            return -ENOBUFS;\n`,
      `\n`,
      `        uint32_t str_len;\n`,
      `        memcpy(&str_len, buf + offset, sizeof(uint32_t));\n`,
      `        offset += sizeof(uint32_t);\n`,
      `        if (len < offset + str_len)\n`,
      `            return -ENOBUFS;\n`,
      `\n`,
      `        ${member}[i] = calloc(1, str_len + 1);\n`,
      `        if (NULL == ${member}[i])\n`,
      `            return -ENOMEM;\n`,
      `\n`,
      `        memcpy(${member}[i], buf + offset, str_len);\n`,
      `        ${member}[i][str_len] = 0;\n`,
      `        offset += str_len;\n`,
      `    }\n`,
      `\n`);
  } else {
    // special case byte array
    if (state.isDynamic) {
      const member = `${deref(state.scope, name)}`;
      state.text = state.text.concat(
        `    if (len < offset + sizeof(${member}))\n`,
        `        return -ENOBUFS;\n`,
        `\n`,
        `    memcpy(&${member}, buf + offset, sizeof(${member}));\n`,
        `    offset += sizeof(${member});\n`);
    } else {
      const member = `${deref(state.scope, name)}`;
      state.text = state.text.concat(
        `    memcpy(${member}, buf + ${state.offset}, sizeof(${member}));\n`);
      state.offset += schema[0];
    }
  }

  return state;
}

function genOption(state, name, schema) {
  if (!state.isDynamic) {
    state.text = state.text.concat(
      `    uint64_t offset = ${state.offset};\n`);
    state.isDynamic = true;
  }

  state.text = state.text.concat(
    `    {\n`,
    `        uint8_t is_set;\n`,
    `        if (len < offset + sizeof(uint8_t))\n`,
    `            return -ENOBUFS;\n`,
    `\n`,
    `        memcpy(&is_set, buf + offset, sizeof(uint8_t));\n`,
    `        offset += sizeof(uint8_t);\n`,
    `        if (is_set != 0) {\n`);

  const member = deref(state.scope, name);
  if (schema.type === 'string') {
    state.text = state.text.concat(
      `            if (len < offset + sizeof(uint32_t))\n`,
      `                return -ENOBUFS;\n`,
      `\n`,
      `            uint32_t str_len;\n`,
      `            memcpy(&str_len, buf + offset, sizeof(uint32_t));\n`,
      `            offset += sizeof(uint32_t);\n`,
      `            if (len < offset + str_len)\n`,
      `                return -ENOBUFS;\n`,
      `\n`,
      `            ${member} = calloc(1, str_len + 1);\n`,
      `            if (NULL == ${member})\n`,
      `                return -ENOMEM;\n`,
      `\n`,
      `            memcpy(${member}, buf + offset, str_len);\n`,
      `            ${member}[str_len] = 0;\n`,
      `            offset += str_len;\n`,
      `    } else {\n`,
      `        ${member} = NULL;\n`);
  } else {
    state.text = state.text.concat(
      `            if (len < offset + sizeof(${c_types[schema.type]}))\n`,
      `                return -ENOBUFS;\n`,
      `\n`,    
      `            memcpy(&${member}.val, buf + offset, sizeof(${c_types[schema.type]}));\n`,
      `            ${member}.is_set = 1;\n`,
      `            offset += sizeof(${c_types[schema.type]});\n`,
      `        } else {\n`,
      `            ${member}.is_set = 0;\n`);
  }

  state.text = state.text.concat(
    `        }\n`,
    `    }\n`);

  return state;
}

function funcProto(name) {
  return `int ${name}_deserialize(const uint8_t *buf, uint64_t len, struct ${name}* out)`;
}

function structDefn(name, schema) {
  let ret = `struct ${name} {\n`;
  schema.fields.forEach(([fieldName, fieldType]) => {
    if (fieldType instanceof Array) {
      if (fieldType.length > 1) {
        ret = ret.concat(`    ${c_types[fieldType[0]]} ${fieldName}[${fieldType[1]}];\n`);
      } else {
        ret = ret.concat(`    uint8_t ${fieldName}[${fieldType[0]}];\n`);
      }
    } else if (fieldType instanceof Object) {
      switch (fieldType.kind) {
        case 'option':
          if (fieldType.type == 'string') {
            ret = ret.concat(`    char* ${fieldName};\n`);
          } else {
            ret = ret.concat(
              `    struct {\n`,
              `        uint8_t is_set;\n`,
              `        ${c_types[fieldType.type]} val;\n`,
              `    } ${fieldName};\n`);
          }
          break;
        case 'struct':
          throw 'Nested structs not supported';
        case 'enum':
          throw 'Nested enums not supported';
        default:
          throw `unknown kind: ${fieldType.kind}`;
      }
    } else {
      ret = ret.concat(`    ${c_types[fieldType]} ${fieldName};\n`)
    }
  });

  return ret.concat('};\n');
}

exports.generate = generate;
