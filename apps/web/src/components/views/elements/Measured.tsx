/*
Copyright (C) 2026 Element Creations Ltd
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useEffect, useRef, type RefObject } from "react";

import UIStore, { UI_EVENTS } from "../../../stores/UIStore";

interface IProps {
    sensor: RefObject<Element | null>;
    breakpoint: number;
    onMeasurement: (narrow: boolean) => void;
}

let instanceCount = 0;

export default function Measured({ sensor, breakpoint = 500, onMeasurement }: IProps): null {
    const instanceIdRef = useRef(instanceCount++);
    const instanceId = instanceIdRef.current;

    const onResize = useCallback(
        (type: UI_EVENTS, entry: ResizeObserverEntry): void => {
            if (type !== UI_EVENTS.Resize) return;
            onMeasurement(entry.contentRect.width <= breakpoint);
        },
        [onMeasurement, breakpoint],
    );

    useEffect(() => {
        UIStore.instance.on(`Measured${instanceId}`, onResize);
        return () => {
            UIStore.instance.off(`Measured${instanceId}`, onResize);
        };
    }, [instanceId, onResize]);

    useEffect(() => {
        if (sensor.current) {
            UIStore.instance.trackElementDimensions(`Measured${instanceId}`, sensor.current);
        }

        return () => {
            UIStore.instance.stopTrackingElementDimensions(`Measured${instanceId}`);
        };
    }, [sensor, instanceId]);

    return null;
}
