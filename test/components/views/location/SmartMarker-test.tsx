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
import { mocked } from "jest-mock";
import * as maplibregl from "maplibre-gl";

import SmartMarker from "../../../../src/components/views/location/SmartMarker";

jest.mock("../../../../src/utils/location/findMapStyleUrl", () => ({
    findMapStyleUrl: jest.fn().mockReturnValue("tileserver.com"),
}));

describe("<SmartMarker />", () => {
    const mapOptions = { container: {} as unknown as HTMLElement, style: "" };
    const mockMap = new maplibregl.Map(mapOptions);
    const mockMarker = new maplibregl.Marker();

    const defaultProps = {
        map: mockMap,
        geoUri: "geo:43.2,54.6",
    };
    const getComponent = (props = {}): JSX.Element => <SmartMarker {...defaultProps} {...props} />;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("creates a marker on mount", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();

        // marker added only once
        expect(maplibregl.Marker).toHaveBeenCalledTimes(1);
        // set to correct position
        expect(mockMarker.setLngLat).toHaveBeenCalledWith({ lon: 54.6, lat: 43.2 });
        // added to map
        expect(mockMarker.addTo).toHaveBeenCalledWith(mockMap);
    });

    it("updates marker position on change", () => {
        const { rerender } = render(getComponent({ geoUri: "geo:40,50" }));

        rerender(getComponent({ geoUri: "geo:41,51" }));
        rerender(getComponent({ geoUri: "geo:42,52" }));

        // marker added only once
        expect(maplibregl.Marker).toHaveBeenCalledTimes(1);
        // set positions
        expect(mocked(mockMarker.setLngLat)).toHaveBeenCalledWith({ lat: 40, lon: 50 });
        expect(mocked(mockMarker.setLngLat)).toHaveBeenCalledWith({ lat: 41, lon: 51 });
        expect(mocked(mockMarker.setLngLat)).toHaveBeenCalledWith({ lat: 42, lon: 52 });
    });

    it("removes marker on unmount", () => {
        const { unmount, container } = render(getComponent());
        expect(container).toMatchSnapshot();

        unmount();
        expect(mockMarker.remove).toHaveBeenCalled();
    });
});
