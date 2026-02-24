/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, type RenderResult } from "jest-matrix-react";

import { MapError, type MapErrorProps } from "../../../../../src/components/views/location/MapError";
import { LocationShareError } from "../../../../../src/utils/location";

describe("<MapError />", () => {
    const defaultProps = {
        onFinished: jest.fn(),
        error: LocationShareError.MapStyleUrlNotConfigured,
        className: "test",
    };
    const getComponent = (props: Partial<MapErrorProps> = {}): RenderResult =>
        render(<MapError {...defaultProps} {...props} />);

    it("renders correctly for MapStyleUrlNotConfigured", () => {
        const { container } = getComponent();
        expect(container).toMatchSnapshot();
    });

    it("renders correctly for MapStyleUrlNotReachable", () => {
        const { container } = getComponent({
            error: LocationShareError.MapStyleUrlNotReachable,
        });
        expect(container).toMatchSnapshot();
    });

    it("does not render button when onFinished falsy", () => {
        const { queryByText } = getComponent({
            error: LocationShareError.MapStyleUrlNotReachable,
            onFinished: undefined,
        });
        // no button
        expect(queryByText("OK")).toBeFalsy();
    });

    it("applies class when isMinimised is truthy", () => {
        const { container } = getComponent({
            isMinimised: true,
        });
        expect(container).toMatchSnapshot();
    });
});
