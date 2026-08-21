/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type HakEnv from "../../scripts/hak/hakEnv.ts";
import type { DependencyInfo } from "../../scripts/hak/dep.ts";

export default async function (hakEnv: HakEnv, moduleInfo: DependencyInfo): Promise<void> {
    const env = hakEnv.makeGypEnv();

    if (!hakEnv.isHost()) {
        env.CARGO_BUILD_TARGET = hakEnv.getTargetId();
    }

    // Seshat encrypts its index with AES-256 from the RustCrypto `aes` crate.
    // On aarch64 that crate only uses the ARMv8 hardware AES backend when built
    // with `--cfg aes_armv8`; without it, it falls back to a constant-time
    // software implementation that uses ~10-20x more CPU. (On x86_64, AES-NI is
    // auto-detected at runtime, so no flag is needed there.) Append rather than
    // overwrite so any caller-provided RUSTFLAGS are preserved.
    if (hakEnv.getTargetArch() === "arm64") {
        env.RUSTFLAGS = [env.RUSTFLAGS, "--cfg aes_armv8"].filter(Boolean).join(" ");
    }

    console.log("Running yarn install");
    await hakEnv.spawn("yarn", ["install"], {
        cwd: moduleInfo.moduleBuildDir,
        env,
        shell: true,
    });

    const buildTarget = hakEnv.wantsStaticSqlCipher() ? "build-bundled" : "build";

    console.log("Running yarn build");
    await hakEnv.spawn("yarn", ["run", buildTarget], {
        cwd: moduleInfo.moduleBuildDir,
        env,
        shell: true,
    });
}
