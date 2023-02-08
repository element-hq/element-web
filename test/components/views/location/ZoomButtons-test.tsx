/*
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

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
import * as maplibregl from "maplibre-gl";
import { render, screen } from "@testing-library/react";

import ZoomButtons from "../../../../src/components/views/location/ZoomButtons";

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
