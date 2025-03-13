/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { TextInputField } from "@matrix-org/react-sdk-module-api/lib/components/TextInputField";
import { Spinner as ModuleSpinner } from "@matrix-org/react-sdk-module-api/lib/components/Spinner";

import "../../../src/modules/ModuleRunner";

describe("Module Components", () => {
    // Note: we're not testing to see if there's components that are missing a renderFactory()
    // but rather that the renderFactory() for components we do know about is actually defined
    // and working.
    //
    // We do this by deliberately not importing the ModuleComponents file itself, relying on the
    // ModuleRunner import to do its job (as per documentation in ModuleComponents).

    it("should override the factory for a TextInputField", () => {
        const { asFragment } = render(<TextInputField label="My Label" value="My Value" onChange={() => {}} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should override the factory for a ModuleSpinner", () => {
        const { asFragment } = render(<ModuleSpinner />);
        expect(asFragment()).toMatchSnapshot();
    });
});
