/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { stubClient, withClientContextRenderOptions } from "test-utils";

import MiniAvatarUploader from "./MiniAvatarUploader";

const BASE64_GIF = "R0lGODlhAQABAAAAACw=";
const AVATAR_FILE = new File([Uint8Array.from(atob(BASE64_GIF), (c) => c.charCodeAt(0))], "avatar.gif", {
    type: "image/gif",
});

describe("<MiniAvatarUploader />", () => {
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

        expect(cli.uploadContent).toHaveBeenCalledWith(AVATAR_FILE);
        expect(setAvatarUrl).toHaveBeenCalledWith("mxc://example.com/1234");
    });
});
