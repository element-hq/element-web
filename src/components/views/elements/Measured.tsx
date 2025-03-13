/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type RefObject } from "react";

import UIStore, { UI_EVENTS } from "../../../stores/UIStore";

interface IProps {
    sensor: RefObject<Element>;
    breakpoint: number;
    onMeasurement(narrow: boolean): void;
}

export default class Measured extends React.PureComponent<IProps> {
    private static instanceCount = 0;
    private readonly instanceId: number;

    public static defaultProps = {
        breakpoint: 500,
    };

    public constructor(props: IProps) {
        super(props);

        this.instanceId = Measured.instanceCount++;
    }

    public componentDidMount(): void {
        UIStore.instance.on(`Measured${this.instanceId}`, this.onResize);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        const previous = prevProps.sensor.current;
        const current = this.props.sensor.current;
        if (previous === current) return;
        if (previous) {
            UIStore.instance.stopTrackingElementDimensions(`Measured${this.instanceId}`);
        }
        if (current) {
            UIStore.instance.trackElementDimensions(`Measured${this.instanceId}`, this.props.sensor.current);
        }
    }

    public componentWillUnmount(): void {
        UIStore.instance.off(`Measured${this.instanceId}`, this.onResize);
        UIStore.instance.stopTrackingElementDimensions(`Measured${this.instanceId}`);
    }

    private onResize = (type: UI_EVENTS, entry: ResizeObserverEntry): void => {
        if (type !== UI_EVENTS.Resize) return;
        this.props.onMeasurement(entry.contentRect.width <= this.props.breakpoint);
    };

    public render(): React.ReactNode {
        return null;
    }
}
