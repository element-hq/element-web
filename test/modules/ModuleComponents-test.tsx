/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { TextInputField } from "@matrix-org/react-sdk-module-api/lib/components/TextInputField";
import { Spinner as ModuleSpinner } from "@matrix-org/react-sdk-module-api/lib/components/Spinner";

import "../../src/modules/ModuleRunner";

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
