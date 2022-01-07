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
import Field from "../elements/Field";
import DialogButtons from "../elements/DialogButtons";
import Dropdown from "../elements/Dropdown";
import LocationShareType from "./LocationShareType";
import { _t } from '../../../languageHandler';
import { replaceableComponent } from "../../../utils/replaceableComponent";

interface IDropdownProps {
    value: LocationShareType;
    label: string;
    width?: number;
    onChange(type: LocationShareType): void;
}

const LocationShareTypeDropdown = ({
    value,
    label,
    width,
    onChange,
}: IDropdownProps) => {
    const options = [
        <div key={LocationShareType.Custom}>{
            _t("Share custom location")
        }</div>,
        <div key={LocationShareType.OnceOff}>{
            _t("Share my current location as a once off")
        }</div>,
        // <div key={LocationShareType.OneMin}>{
        //     _t("Share my current location for one minute")
        // }</div>,
        // <div key={LocationShareType.FiveMins}>{
        //     _t("Share my current location for five minutes")
        // }</div>,
        // <div key={LocationShareType.ThirtyMins}>{
        //     _t("Share my current location for thirty minutes")
        // }</div>,
        // <div key={LocationShareType.OneHour}>{
        //     _t("Share my current location for one hour")
        // }</div>,
        // <div key={LocationShareType.ThreeHours}>{
        //     _t("Share my current location for three hours")
        // }</div>,
        // <div key={LocationShareType.SixHours}>{
        //     _t("Share my current location for six hours")
        // }</div>,
        // <div key={LocationShareType.OneDay}>{
        //     _t("Share my current location for one day")
        // }</div>,
        // <div key={LocationShareType.Forever}>{
        //     _t("Share my current location until I disable it")
        // }</div>,
    ];

    return <Dropdown
        id="mx_LocationShareTypeDropdown"
        className="mx_LocationShareTypeDropdown"
        onOptionChange={(key: string) => {
            onChange(LocationShareType[LocationShareType[parseInt(key)]]);
        }}
        menuWidth={width}
        label={label}
        value={value.toString()}
    >
        { options }
    </Dropdown>;
};

interface IProps {
    onChoose(
        uri: string,
        ts: number,
        type: LocationShareType,
        description: string,
    ): boolean;
    onFinished(ev?: SyntheticEvent): void;
}

interface IState {
    description: string;
    type: LocationShareType;
    position?: GeolocationPosition;
    manualPosition?: GeolocationPosition;
    error: Error;
}

@replaceableComponent("views.location.LocationPicker")
class LocationPicker extends React.Component<IProps, IState> {
    private map: maplibregl.Map;
    private marker: maplibregl.Marker;
    private geolocate: maplibregl.GeolocateControl;

    constructor(props: IProps) {
        super(props);

        this.state = {
            description: _t("My location"),
            type: LocationShareType.OnceOff,
            position: undefined,
            manualPosition: undefined,
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

            this.map.on('click', (e) => {
                this.addMarker(e.lngLat);
                this.storeManualPosition(e.lngLat);
                this.setState({ type: LocationShareType.Custom });
            });

            this.geolocate.on('geolocate', this.onGeolocate);
        } catch (e) {
            logger.error("Failed to render map", e.error);
            this.setState({ error: e.error });
        }
    }

    private addMarker(lngLat: maplibregl.LngLat): void {
        if (this.marker) return;
        this.marker = new maplibregl.Marker({
            draggable: true,
        })
            .setLngLat(lngLat)
            .addTo(this.map)
            .on('dragend', () => {
                this.storeManualPosition(this.marker.getLngLat());
            });
    }

    private removeMarker(): void {
        if (!this.marker) return;
        this.marker.remove();
        this.marker = undefined;
    }

    private storeManualPosition(lngLat: maplibregl.LngLat): void {
        const manualPosition: GeolocationPosition = {
            coords: {
                longitude: lngLat.lng,
                latitude: lngLat.lat,
                altitude: undefined,
                accuracy: undefined,
                altitudeAccuracy: undefined,
                heading: undefined,
                speed: undefined,
            },
            timestamp: Date.now(),
        };
        this.setState({ manualPosition });
    }

    componentWillUnmount() {
        this.geolocate?.off('geolocate', this.onGeolocate);
    }

    private onGeolocate = (position: GeolocationPosition) => {
        this.setState({ position });
    };

    private onDescriptionChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ description: ev.target.value });
    };

    private onOk = () => {
        const position = (this.state.type == LocationShareType.Custom) ?
            this.state.manualPosition : this.state.position;

        this.props.onChoose(
            position ? getGeoUri(position) : undefined,
            position ? position.timestamp : undefined,
            this.state.type,
            this.state.description,
        );
        this.props.onFinished();
    };

    private onTypeChange= (type: LocationShareType) => {
        if (type == LocationShareType.Custom) {
            if (!this.state.manualPosition) {
                this.setState({ manualPosition: this.state.position });
            }
            if (this.state.manualPosition) {
                this.addMarker(new maplibregl.LngLat(
                    this.state.manualPosition?.coords.longitude,
                    this.state.manualPosition?.coords.latitude,
                ));
            }
        } else {
            this.removeMarker();
        }

        this.setState({ type });
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
                        <LocationShareTypeDropdown
                            value={this.state.type}
                            label={_t("Type of location share")}
                            onChange={this.onTypeChange}
                            width={400}
                        />

                        <Field
                            label={_t('Description')}
                            onChange={this.onDescriptionChange}
                            value={this.state.description}
                            width={400}
                            className="mx_LocationPicker_description"
                        />

                        <DialogButtons primaryButton={_t('Share')}
                            onPrimaryButtonClick={this.onOk}
                            onCancel={this.props.onFinished}
                            primaryDisabled={
                                !this.state.position &&
                                !this.state.manualPosition
                            } />
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
