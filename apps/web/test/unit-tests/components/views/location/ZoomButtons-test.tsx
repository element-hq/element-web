/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import * as maplibregl from "maplibre-gl";
import { render, screen } from "jest-matrix-react";

import ZoomButtons from "../../../../../src/components/views/location/ZoomButtons";

describe("<ZoomButtons />", () => {
    const mapOptions = { container: {} as unknown as HTMLElement, style: "" };
    const mockMap = new maplibregl.Map(mapOptions);
    const defaultProps = {
        map: mockMap,
    };
    const getComponent = (props = {}) => render(<ZoomButtons {...defaultProps} {...props} />);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders buttons", () => {
        const component = getComponent();
        expect(component.asFragment()).toMatchSnapshot();
    });

    it("calls map zoom in on zoom in click", () => {
        const component = getComponent();
        screen.getByTestId("map-zoom-in-button").click();

        expect(mockMap.zoomIn).toHaveBeenCalled();
        expect(component).toBeTruthy();
    });

    it("calls map zoom out on zoom out click", () => {
        const component = getComponent();
        screen.getByTestId("map-zoom-out-button").click();

        expect(mockMap.zoomOut).toHaveBeenCalled();
        expect(component).toBeTruthy();
    });
});
