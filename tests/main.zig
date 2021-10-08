const std = @import("std");
const c = @cImport({
    @cInclude("alon.h");
});

const expectEqual = std.testing.expectEqual;
const expect = std.testing.expect;
const isAligned = std.mem.isAligned;

fn ExampleType(comptime Input: type) type {
    return struct {
        input: Input,
        output: []const u8,
    };
}

const Schemas = struct {
    single_fixed: struct {
        examples: []ExampleType(struct {
            x: u8,
        }),
    },
    double_packed: struct {
        examples: []ExampleType(struct {
            x: u32,
            y: u16,
        }),
    },
    double_padded: struct {
        examples: []ExampleType(struct {
            x: u8,
            y: u32,
        }),
    },
};

const allocator = std.testing.allocator;
const test_json = @embedFile("../output/test_data.json");

fn getSchemas(alloc: *std.mem.Allocator) !Schemas {
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
        const rc = c.single_fixed_deserialize(bytes.ptr, &alon);
        if (rc != 0)
            return error.Deserialize;

        try expect(alon.x != null);
        try expect(isAligned(@ptrToInt(alon.x), @alignOf(u8)));
        try expectEqual(example.input.x, alon.x.*);
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
        const rc = c.double_packed_deserialize(bytes.ptr, &alon);
        if (rc != 0)
            return error.Deserialize;

        try expect(alon.x != null);
        try expect(alon.y != null);
        try expect(isAligned(@ptrToInt(alon.x), @alignOf(u32)));
        try expect(isAligned(@ptrToInt(alon.y), @alignOf(u16)));
        try expectEqual(example.input.x, alon.x.*);
        try expectEqual(example.input.y, alon.y.*);
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
        const rc = c.double_padded_deserialize(bytes.ptr, &alon);
        if (rc != 0)
            return error.Deserialize;

        try expect(alon.x != null);
        try expect(alon.y != null);
        try expect(isAligned(@ptrToInt(alon.x), @alignOf(u8)));
        try expect(isAligned(@ptrToInt(alon.y), @alignOf(u32)));
        try expectEqual(example.input.x, alon.x.*);
        try expectEqual(example.input.y, alon.y.*);
    }
}
