/*
Copyright (C) 2026 Element Creations Ltd
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useRef, type RefObject } from "react";

import UIStore from "../../../stores/UIStore";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";

interface IProps {
    /**
     * Element to watch for resize changes on.
     */
    sensor: RefObject<Element | null>;
    /**
     * Minimum width of element to be considered full-size.
     * Defaults to `500px`
     */
    breakpoint?: number;
    /**
     * Callback for when the narrowness property changes.
     * @param narrow
     * @returns
     */
    onMeasurement: (narrow: boolean) => void;
}

let instanceCount = 0;

/**
 * This component can watch a single element for width changes, and will fire
 * a callback if the width changes to be lower or higher than the `breakpoint`.
 */
export default function Measured({ sensor, breakpoint = 500, onMeasurement }: IProps): null {
    const instanceIdRef = useRef(instanceCount++);
    const instanceId = instanceIdRef.current;

    useEffect(() => {
        if (sensor.current) {
            UIStore.instance.trackElementDimensions(`Measured${instanceId}`, sensor.current);
        }

        return () => {
            UIStore.instance.stopTrackingElementDimensions(`Measured${instanceId}`);
        };
    }, [sensor, instanceId]);

    const narrow = useEventEmitterState<boolean>(
        UIStore.instance,
        `Measured${instanceId}`,
        (_type: unknown, entry: ResizeObserverEntry) => {
            if (!entry) {
                return false;
            }
            // N.B there is only one `_type` of resize event.
            return entry.contentRect.width <= breakpoint;
        },
    );

    // Only fire when the state changes.
    useEffect(() => {
        onMeasurement(narrow);
    }, [onMeasurement, narrow]);

    return null;
}
