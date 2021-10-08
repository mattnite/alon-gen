const std = @import("std");
const c = @cImport({
    @cInclude("single_fixed.h");
    @cInclude("double_packed.h");
    @cInclude("double_padded.h");
});

const expectEqual = std.testing.expectEqual;
const expect = std.testing.expect;
const isAligned = std.mem.isAligned;

//const test_json = @embedFile("../output/test_data.json");

test "single fixed" {
    var input = try std.testing.allocator.alloc(u8, 1);
    std.mem.set(u8, input, 0);
    defer std.testing.allocator.free(input);

    var alon: c.single_fixed = undefined;
    const rc = c.single_fixed_deserialize(input.ptr, &alon);
    if (rc != 0)
        return error.Deserialize;

    try expect(isAligned(@ptrToInt(alon.x), @alignOf(u8)));
    try expectEqual(@as(u8, 0), alon.x.*);
}

test "double packed" {
    var input = try std.testing.allocator.alloc(u8, 6);
    std.mem.set(u8, input, 0);
    defer std.testing.allocator.free(input);

    var alon: c.double_packed = undefined;
    const rc = c.double_packed_deserialize(input.ptr, &alon);
    if (rc != 0)
        return error.Deserialize;

    try expect(isAligned(@ptrToInt(alon.x), @alignOf(u32)));
    try expect(isAligned(@ptrToInt(alon.y), @alignOf(u16)));
    try expectEqual(@as(u32, 0), alon.x.*);
    try expectEqual(@as(u16, 0), alon.y.*);
}

test "double padded" {
    var input = try std.testing.allocator.alloc(u8, 8);
    std.mem.set(u8, input, 0);
    defer std.testing.allocator.free(input);

    var alon: c.double_padded = undefined;
    const rc = c.double_padded_deserialize(input.ptr, &alon);
    if (rc != 0)
        return error.Deserialize;

    try expect(isAligned(@ptrToInt(alon.x), @alignOf(u8)));
    try expect(isAligned(@ptrToInt(alon.y), @alignOf(u32)));
    try expectEqual(@as(u8, 0), alon.x.*);
    try expectEqual(@as(u32, 0), alon.y.*);
}
