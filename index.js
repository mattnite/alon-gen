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
  return `
${structDefn(name, schema)}

${funcProtoDeserializeRaw(name)};
${funcProtoDeserializeAccount(name)};
${funcProtoDeserializeInstruction(name)};
${funcProtoSerializeRaw(name)};
${funcProtoSerializeAccount(name)};
${funcProtoSerializeInstruction(name)};
${funcProtoDeinit(name)};
`
}

function funcProtoDeserializeRaw(name) {
  return `int ${name}_deserialize(const uint8_t *buf, uint64_t len, struct ${name}* out)`;
}

function funcProtoDeserializeAccount(name) {
  return `int ${name}_deserialize_account(const SolAccountInfo *account, struct ${name}* out)`;
}

function funcProtoDeserializeInstruction(name) {
  return `int ${name}_deserialize_instruction(const SolParameters *params, struct ${name}* out)`;
}

function funcProtoSerializeRaw(name) {
  return `int ${name}_serialize(struct ${name} *in, uint8_t *buf, uint64_t len)`;
}

function funcProtoSerializeAccount(name) {
  return `int ${name}_serialize_account(struct ${name}* in, SolAccountInfo *account)`;
}

function funcProtoSerializeInstruction(name) {
  return `int ${name}_serialize_instruction(struct ${name}* in, SolParameters *params)`;
}

function funcProtoDeinit(name) {
  return `void ${name}_deinit(struct ${name} *${name})`;
}

function genSource(name, schema) {
  let ret = `${funcProtoDeserializeRaw(name)} {\n`;
  let state = {
    offset: 0,
    isDynamic: false,
    text: "",
    scope: [],
  };

  state = genStructDeserialize(state, name, schema);
  if (!state.isDynamic && state.offset > 0) {
    ret = ret.concat(
      `    if (len < ${state.offset}) {\n`,
      `        return -ENOBUFS;\n`,
      `    }\n\n`);
  }

  ret = ret.concat(state.text, '    return 0;\n}\n\n');

  ret = ret.concat(
    `${funcProtoDeserializeAccount(name)} {\n`,
    `    return ${name}_deserialize(account->data, account->data_len, out);\n`,
    `}\n`,
    `\n`,
    `${funcProtoDeserializeInstruction(name)} {\n`,
    `    return ${name}_deserialize(params->data, params->data_len, out);\n`,
    `\n`,
    `}\n\n`);

  state = {
    offset: 0,
    isDynamic: false,
    text: "",
    scope: [],
  };
  ret = ret.concat(`${funcProtoSerializeRaw(name)} {\n`);
  state = genStructSerialize(state, name, schema);
  if (!state.isDynamic && state.offset > 0) {
    ret = ret.concat(
      `    if (len < ${state.offset}) {\n`,
      `        return -ENOBUFS;\n`,
      `    }\n\n`);
  }

  ret = ret.concat(state.text, '    return 0;\n}\n\n');
  ret =  ret.concat(`${funcProtoDeinit(name)} {\n`);
  ret = genDeinit(ret, name, schema);
  ret = ret.concat('}\n\n');

  ret = ret.concat(
    `${funcProtoSerializeAccount(name)} {\n`,
    `    return ${name}_serialize(in, account->data, account->data_len);\n`,
    `}\n`,
    `\n`,
    `${funcProtoDeserializeInstruction(name)} {\n`,
    `    return ${name}_serialize(in, params->data, params->data_len);\n`,
    `\n`,
    `}\n\n`);

  return ret;
}

function genDeinit(text, name, schema) {
  if (schema.kind === 'struct') {
    for (const [fieldName, fieldType] of schema.fields) {
      if (typeof fieldType === 'string' && fieldType === 'string')
        text = text.concat(`    sol_free(${name}->${fieldName});\n`);
      else if (fieldType instanceof Array && fieldType.length > 1 && fieldType[0] === 'string') {
        for (let i = 0; i < fieldType[1]; i++) {
          text = text.concat(`    sol_free(${name}->${fieldName}[${i}]);\n`);
        }
      } else if (schema.kind === 'option' && schema.type === 'string') {
        text = text.concat(`    sol_free(${name}->${fieldName});\n`);
      }
    }
  }

  return text;
}

