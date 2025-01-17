/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";

import MiniAvatarUploader from "../../../../../src/components/views/elements/MiniAvatarUploader.tsx";
import { stubClient, withClientContextRenderOptions } from "../../../../test-utils";

const BASE64_GIF = "R0lGODlhAQABAAAAACw=";
const AVATAR_FILE = new File([Uint8Array.from(atob(BASE64_GIF), (c) => c.charCodeAt(0))], "avatar.gif", {
    type: "image/gif",
});

describe("<MiniAvatarUploader />", () => {
    it("calls setAvatarUrl when a file is uploaded", async () => {
        const cli = stubClient();
        mocked(cli.uploadContent).mockResolvedValue({ content_uri: "mxc://example.com/1234" });

        const setAvatarUrl = jest.fn();
        const user = userEvent.setup();

        const { container, findByText } = render(
            <MiniAvatarUploader hasAvatar={false} noAvatarLabel="Upload" setAvatarUrl={setAvatarUrl} isUserAvatar />,
            withClientContextRenderOptions(cli),
        );

        await findByText("Upload");
        await user.upload(container.querySelector("input")!, AVATAR_FILE);

        expect(cli.uploadContent).toHaveBeenCalledWith(AVATAR_FILE);
        expect(setAvatarUrl).toHaveBeenCalledWith("mxc://example.com/1234");
    });
});
