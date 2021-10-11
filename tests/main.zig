const std = @import("std");
const c = @cImport({
    @cInclude("alon.h");
    @cInclude("errno.h");
});

const expectEqual = std.testing.expectEqual;
const expect = std.testing.expect;
const expectEqualStrings = std.testing.expectEqualStrings;
const expectEqualSlices = std.testing.expectEqualSlices;
const isAligned = std.mem.isAligned;

fn Test(comptime Input: type) type {
    return struct {
        examples: []struct {
            input: Input,
            output: []const u8,
        },
    };
}

const Schemas = struct {
    single_fixed: Test(struct {
        x: u8,
    }),
    double_packed: Test(struct {
        x: u32,
        y: u16,
    }),
    double_padded: Test(struct {
        x: u8,
        y: u32,
    }),
    single_string: Test(struct {
        x: []const u8,
    }),
    two_strings: Test(struct {
        x: []const u8,
        y: []const u8,
    }),
    fixed_buffer: Test(struct {
        x: [3]u8,
    }),
    string_first: Test(struct {
        x: []const u8,
        y: u8,
        z: u64,
        q: [3]u8,
    }),
    optional_string: Test(struct {
        x: ?[]const u8,
    }),
    optional_u64: Test(struct {
        x: ?u64,
    }),
    string_fixed_array: Test(struct {
        x: [2][]const u8,
    }),
    u16_fixed_array: Test(struct {
        x: [3]u16,
    }),
};

const allocator = std.testing.allocator;
const test_json = @embedFile("../output/test_data.json");

fn getSchemas(alloc: *std.mem.Allocator) !Schemas {
    @setEvalBranchQuota(3000);
    var stream = std.json.TokenStream.init(test_json);
    return std.json.parse(Schemas, &stream, .{
        .allocator = alloc,
        .ignore_unknown_fields = true,
    });
}

test "single fixed" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.single_fixed.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.single_fixed = undefined;
        var rc = c.single_fixed_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;
        defer c.single_fixed_deinit(&alon);

        try expectEqual(example.input.x, alon.x);

        // serialization
        std.mem.set(u8, bytes, 0xaa);
        rc = c.single_fixed_serialize(&alon, bytes.ptr, bytes.len);
        if (rc != 0)
            return error.Serialize;

        try expectEqualSlices(u8, example.output, bytes);

        // too small buffer test
        try expectEqual(@as(c_int, -c.ENOBUFS), c.single_fixed_deserialize(bytes.ptr, bytes.len - 1, &alon));
    }
}

test "double packed" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.double_packed.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.double_packed = undefined;
        var rc = c.double_packed_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;
        defer c.double_packed_deinit(&alon);

        try expectEqual(example.input.x, alon.x);
        try expectEqual(example.input.y, alon.y);

        // serialization
        std.mem.set(u8, bytes, 0xaa);
        rc = c.double_packed_serialize(&alon, bytes.ptr, bytes.len);
        if (rc != 0)
            return error.Serialize;

        try expectEqualSlices(u8, example.output, bytes);

        // too small buffer test
        try expectEqual(@as(c_int, -c.ENOBUFS), c.double_packed_deserialize(bytes.ptr, bytes.len - 1, &alon));
    }
}

test "double padded" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.double_padded.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.double_padded = undefined;
        var rc = c.double_padded_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;
        defer c.double_padded_deinit(&alon);

        try expectEqual(example.input.x, alon.x);
        try expectEqual(example.input.y, alon.y);

        // serialization
        std.mem.set(u8, bytes, 0xaa);
        rc = c.double_padded_serialize(&alon, bytes.ptr, bytes.len);
        if (rc != 0)
            return error.Serialize;

        try expectEqualSlices(u8, example.output, bytes);

        // too small buffer test
        try expectEqual(@as(c_int, -c.ENOBUFS), c.double_padded_deserialize(bytes.ptr, bytes.len - 1, &alon));
    }
}

test "single string" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.single_string.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.single_string = undefined;
        var rc = c.single_string_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;
        defer c.single_string_deinit(&alon);

        try expect(alon.x != null);

        var str: []const u8 = undefined;
        str.ptr = alon.x;
        str.len = std.mem.lenZ(alon.x);
        try expectEqualStrings(example.input.x, str);

        // serialization
        std.mem.set(u8, bytes, 0xaa);
        rc = c.single_string_serialize(&alon, bytes.ptr, bytes.len);
        if (rc != 0)
            return error.Serialize;

        try expectEqualSlices(u8, example.output, bytes);

        // too small buffer test
        try expectEqual(@as(c_int, -c.ENOBUFS), c.single_string_deserialize(bytes.ptr, bytes.len - 1, &alon));
    }
}

