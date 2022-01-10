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

import { replaceableComponent } from "../../../utils/replaceableComponent";
import BaseDialog from "../dialogs/BaseDialog";
import { IDialogProps } from "../dialogs/IDialogProps";
import { createMap, LocationBodyContent, locationEventGeoUri, parseGeoUri } from '../messages/MLocationBody';

interface IProps extends IDialogProps {
    mxEvent: MatrixEvent;
}

interface IState {
    error: Error;
}

@replaceableComponent("views.location.LocationViewDialog")
export default class LocationViewDialog extends React.Component<IProps, IState> {
    private coords: GeolocationCoordinates;
    private map?: maplibregl.Map;

    constructor(props: IProps) {
        super(props);

        this.coords = parseGeoUri(locationEventGeoUri(this.props.mxEvent));
        this.map = null;
        this.state = {
            error: undefined,
        };
    }

    componentDidMount() {
        if (this.state.error) {
            return;
        }

        this.map = createMap(
            this.coords,
            true,
            this.getBodyId(),
            this.getMarkerId(),
            (e: Error) => this.setState({ error: e }),
        );
    }

    private getBodyId = () => {
        return `mx_LocationViewDialog_${this.props.mxEvent.getId()}`;
    };

    private getMarkerId = () => {
        return `mx_MLocationViewDialog_marker_${this.props.mxEvent.getId()}`;
    };

    private onZoomIn = () => {
        this.map?.zoomIn();
    };

    private onZoomOut = () => {
        this.map?.zoomOut();
    };

    render() {
        return (
            <BaseDialog
                className='mx_LocationViewDialog'
                onFinished={this.props.onFinished}
                fixedWidth={false}
            >
                <LocationBodyContent
                    mxEvent={this.props.mxEvent}
                    bodyId={this.getBodyId()}
                    markerId={this.getMarkerId()}
                    error={this.state.error}
                    zoomButtons={true}
                    onZoomIn={this.onZoomIn}
                    onZoomOut={this.onZoomOut}
                />
            </BaseDialog>
        );
    }
}
