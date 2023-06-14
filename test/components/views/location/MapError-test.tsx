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
import { render, RenderResult } from "@testing-library/react";

import { MapError, MapErrorProps } from "../../../../src/components/views/location/MapError";
import { LocationShareError } from "../../../../src/utils/location";

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