test "two strings" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.two_strings.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.two_strings = undefined;
        var rc = c.two_strings_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;
        defer c.two_strings_deinit(&alon);

        try expect(alon.x != null);
        try expect(alon.y != null);

        var str_x: []const u8 = undefined;
        str_x.ptr = alon.x;
        str_x.len = std.mem.lenZ(alon.x);

        var str_y: []const u8 = undefined;
        str_y.ptr = alon.y;
        str_y.len = std.mem.lenZ(alon.y);

        try expectEqualStrings(example.input.x, str_x);
        try expectEqualStrings(example.input.y, str_y);

        // serialization
        std.mem.set(u8, bytes, 0xaa);
        rc = c.two_strings_serialize(&alon, bytes.ptr, bytes.len);
        if (rc != 0)
            return error.Serialize;

        try expectEqualSlices(u8, example.output, bytes);

        // too small buffer test
        try expectEqual(@as(c_int, -c.ENOBUFS), c.two_strings_deserialize(bytes.ptr, bytes.len - 1, &alon));
    }
}

test "fixed buffer" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.fixed_buffer.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.fixed_buffer = undefined;
        var rc = c.fixed_buffer_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;
        defer c.fixed_buffer_deinit(&alon);

        try expectEqualSlices(u8, &example.input.x, &alon.x);

        // serialization
        std.mem.set(u8, bytes, 0xaa);
        rc = c.fixed_buffer_serialize(&alon, bytes.ptr, bytes.len);
        if (rc != 0)
            return error.Serialize;

        try expectEqualSlices(u8, example.output, bytes);

        // too small buffer test
        try expectEqual(@as(c_int, -c.ENOBUFS), c.fixed_buffer_deserialize(bytes.ptr, bytes.len - 1, &alon));
    }
}

test "string first" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.string_first.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.string_first = undefined;
        var rc = c.string_first_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;
        defer c.string_first_deinit(&alon);

        var str: []const u8 = undefined;
        str.ptr = alon.x;
        str.len = std.mem.lenZ(alon.x);
        try expectEqualStrings(example.input.x, str);
        try expectEqual(example.input.y, alon.y);
        try expectEqual(example.input.z, alon.z);
        try expectEqualSlices(u8, &example.input.q, &alon.q);

        // serialization
        std.mem.set(u8, bytes, 0xaa);
        rc = c.string_first_serialize(&alon, bytes.ptr, bytes.len);
        if (rc != 0)
            return error.Serialize;

        try expectEqualSlices(u8, example.output, bytes);

        // too small buffer test
        try expectEqual(@as(c_int, -c.ENOBUFS), c.string_first_deserialize(bytes.ptr, bytes.len - 1, &alon));
    }
}

test "optional string" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.optional_string.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.optional_string = undefined;
        var rc = c.optional_string_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;
        defer c.optional_string_deinit(&alon);

        if (example.input.x == null) {
            try expect(alon.x == null);
        } else {
            try expect(alon.x != null);
            var str: []const u8 = undefined;
            str.ptr = alon.x;
            str.len = std.mem.lenZ(alon.x);

            try expectEqualStrings(example.input.x.?, str);
        }

        // serialization
        std.mem.set(u8, bytes, 0xaa);
        rc = c.optional_string_serialize(&alon, bytes.ptr, bytes.len);
        if (rc != 0)
            return error.Serialize;

        try expectEqualSlices(u8, example.output, bytes);
    }
}

test "optional u64" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.optional_u64.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.optional_u64 = undefined;
        var rc = c.optional_u64_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;

        if (example.input.x) |x| {
            try expectEqual(@as(u8, 1), alon.x.is_set);
            try expectEqual(x, alon.x.val);
        } else {
            try expectEqual(@as(u8, 0), alon.x.is_set);
        }
    }
}

test "string fixed array" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.string_fixed_array.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.string_fixed_array = undefined;
        var rc = c.string_fixed_array_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;
        defer c.string_fixed_array_deinit(&alon);

        for (example.input.x) |example_str, i| {
            var str: []const u8 = undefined;
            str.ptr = alon.x[i];
            str.len = std.mem.lenZ(alon.x[i]);

            try expectEqualStrings(example_str, str);
        }

        // serialization
        std.mem.set(u8, bytes, 0xaa);
        rc = c.string_fixed_array_serialize(&alon, bytes.ptr, bytes.len);
        if (rc != 0)
            return error.Serialize;

        try expectEqualSlices(u8, example.output, bytes);
    }
}

test "u16 fixed array" {
    const schemas = try getSchemas(allocator);
    defer std.json.parseFree(Schemas, schemas, .{
        .allocator = allocator,
    });

    for (schemas.u16_fixed_array.examples) |example| {
        var bytes = try allocator.dupe(u8, example.output);
        defer allocator.free(bytes);

        var alon: c.u16_fixed_array = undefined;
        var rc = c.u16_fixed_array_deserialize(bytes.ptr, bytes.len, &alon);
        if (rc != 0)
            return error.Deserialize;
        defer c.u16_fixed_array_deinit(&alon);

        try expectEqualSlices(u16, &example.input.x, &alon.x);

        // serialization
        std.mem.set(u8, bytes, 0xaa);
        rc = c.u16_fixed_array_serialize(&alon, bytes.ptr, bytes.len);
        if (rc != 0)
            return error.Serialize;

        try expectEqualSlices(u8, example.output, bytes);
    }
}
