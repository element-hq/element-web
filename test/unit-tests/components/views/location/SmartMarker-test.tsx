/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { mocked } from "jest-mock";
import * as maplibregl from "maplibre-gl";

import SmartMarker from "../../../../../src/components/views/location/SmartMarker";

jest.mock("../../../../../src/utils/location/findMapStyleUrl", () => ({
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
