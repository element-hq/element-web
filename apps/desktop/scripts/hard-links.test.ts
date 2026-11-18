/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { log, type Target } from "electron-builder";

import type { Exec } from "./exec.ts";
import { assertNoHardLinks } from "./hard-links.ts";

const HARD_LINK =
    "hrwxr-xr-x root/root         0 2026-11-13 10:00 ./opt/Element/chrome-sandbox link to ./opt/Element/x";

const LISTING = [
    "drwxr-xr-x root/root         0 2026-11-13 10:00 ./opt/Element/",
    "-rwxr-xr-x root/root 190000000 2026-11-13 10:00 ./opt/Element/element-desktop",
    "lrwxrwxrwx root/root         0 2026-11-13 10:00 ./usr/bin/element-desktop -> /opt/Element/element-desktop",
    "",
].join("\n");

const artifact = (file: string, target: string): { file: string; target: Target } => ({
    file,
    target: { name: target } as Target,
});

describe("assertNoHardLinks", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("lists deb contents with dpkg-deb and passes without hard links", async () => {
        const exec = vi.fn<Exec>().mockResolvedValue(LISTING);

        await expect(assertNoHardLinks(artifact("dist/e_1.0.0_amd64.deb", "deb"), exec)).resolves.toBeUndefined();
        expect(exec).toHaveBeenCalledWith("dpkg-deb", ["--contents", "dist/e_1.0.0_amd64.deb"]);
    });

    it("lists tar.gz contents with tar and fails listing the hard links", async () => {
        const exec = vi.fn<Exec>().mockResolvedValue(LISTING + HARD_LINK + "\n");

        await expect(assertNoHardLinks(artifact("dist/e-1.0.0.tar.gz", "tar.gz"), exec)).rejects.toThrow(
            `dist/e-1.0.0.tar.gz contains hard links, which lose their permissions:\n${HARD_LINK}`,
        );
        expect(exec).toHaveBeenCalledWith("tar", ["-tvzf", "dist/e-1.0.0.tar.gz"]);
    });

    it.each(["dmg", "zip", "squirrel", "msi"])("ignores %s artifacts", async (target) => {
        const exec = vi.fn<Exec>();

        await assertNoHardLinks(artifact("dist/file", target), exec);
        expect(exec).not.toHaveBeenCalled();
    });

    it("ignores artifacts without a target", async () => {
        const exec = vi.fn<Exec>();

        await assertNoHardLinks({ file: "dist/latest.yml", target: null }, exec);
        expect(exec).not.toHaveBeenCalled();
    });

    it("warns and skips the check if the listing tool is not installed", async () => {
        const warn = vi.spyOn(log, "warn").mockImplementation(() => {});
        const exec = vi
            .fn<Exec>()
            .mockRejectedValue(Object.assign(new Error("spawn dpkg-deb ENOENT"), { code: "ENOENT" }));

        await expect(assertNoHardLinks(artifact("dist/e.deb", "deb"), exec)).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith(expect.anything(), "skipped checking for hard links");
    });

    it("rethrows other failures to list the contents", async () => {
        const exec = vi.fn<Exec>().mockRejectedValue(new Error("corrupt archive"));

        await expect(assertNoHardLinks(artifact("dist/e.deb", "deb"), exec)).rejects.toThrow("corrupt archive");
    });
});
