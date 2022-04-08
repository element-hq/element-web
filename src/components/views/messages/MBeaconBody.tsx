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

import React from 'react';
import { Beacon, getBeaconInfoIdentifier } from 'matrix-js-sdk/src/matrix';

import MatrixClientContext from '../../../contexts/MatrixClientContext';
import { IBodyProps } from "./IBodyProps";

export default class MLocationBody extends React.Component<IBodyProps> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;
    private beacon: Beacon | undefined;
    private roomId: string;
    private beaconIdentifier: string;

    constructor(props: IBodyProps) {
        super(props);

        this.roomId = props.mxEvent.getRoomId();

        this.beaconIdentifier = getBeaconInfoIdentifier(props.mxEvent);
    }

    componentDidMount() {
        const roomState = this.context.getRoom(this.roomId)?.currentState;

        const beacon = roomState?.beacons.get(this.beaconIdentifier);

        this.beacon = beacon;
    }

    render(): React.ReactElement<HTMLDivElement> {
        if (!this.beacon) {
            // TODO loading and error states
            return null;
        }
        // TODO everything else :~)
        const description = this.beacon.beaconInfo.description;
        return <div>{ description }</div>;
    }
}
