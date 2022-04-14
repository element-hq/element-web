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
import { MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { MatrixClient } from 'matrix-js-sdk/src/client';

import BaseDialog from "../dialogs/BaseDialog";
import { IDialogProps } from "../dialogs/IDialogProps";
import { locationEventGeoUri, isSelfLocation } from '../../../utils/location';
import Map from './Map';
import SmartMarker from './SmartMarker';
import ZoomButtons from './ZoomButtons';

interface IProps extends IDialogProps {
    matrixClient: MatrixClient;
    mxEvent: MatrixEvent;
}

interface IState {
    error: Error;
}

/**
 * Dialog to view m.location events maximised
 */
export default class LocationViewDialog extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            error: undefined,
        };
    }

    private getBodyId = () => {
        return `mx_LocationViewDialog_${this.props.mxEvent.getId()}`;
    };

    private onError = (error) => {
        this.setState({ error });
    };

    render() {
        const { mxEvent } = this.props;

        // only pass member to marker when should render avatar marker
        const markerRoomMember = isSelfLocation(mxEvent.getContent()) ? mxEvent.sender : undefined;
        const geoUri = locationEventGeoUri(mxEvent);
        return (
            <BaseDialog
                className='mx_LocationViewDialog'
                onFinished={this.props.onFinished}
                fixedWidth={false}
            >
                <Map
                    id={this.getBodyId()}
                    centerGeoUri={geoUri}
                    onError={this.onError}
                    interactive
                    className="mx_LocationViewDialog_map"
                >
                    {
                        ({ map }) =>
                            <>
                                <SmartMarker
                                    map={map}
                                    id={`${this.getBodyId()}-marker`}
                                    geoUri={geoUri}
                                    roomMember={markerRoomMember}
                                />
                                <ZoomButtons map={map} />
                            </>
                    }
                </Map>
            </BaseDialog>
        );
    }
}
