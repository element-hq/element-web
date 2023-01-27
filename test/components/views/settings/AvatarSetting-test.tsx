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
import { render } from "@testing-library/react";

import AvatarSetting from "../../../../src/components/views/settings/AvatarSetting";

describe("<AvatarSetting />", () => {
    it("renders avatar with specified alt text", async () => {
        const { queryByAltText } = render(
            <AvatarSetting
                avatarName="Peter Fox"
                avatarAltText="Avatar of Peter Fox"
                avatarUrl="https://avatar.fictional/my-avatar"
            />,
        );

        const imgElement = queryByAltText("Avatar of Peter Fox");
        expect(imgElement).toBeInTheDocument();
    });

    it("renders avatar with remove button", async () => {
        const { queryByText } = render(
            <AvatarSetting
                avatarName="Peter Fox"
                avatarAltText="Avatar of Peter Fox"
                avatarUrl="https://avatar.fictional/my-avatar"
                removeAvatar={jest.fn()}
            />,
        );

        const removeButton = queryByText("Remove");
        expect(removeButton).toBeInTheDocument();
    });

    it("renders avatar without remove button", async () => {
        const { queryByText } = render(<AvatarSetting avatarName="Peter Fox" avatarAltText="Avatar of Peter Fox" />);

        const removeButton = queryByText("Remove");
        expect(removeButton).toBeNull();
    });
});
