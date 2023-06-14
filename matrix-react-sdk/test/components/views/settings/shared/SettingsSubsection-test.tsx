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

import SettingsSubsection from "../../../../../src/components/views/settings/shared/SettingsSubsection";

describe("<SettingsSubsection />", () => {
    const defaultProps = {
        heading: "Test",
        children: <div>test settings content</div>,
    };
    const getComponent = (props = {}): React.ReactElement => <SettingsSubsection {...defaultProps} {...props} />;

    it("renders with plain text heading", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders with react element heading", () => {
        const heading = <h3>This is the heading</h3>;
        const { container } = render(getComponent({ heading }));
        expect(container).toMatchSnapshot();
    });

    it("renders without description", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders with plain text description", () => {
        const { container } = render(getComponent({ description: "This describes the subsection" }));
        expect(container).toMatchSnapshot();
    });

    it("renders with react element description", () => {
        const description = (
            <p>
                This describes the section <a href="/#">link</a>
            </p>
        );
        const { container } = render(getComponent({ description }));
        expect(container).toMatchSnapshot();
    });
});
