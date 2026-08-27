/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { GLIBC, MUSL, familySync as processLibC } from "detect-libc";

// We borrow Rust's target naming scheme as a way of expressing all target
// details in a single string.
// See https://doc.rust-lang.org/rustc/platform-support.html.
export type TargetId =
    | "aarch64-apple-darwin"
    | "x86_64-apple-darwin"
    | "universal-apple-darwin"
    | "i686-pc-windows-msvc"
    | "x86_64-pc-windows-msvc"
    | "aarch64-pc-windows-msvc"
    | "i686-unknown-freebsd"
    | "x86_64-unknown-freebsd"
    | "aarch64-unknown-freebsd"
    | "i686-unknown-linux-musl"
    | "i686-unknown-linux-gnu"
    | "x86_64-unknown-linux-musl"
    | "x86_64-unknown-linux-gnu"
    | "aarch64-unknown-linux-musl"
    | "aarch64-unknown-linux-gnu"
    | "powerpc64le-unknown-linux-musl"
    | "powerpc64le-unknown-linux-gnu";

// Values are expected to match those used in `process.platform`.
export type Platform = "darwin" | "freebsd" | "linux" | "win32";

// Values are expected to match those used in `process.arch`.
export type Arch = "arm64" | "ia32" | "x64" | "ppc64" | "universal";

// Values are expected to match those used by Visual Studio's `vcvarsall.bat`.
// See https://docs.microsoft.com/cpp/build/building-on-the-command-line?view=msvc-160#vcvarsall-syntax
export type VcVarsArch = "amd64" | "arm64" | "x86";

export type Target = {
    id: TargetId;
    platform: Platform;
    arch: Arch;
};

export type WindowsTarget = Target & {
    platform: "win32";
    vcVarsArch: VcVarsArch;
};

export type LinuxTarget = Target & {
    platform: "linux";
    libC: typeof GLIBC | typeof MUSL;
};

export type UniversalTarget = Target & {
    arch: "universal";
    subtargets: Target[];
};

const aarch64AppleDarwin: Target = {
    id: "aarch64-apple-darwin",
    platform: "darwin",
    arch: "arm64",
};

const x8664AppleDarwin: Target = {
    id: "x86_64-apple-darwin",
    platform: "darwin",
    arch: "x64",
};

const universalAppleDarwin: UniversalTarget = {
    id: "universal-apple-darwin",
    platform: "darwin",
    arch: "universal",
    subtargets: [aarch64AppleDarwin, x8664AppleDarwin],
};

const i686PcWindowsMsvc: WindowsTarget = {
    id: "i686-pc-windows-msvc",
    platform: "win32",
    arch: "ia32",
    vcVarsArch: "x86",
};

const x8664PcWindowsMsvc: WindowsTarget = {
    id: "x86_64-pc-windows-msvc",
    platform: "win32",
    arch: "x64",
    vcVarsArch: "amd64",
};

const aarch64WindowsMsvc: WindowsTarget = {
    id: "aarch64-pc-windows-msvc",
    platform: "win32",
    arch: "arm64",
    vcVarsArch: "arm64",
};

const i686UnknownFreebsd: Target = {
    id: "i686-unknown-freebsd",
    platform: "freebsd",
    arch: "ia32",
};

const x8664UnknownFreebsd: Target = {
    id: "x86_64-unknown-freebsd",
    platform: "freebsd",
    arch: "x64",
};

const aarch64UnknownFreebsd: Target = {
    id: "aarch64-unknown-freebsd",
    platform: "freebsd",
    arch: "arm64",
};

const x8664UnknownLinuxGnu: LinuxTarget = {
    id: "x86_64-unknown-linux-gnu",
    platform: "linux",
    arch: "x64",
    libC: GLIBC,
};

const x8664UnknownLinuxMusl: LinuxTarget = {
    id: "x86_64-unknown-linux-musl",
    platform: "linux",
    arch: "x64",
    libC: MUSL,
};

const i686UnknownLinuxGnu: LinuxTarget = {
    id: "i686-unknown-linux-gnu",
    platform: "linux",
    arch: "ia32",
    libC: GLIBC,
};

const i686UnknownLinuxMusl: LinuxTarget = {
    id: "i686-unknown-linux-musl",
    platform: "linux",
    arch: "ia32",
    libC: MUSL,
};

const aarch64UnknownLinuxGnu: LinuxTarget = {
    id: "aarch64-unknown-linux-gnu",
    platform: "linux",
    arch: "arm64",
    libC: GLIBC,
};

const aarch64UnknownLinuxMusl: LinuxTarget = {
    id: "aarch64-unknown-linux-musl",
    platform: "linux",
    arch: "arm64",
    libC: MUSL,
};

const powerpc64leUnknownLinuxGnu: LinuxTarget = {
    id: "powerpc64le-unknown-linux-gnu",
    platform: "linux",
    arch: "ppc64",
    libC: GLIBC,
};

const powerpc64leUnknownLinuxMusl: LinuxTarget = {
    id: "powerpc64le-unknown-linux-musl",
    platform: "linux",
    arch: "ppc64",
    libC: MUSL,
};

export const TARGETS: Record<TargetId, Target> = {
    // macOS
    "aarch64-apple-darwin": aarch64AppleDarwin,
    "x86_64-apple-darwin": x8664AppleDarwin,
    "universal-apple-darwin": universalAppleDarwin,
    // Windows
    "i686-pc-windows-msvc": i686PcWindowsMsvc,
    "x86_64-pc-windows-msvc": x8664PcWindowsMsvc,
    "aarch64-pc-windows-msvc": aarch64WindowsMsvc,
    // FreeBSD
    "i686-unknown-freebsd": i686UnknownFreebsd,
    "x86_64-unknown-freebsd": x8664UnknownFreebsd,
    "aarch64-unknown-freebsd": aarch64UnknownFreebsd,
    // Linux
    "i686-unknown-linux-musl": i686UnknownLinuxMusl,
    "i686-unknown-linux-gnu": i686UnknownLinuxGnu,
    "x86_64-unknown-linux-musl": x8664UnknownLinuxMusl,
    "x86_64-unknown-linux-gnu": x8664UnknownLinuxGnu,
    "aarch64-unknown-linux-musl": aarch64UnknownLinuxMusl,
    "aarch64-unknown-linux-gnu": aarch64UnknownLinuxGnu,
    "powerpc64le-unknown-linux-musl": powerpc64leUnknownLinuxMusl,
    "powerpc64le-unknown-linux-gnu": powerpc64leUnknownLinuxGnu,
};

export function getHost(): Target | undefined {
    return Object.values(TARGETS).find(
        (target) =>
            target.platform === process.platform &&
            target.arch === process.arch &&
            (process.platform !== "linux" || (target as LinuxTarget).libC === processLibC()),
    );
}

export function isHostId(id: TargetId): boolean {
    return getHost()?.id === id;
}

export function isHost(target: Target): boolean {
    return getHost()?.id === target.id;
}
