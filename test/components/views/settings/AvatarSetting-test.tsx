/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AvatarSetting from "../../../../src/components/views/settings/AvatarSetting";
import { stubClient } from "../../../test-utils";

const BASE64_GIF = "R0lGODlhAQABAAAAACw=";
const AVATAR_FILE = new File([Uint8Array.from(atob(BASE64_GIF), (c) => c.charCodeAt(0))], "avatar.gif", {
    type: "image/gif",
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
});