function genStructDeserialize(state, name, schema) {
  if (state.scope.length == 0)
    state.scope.push("out");
  else
    state.scope.push(name);

  switch (schema.kind) {
    case 'struct':
      for (const [fieldName, fieldType] of schema.fields) {
        state = genFieldDeserialize(state, fieldName, fieldType);
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

function genStructSerialize(state, name, schema) {
  if (state.scope.length == 0)
    state.scope.push("in");
  else
    state.scope.push(name);

  switch (schema.kind) {
    case 'struct':
      for (const [fieldName, fieldType] of schema.fields) {
        state = genFieldSerialize(state, fieldName, fieldType);
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

function genFieldDeserialize(state, name, schema) {
 if (typeof schema === 'string')
   return genBasicDeserialize(state, name, schema);
 else if (schema instanceof Array)
   return genFixedDeserialize(state, name, schema);
 else if (schema.kind === 'option')
   return genOptionDeserialize(state, name, schema);
 else
   return genStructDeserialize(state, name, schema);
}

function genFieldSerialize(state, name, schema) {
 if (typeof schema === 'string')
   return genBasicSerialize(state, name, schema);
 else if (schema instanceof Array)
   return genFixedSerialize(state, name, schema);
 else if (schema.kind === 'option')
   return genOptionSerialize(state, name, schema);
 else
   return genStructSerialize(state, name, schema);
}

function deref(scope, name) {
  if (scope.length == 1)
    return `${scope[0]}->${name}`;
  else
    return `${scope[0]}->${scope.slice(1).join('.')}.${name}`;
}

// schema is assumed to be a string
function genBasicDeserialize(state, name, schema) {
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
      `        sol_memcpy(&str_len, buf + offset, sizeof(uint32_t));\n`,
      `        offset += sizeof(uint32_t);\n`,
      `        if (len < offset + str_len)\n`,
      `            return -ENOBUFS;\n`,
      `\n`,
      `        ${member} = calloc(1, str_len + 1);\n`,
      `        if (NULL == ${member})\n`,
      `            return -ENOMEM;\n`,
      `\n`,
      `        sol_memcpy(${member}, buf + offset, str_len);\n`,
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
      `    sol_memcpy(&${member}, buf + offset, sizeof(${c_types[schema]}));\n`,
      `    offset += sizeof(${c_types[schema]});\n`);
  } else {
    state.text = state.text.concat(
      `    sol_memcpy(&${deref(state.scope, name)}, buf + ${state.offset}, sizeof(${c_types[schema]}));\n`);
    state.offset += sizes[schema];
  }

  return state;
}

function genBasicSerialize(state, name, schema) {
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
      `        uint32_t str_len = sol_strlen(${member});\n`,
      `        sol_memcpy(buf + offset, &str_len, sizeof(uint32_t));\n`,
      `        offset += sizeof(uint32_t);\n`,
      `        if (len < offset + str_len)\n`,
      `            return -ENOBUFS;\n`,
      `\n`,
      `        sol_memcpy(buf + offset, ${member}, str_len);\n`,
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
      `    sol_memcpy(buf + offset, &${member}, sizeof(${c_types[schema]}));\n`,
      `    offset += sizeof(${c_types[schema]});\n`);
  } else {
    state.text = state.text.concat(
      `    sol_memcpy(buf + ${state.offset}, &${deref(state.scope, name)}, sizeof(${c_types[schema]}));\n`);
    state.offset += sizes[schema];
  }

  return state;
}

function genFixedDeserialize(state, name, schema) {
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
      `        sol_memcpy(&str_len, buf + offset, sizeof(uint32_t));\n`,
      `        offset += sizeof(uint32_t);\n`,
      `        if (len < offset + str_len)\n`,
      `            return -ENOBUFS;\n`,
      `\n`,
      `        ${member}[i] = calloc(1, str_len + 1);\n`,
      `        if (NULL == ${member}[i])\n`,
      `            return -ENOMEM;\n`,
      `\n`,
      `        sol_memcpy(${member}[i], buf + offset, str_len);\n`,
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
        `    sol_memcpy(&${member}, buf + offset, sizeof(${member}));\n`,
        `    offset += sizeof(${member});\n`);
    } else {
      const member = `${deref(state.scope, name)}`;
      state.text = state.text.concat(
        `    sol_memcpy(${member}, buf + ${state.offset}, sizeof(${member}));\n`);
      state.offset += schema[0];
    }
  }

  return state;
}

