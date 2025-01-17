/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import { SettingsSubsection } from "../../../../../../src/components/views/settings/shared/SettingsSubsection";

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
