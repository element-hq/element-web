/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { stripFileMetadataIfEnabled } from "./stripFileMetadataIfEnabled";
import { MetadataStripError } from "./MetadataStripError";
import SettingsStore from "../../settings/SettingsStore";
import { SettingLevel } from "../../settings/SettingLevel";

/** A photo whose Exif, XMP and IPTC hold a location, device and author, all of whose text starts with "Leaky". */
function photoWithMetadata(): File {
    const path = fileURLToPath(import.meta.resolve("../../../test/unit-tests/images/photo.jpg"));
    return new File([new Uint8Array(fs.readFileSync(path))], "avatar.jpg", { type: "image/jpeg" });
}

describe("stripFileMetadataIfEnabled", () => {
    afterEach(async () => {
        await SettingsStore.setValue("feature_strip_upload_metadata", null, SettingLevel.DEVICE, null);
    });

    it("returns the original file by default", async () => {
        const file = photoWithMetadata();

        await expect(stripFileMetadataIfEnabled(file)).resolves.toBe(file);
    });

    it("removes metadata when the labs feature is enabled", async () => {
        await SettingsStore.setValue("feature_strip_upload_metadata", null, SettingLevel.DEVICE, true);
        const file = photoWithMetadata();
        const stripped = await stripFileMetadataIfEnabled(file);

        expect(stripped).not.toBe(file);
        expect(Buffer.from(await stripped.arrayBuffer()).includes("Leaky")).toBe(false);
    });

    it("throws rather than returning a file whose metadata could not be removed", async () => {
        await SettingsStore.setValue("feature_strip_upload_metadata", null, SettingLevel.DEVICE, true);
        const file = new File(["not a jpeg"], "avatar.jpg", { type: "image/jpeg" });

        await expect(stripFileMetadataIfEnabled(file)).rejects.toBeInstanceOf(MetadataStripError);
    });
});
