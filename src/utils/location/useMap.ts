/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";

import type { Map as MapLibreMap } from "maplibre-gl";
import { createMap } from "./map";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";

interface UseMapProps {
    bodyId: string;
    onError?: (error: Error) => void;
    interactive?: boolean;
}

/**
 * Create a map instance
 * Add listeners for errors
 * Make sure `onError` has a stable reference
 * As map is recreated on changes to it
 */
export const useMap = ({ interactive, bodyId, onError }: UseMapProps): MapLibreMap | undefined => {
    const cli = useMatrixClientContext();
    const [map, setMap] = useState<MapLibreMap>();

    useEffect(
        () => {
            let map: MapLibreMap | undefined;
            try {
                map = createMap(cli, !!interactive, bodyId, onError);
                setMap(map);
            } catch (error) {
                console.error("Error encountered in useMap", error);
                if (error instanceof Error) {
                    onError?.(error);
                }
            }
            return () => {
                if (map) {
                    map.remove();
                    setMap(undefined);
                }
            };
        },
        // map is excluded as a dependency
        [cli, interactive, bodyId, onError],
    );

    return map;
};
