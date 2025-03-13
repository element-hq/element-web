/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React from "react";
import { render, screen, fireEvent } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import AvatarSetting from "../../../../../src/components/views/settings/AvatarSetting";
import { stubClient } from "../../../../test-utils";

const BASE64_GIF = "R0lGODlhAQABAAAAACw=";
const AVATAR_FILE = new File([Uint8Array.from(atob(BASE64_GIF), (c) => c.charCodeAt(0))], "avatar.gif", {
    type: "image/gif",
});
const GENERIC_FILE = new File([Uint8Array.from(atob(BASE64_GIF), (c) => c.charCodeAt(0))], "not-avatar.doc", {
    type: "application/msword",
});

describe("<AvatarSetting />", () => {
    beforeEach(() => {
        stubClient();
    });

    it("renders avatar with specified alt text", async () => {
        const { queryByAltText } = render(
            <AvatarSetting
                placeholderId="blee"
                placeholderName="boo"
                avatarAltText="Avatar of Peter Fox"
                avatar="mxc://example.org/my-avatar"
            />,
        );

        const imgElement = queryByAltText("Avatar of Peter Fox");
        expect(imgElement).toBeInTheDocument();
    });

    it("renders a file as the avatar when supplied", async () => {
        render(
            <AvatarSetting
                placeholderId="blee"
                placeholderName="boo"
                avatarAltText="Avatar of Peter Fox"
                avatar={AVATAR_FILE}
            />,
        );

        const imgElement = await screen.findByRole("button", { name: "Avatar of Peter Fox" });
        expect(imgElement).toBeInTheDocument();
        expect(imgElement).toHaveAttribute("src", "data:image/gif;base64," + BASE64_GIF);
    });

    it("calls onChange when a file is uploaded", async () => {
        const onChange = jest.fn();
        const user = userEvent.setup();

        render(
            <AvatarSetting
                placeholderId="blee"
                placeholderName="boo"
                avatar="mxc://example.org/my-avatar"
                avatarAltText="Avatar of Peter Fox"
                onChange={onChange}
            />,
        );

        const fileInput = screen.getByAltText("Upload");
        await user.upload(fileInput, AVATAR_FILE);

        expect(onChange).toHaveBeenCalledWith(AVATAR_FILE);
    });

    it("should noop when selecting no file", async () => {
        const onChange = jest.fn();

        render(
            <AvatarSetting
                placeholderId="blee"
                placeholderName="boo"
                avatar="mxc://example.org/my-avatar"
                avatarAltText="Avatar of Peter Fox"
                onChange={onChange}
            />,
        );

        const fileInput = screen.getByAltText("Upload");
        // Can't use userEvent.upload here as it doesn't support uploading invalid files
        fireEvent.change(fileInput, { target: { files: [] } });

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should show error if user tries to use non-image file", async () => {
        const onChange = jest.fn();

        render(
            <AvatarSetting
                placeholderId="blee"
                placeholderName="boo"
                avatar="mxc://example.org/my-avatar"
                avatarAltText="Avatar of Peter Fox"
                onChange={onChange}
            />,
        );

        const fileInput = screen.getByAltText("Upload");
        // Can't use userEvent.upload here as it doesn't support uploading invalid files
        fireEvent.change(fileInput, { target: { files: [GENERIC_FILE] } });

        expect(onChange).not.toHaveBeenCalled();
        await expect(screen.findByRole("heading", { name: "Upload Failed" })).resolves.toBeInTheDocument();
    });
});
