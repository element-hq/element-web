/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent, type MatrixClient } from "matrix-js-sdk/src/matrix";

import BaseDialog from "../dialogs/BaseDialog";
import { locationEventGeoUri, isSelfLocation } from "../../../utils/location";
import Map from "./Map";
import SmartMarker from "./SmartMarker";
import ZoomButtons from "./ZoomButtons";

interface IProps {
    matrixClient: MatrixClient;
    mxEvent: MatrixEvent;
    onFinished(): void;
}

interface IState {
    error?: Error;
}

/**
 * Dialog to view m.location events maximised
 */
export default class LocationViewDialog extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            error: undefined,
        };
    }

    private getBodyId = (): string => {
        return `mx_LocationViewDialog_${this.props.mxEvent.getId()}`;
    };

    private onError = (error: Error): void => {
        this.setState({ error });
    };

    public render(): React.ReactNode {
        const { mxEvent } = this.props;

        // only pass member to marker when should render avatar marker
        const markerRoomMember = (isSelfLocation(mxEvent.getContent()) && mxEvent.sender) || undefined;
        const geoUri = locationEventGeoUri(mxEvent);
        return (
            <BaseDialog className="mx_LocationViewDialog" onFinished={this.props.onFinished} fixedWidth={false}>
                <Map
                    id={this.getBodyId()}
                    centerGeoUri={geoUri}
                    onError={this.onError}
                    interactive
                    className="mx_LocationViewDialog_map"
                    allowGeolocate
                >
                    {({ map }) => (
                        <>
                            <SmartMarker
                                map={map}
                                id={`${this.getBodyId()}-marker`}
                                geoUri={geoUri}
                                roomMember={markerRoomMember}
                            />
                            <ZoomButtons map={map} />
                        </>
                    )}
                </Map>
            </BaseDialog>
        );
    }
}
