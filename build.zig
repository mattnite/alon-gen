const std = @import("std");

pub fn build(b: *std.build.Builder) void {
    // Standard release options allow the person running `zig build` to select
    // between Debug, ReleaseSafe, ReleaseFast, and ReleaseSmall.
    const mode = b.standardReleaseOptions();

    const command_run = b.addSystemCommand(&.{ "node", "test.js" });
    var main_tests = b.addTest("tests/main.zig");
    main_tests.addIncludeDir("output");
    main_tests.addCSourceFile("output/alon.c", &.{});
    main_tests.setBuildMode(.Debug);
    main_tests.step.dependOn(&command_run.step);
    main_tests.linkLibC();

    const test_step = b.step("test", "Run library tests");
    test_step.dependOn(&main_tests.step);
}
