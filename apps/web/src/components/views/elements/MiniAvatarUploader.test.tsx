/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { render, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { stubClient, withClientContextRenderOptions } from "test-utils";

import MiniAvatarUploader from "./MiniAvatarUploader";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";

const BASE64_GIF = "R0lGODlhAQABAAAAACw=";
const AVATAR_FILE = new File([Uint8Array.from(atob(BASE64_GIF), (c) => c.charCodeAt(0))], "avatar.gif", {
    type: "image/gif",
});

describe("<MiniAvatarUploader />", () => {
    afterEach(async () => {
        await SettingsStore.setValue("feature_strip_upload_metadata", null, SettingLevel.DEVICE, null);
    });

    it("calls setAvatarUrl when a file is uploaded", async () => {
        const cli = stubClient();
        vi.mocked(cli.uploadContent).mockResolvedValue({ content_uri: "mxc://example.com/1234" });

        const setAvatarUrl = vi.fn();
        const user = userEvent.setup();

        const { container, findByLabelText } = render(
            <MiniAvatarUploader hasAvatar={false} noAvatarLabel="Upload" setAvatarUrl={setAvatarUrl} isUserAvatar />,
            withClientContextRenderOptions(cli),
        );

        await findByLabelText("Upload");
        await user.upload(container.querySelector("input")!, AVATAR_FILE);

        await waitFor(() => expect(cli.uploadContent).toHaveBeenCalledWith(AVATAR_FILE));
        expect(setAvatarUrl).toHaveBeenCalledWith("mxc://example.com/1234");
    });

    it("removes metadata from the file before uploading it when the labs feature is enabled", async () => {
        await SettingsStore.setValue("feature_strip_upload_metadata", null, SettingLevel.DEVICE, true);
        const cli = stubClient();
        vi.mocked(cli.uploadContent).mockResolvedValue({ content_uri: "mxc://example.com/1234" });
        const user = userEvent.setup();
        const photo = fs.readFileSync(
            fileURLToPath(import.meta.resolve("../../../../test/unit-tests/images/photo.jpg")),
        );
        const file = new File([new Uint8Array(photo)], "avatar.jpg", { type: "image/jpeg" });

        const { container, findByLabelText } = render(
            <MiniAvatarUploader hasAvatar={false} noAvatarLabel="Upload" setAvatarUrl={vi.fn()} isUserAvatar />,
            withClientContextRenderOptions(cli),
        );

        await findByLabelText("Upload");
        await user.upload(container.querySelector("input")!, file);

        await waitFor(() => expect(cli.uploadContent).toHaveBeenCalled());
        const uploaded = vi.mocked(cli.uploadContent).mock.calls[0][0] as File;
        expect(uploaded).not.toBe(file);
        expect(Buffer.from(await uploaded.arrayBuffer()).includes("Leaky")).toBe(false);
    });
});
