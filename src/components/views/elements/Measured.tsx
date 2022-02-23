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

import UIStore, { UI_EVENTS } from "../../../stores/UIStore";

interface IProps {
    sensor: Element;
    breakpoint: number;
    onMeasurement(narrow: boolean): void;
}

export default class Measured extends React.PureComponent<IProps> {
    private static instanceCount = 0;
    private readonly instanceId: number;

    static defaultProps = {
        breakpoint: 500,
    };

    constructor(props) {
        super(props);

        this.instanceId = Measured.instanceCount++;
    }

    componentDidMount() {
        UIStore.instance.on(`Measured${this.instanceId}`, this.onResize);
    }

    componentDidUpdate(prevProps: Readonly<IProps>) {
        const previous = prevProps.sensor;
        const current = this.props.sensor;
        if (previous === current) return;
        if (previous) {
            UIStore.instance.stopTrackingElementDimensions(`Measured${this.instanceId}`);
        }
        if (current) {
            UIStore.instance.trackElementDimensions(`Measured${this.instanceId}`,
                this.props.sensor);
        }
    }

    componentWillUnmount() {
        UIStore.instance.off(`Measured${this.instanceId}`, this.onResize);
        UIStore.instance.stopTrackingElementDimensions(`Measured${this.instanceId}`);
    }

    private onResize = (type: UI_EVENTS, entry: ResizeObserverEntry) => {
        if (type !== UI_EVENTS.Resize) return;
        this.props.onMeasurement(entry.contentRect.width <= this.props.breakpoint);
    };

    render() {
        return null;
    }
}
