/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { SyntheticEvent } from 'react';
import maplibregl from 'maplibre-gl';
import { logger } from "matrix-js-sdk/src/logger";

import SdkConfig from '../../../SdkConfig';
import DialogButtons from "../elements/DialogButtons";
import { _t } from '../../../languageHandler';
import { replaceableComponent } from "../../../utils/replaceableComponent";

interface IProps {
    onChoose(uri: string, ts: number): boolean;
    onFinished(ev?: SyntheticEvent): void;
}

interface IState {
    position?: GeolocationPosition;
    error: Error;
}

/*
 * An older version of this file allowed manually picking a location on
 * the map to share, instead of sharing your current location.
 * Since the current designs do not cover this case, it was removed from
 * the code but you should be able to find it in the git history by
 * searching for the commit that remove manualPosition from this file.
 */

@replaceableComponent("views.location.LocationPicker")
class LocationPicker extends React.Component<IProps, IState> {
    private map: maplibregl.Map;
    private geolocate: maplibregl.GeolocateControl;

    constructor(props: IProps) {
        super(props);

        this.state = {
            position: undefined,
            error: undefined,
        };
    }

    componentDidMount() {
        const config = SdkConfig.get();
        this.map = new maplibregl.Map({
            container: 'mx_LocationPicker_map',
            style: config.map_style_url,
            center: [0, 0],
            zoom: 1,
        });

        try {
            // Add geolocate control to the map.
            this.geolocate = new maplibregl.GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true,
                },
                trackUserLocation: true,
            });
            this.map.addControl(this.geolocate);

            this.map.on('error', (e) => {
                logger.error(
                    "Failed to load map: check map_style_url in config.json "
                        + "has a valid URL and API key",
                    e.error,
                );
                this.setState({ error: e.error });
            });

            this.map.on('load', () => {
                this.geolocate.trigger();
            });

            this.geolocate.on('geolocate', this.onGeolocate);
        } catch (e) {
            logger.error("Failed to render map", e.error);
            this.setState({ error: e.error });
        }
    }

    componentWillUnmount() {
        this.geolocate?.off('geolocate', this.onGeolocate);
    }

    private onGeolocate = (position: GeolocationPosition) => {
        this.setState({ position });
    };

    private onOk = () => {
        const position = this.state.position;

        this.props.onChoose(
            position ? getGeoUri(position) : undefined,
            position ? position.timestamp : undefined,
        );
        this.props.onFinished();
    };

    render() {
        const error = this.state.error ?
            <div className="mx_LocationPicker_error">
                { _t("Failed to load map") }
            </div> : null;

        return (
            <div className="mx_LocationPicker">
                <div id="mx_LocationPicker_map" />
                { error }
                <div className="mx_LocationPicker_footer">
                    <form onSubmit={this.onOk}>
                        <DialogButtons primaryButton={_t('Share')}
                            onPrimaryButtonClick={this.onOk}
                            onCancel={this.props.onFinished}
                            primaryDisabled={!this.state.position} />
                    </form>
                </div>
            </div>
        );
    }
}

export function getGeoUri(position: GeolocationPosition): string {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const alt = (
        Number.isFinite(position.coords.altitude)
            ? `,${position.coords.altitude}`
            : ""
    );
    const acc = (
        Number.isFinite(position.coords.accuracy)
            ? `;u=${ position.coords.accuracy }`
            : ""
    );
    return `geo:${lat},${lon}${alt}${acc}`;
}

export default LocationPicker;