function genFixedSerialize(state, name, schema) {
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
      `        uint32_t str_len = sol_strlen(${member}[i]);\n`,
      `        sol_memcpy(buf + offset, &str_len, sizeof(uint32_t));\n`,
      `        offset += sizeof(uint32_t);\n`,
      `        if (len < offset + str_len)\n`,
      `            return -ENOBUFS;\n`,
      `\n`,
      `        sol_memcpy(buf + offset, ${member}[i], str_len);\n`,
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
        `    sol_memcpy(buf + offset, &${member}, sizeof(${member}));\n`,
        `    offset += sizeof(${member});\n`);
    } else {
      const member = `${deref(state.scope, name)}`;
      state.text = state.text.concat(
        `    sol_memcpy(buf + ${state.offset}, ${member}, sizeof(${member}));\n`);
      state.offset += schema[0];
    }
  }

  return state;
}

function genOptionDeserialize(state, name, schema) {
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
    `        sol_memcpy(&is_set, buf + offset, sizeof(uint8_t));\n`,
    `        offset += sizeof(uint8_t);\n`,
    `        if (is_set != 0) {\n`);

  const member = deref(state.scope, name);
  if (schema.type === 'string') {
    state.text = state.text.concat(
      `            if (len < offset + sizeof(uint32_t))\n`,
      `                return -ENOBUFS;\n`,
      `\n`,
      `            uint32_t str_len;\n`,
      `            sol_memcpy(&str_len, buf + offset, sizeof(uint32_t));\n`,
      `            offset += sizeof(uint32_t);\n`,
      `            if (len < offset + str_len)\n`,
      `                return -ENOBUFS;\n`,
      `\n`,
      `            ${member} = calloc(1, str_len + 1);\n`,
      `            if (NULL == ${member})\n`,
      `                return -ENOMEM;\n`,
      `\n`,
      `            sol_memcpy(${member}, buf + offset, str_len);\n`,
      `            ${member}[str_len] = 0;\n`,
      `            offset += str_len;\n`,
      `    } else {\n`,
      `        ${member} = NULL;\n`);
  } else {
    state.text = state.text.concat(
      `            if (len < offset + sizeof(${c_types[schema.type]}))\n`,
      `                return -ENOBUFS;\n`,
      `\n`,    
      `            sol_memcpy(&${member}.val, buf + offset, sizeof(${c_types[schema.type]}));\n`,
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

function genOptionSerialize(state, name, schema) {
  if (!state.isDynamic) {
    state.text = state.text.concat(
      `    uint64_t offset = ${state.offset};\n`);
    state.isDynamic = true;
  }

  const member = deref(state.scope, name);
  if (schema.type === 'string') {
    state.text = state.text.concat(
      `    if (len < offset + sizeof(uint8_t))\n`,
      `        return -ENOBUFS;\n`,
      `\n`,
      `    if (${member} == NULL) {\n`,
      `        buf[offset++] = 0;\n`,
      `    } else {\n`,
      `        buf[offset++] = 1;\n`,
      `        if (len < offset + sizeof(uint32_t))\n`,
      `            return -ENOBUFS;\n`,
      `\n`,
      `        uint32_t str_len = sol_strlen(${member});\n`,
      `        sol_memcpy(buf + offset, &str_len, sizeof(uint32_t));\n`,
      `        offset += sizeof(uint32_t);\n`,
      `        if (len < offset + str_len)\n`,
      `            return -ENOBUFS;\n`,
      `\n`,
      `        sol_memcpy(buf + offset, ${member}, str_len);\n`,
      `        offset += str_len;\n`,
      `    }\n`);
  } else {
    state.text = state.text.concat(
      `    if (len < offset + sizeof(uint8_t))\n`,
      `        return -ENOBUFS;\n`,
      `\n`,
      `    if (${member}.is_set == 0) {\n`,
      `        buf[offset++] = 0;\n`,
      `    } else {\n`,
      `        buf[offset++] = 1;\n`,
      `        if (len < offset + sizeof(${c_types[schema.type]}))\n`,
      `            return -ENOBUFS;\n`,
      `\n`,    
      `        sol_memcpy(buf + offset, &${member}.val, sizeof(${c_types[schema.type]}));\n`,
      `        offset += sizeof(${c_types[schema.type]});\n`,
      `    }\n`);
  }

  return state;
}

function structDefn(name, schema) {
  var fields_key = 'fields';
  if (schema.kind == 'enum')
    fields_key = 'values';

  let ret = `struct ${name} {\n`;
  schema[fields_key].forEach(([fieldName, fieldType]) => {
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
