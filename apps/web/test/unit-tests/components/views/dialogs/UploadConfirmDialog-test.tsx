/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import UploadConfirmDialog from "../../../../../src/components/views/dialogs/UploadConfirmDialog.tsx";

describe("<UploadConfirmDialog />", () => {
    it("should display image preview", () => {
        const url = "blob:null/1234-5678-9101-1121";
        jest.spyOn(URL, "createObjectURL").mockReturnValue(url);

        const file = new File([secureRandomString(1024 * 124)], "image.png", { type: "image/png" });
        const { asFragment, getByRole } = render(
            <UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} onFinished={jest.fn()} />,
        );

        expect(getByRole("img")).toHaveAttribute("src", url);
        expect(asFragment()).toMatchSnapshot();
    });
});
