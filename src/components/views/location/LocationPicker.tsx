/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type SyntheticEvent } from "react";
import maplibregl, { type MapMouseEvent } from "maplibre-gl";
import { logger } from "matrix-js-sdk/src/logger";
import { type RoomMember, ClientEvent, type IClientWellKnown } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import Modal from "../../../Modal";
import { tileServerFromWellKnown } from "../../../utils/WellKnownUtils";
import { type GenericPosition, genericPositionFromGeolocation, getGeoUri } from "../../../utils/beacon";
import { LocationShareError, findMapStyleUrl, positionFailureMessage } from "../../../utils/location";
import ErrorDialog from "../dialogs/ErrorDialog";
import AccessibleButton from "../elements/AccessibleButton";
import { MapError } from "./MapError";
import LiveDurationDropdown, { DEFAULT_DURATION_MS } from "./LiveDurationDropdown";
import { LocationShareType, type ShareLocationFn } from "./shareLocation";
import Marker from "./Marker";

export interface ILocationPickerProps {
    sender: RoomMember;
    shareType: LocationShareType;
    onChoose: ShareLocationFn;
    onFinished(ev?: SyntheticEvent): void;
}

interface IState {
    timeout: number;
    position?: GenericPosition;
    error?: LocationShareError;
}

const isSharingOwnLocation = (shareType: LocationShareType): boolean =>
    shareType === LocationShareType.Own || shareType === LocationShareType.Live;

class LocationPicker extends React.Component<ILocationPickerProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;
    private map?: maplibregl.Map;
    private geolocate?: maplibregl.GeolocateControl;
    private marker?: maplibregl.Marker;

    public constructor(props: ILocationPickerProps) {
        super(props);

        this.state = {
            position: undefined,
            timeout: DEFAULT_DURATION_MS,
            error: undefined,
        };
    }

    private getMarkerId = (): string => {
        return "mx_MLocationPicker_marker";
    };

    public componentDidMount(): void {
        this.context.on(ClientEvent.ClientWellKnown, this.updateStyleUrl);

        try {
            this.map = new maplibregl.Map({
                container: "mx_LocationPicker_map",
                style: findMapStyleUrl(this.context),
                center: [0, 0],
                zoom: 1,
            });

            // Add geolocate control to the map.
            this.geolocate = new maplibregl.GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true,
                },
                trackUserLocation: false,
            });

            this.map.addControl(this.geolocate);

            this.map.on("error", (e) => {
                logger.error(
                    "Failed to load map: check map_style_url in config.json has a valid URL and API key",
                    e.error,
                );
                this.setState({ error: LocationShareError.MapStyleUrlNotReachable });
            });

            this.map.on("load", () => {
                this.geolocate?.trigger();
            });

            this.geolocate.on("error", this.onGeolocateError);

            if (isSharingOwnLocation(this.props.shareType)) {
                this.geolocate.on("geolocate", this.onGeolocate);
            }

            if (this.props.shareType === LocationShareType.Pin) {
                const navigationControl = new maplibregl.NavigationControl({
                    showCompass: false,
                    showZoom: true,
                });
                this.map.addControl(navigationControl, "bottom-right");
                this.map.on("click", this.onClick);
            }
        } catch (e) {
            logger.error("Failed to render map", e);
            const errorMessage = (e as Error)?.message;
            let errorType;
            if (errorMessage === LocationShareError.MapStyleUrlNotConfigured)
                errorType = LocationShareError.MapStyleUrlNotConfigured;
            else if (errorMessage.includes("Failed to initialize WebGL"))
                errorType = LocationShareError.WebGLNotEnabled;
            else errorType = LocationShareError.Default;
            this.setState({ error: errorType });
        }
    }

    public componentWillUnmount(): void {
        this.geolocate?.off("error", this.onGeolocateError);
        this.geolocate?.off("geolocate", this.onGeolocate);
        this.map?.off("click", this.onClick);
        this.context.off(ClientEvent.ClientWellKnown, this.updateStyleUrl);
    }

    private addMarkerToMap = (): void => {
        this.marker = new maplibregl.Marker({
            element: document.getElementById(this.getMarkerId()) ?? undefined,
            anchor: "bottom",
            offset: [0, -1],
        })
            .setLngLat(new maplibregl.LngLat(0, 0))
            .addTo(this.map!);
    };

    private updateStyleUrl = (clientWellKnown: IClientWellKnown): void => {
        const style = tileServerFromWellKnown(clientWellKnown)?.["map_style_url"];
        if (style) {
            this.map?.setStyle(style);
        }
    };

    private onGeolocate = (position: GeolocationPosition): void => {
        if (!this.marker) {
            this.addMarkerToMap();
        }
        this.setState({ position: genericPositionFromGeolocation(position) });
        this.marker?.setLngLat(new maplibregl.LngLat(position.coords.longitude, position.coords.latitude));
    };

    private onClick = (event: MapMouseEvent): void => {
        if (!this.marker) {
            this.addMarkerToMap();
        }
        this.marker?.setLngLat(event.lngLat);
        this.setState({
            position: {
                timestamp: Date.now(),
                latitude: event.lngLat.lat,
                longitude: event.lngLat.lng,
            },
        });
    };

    private onGeolocateError = (e: GeolocationPositionError): void => {
        logger.error("Could not fetch location", e);
        // close the dialog and show an error when trying to share own location
        // pin drop location without permissions is ok
        if (isSharingOwnLocation(this.props.shareType)) {
            this.props.onFinished();
            Modal.createDialog(ErrorDialog, {
                title: _t("location_sharing|error_fetch_location"),
                description: positionFailureMessage(e.code),
            });
        }

        if (this.geolocate) {
            this.map?.removeControl(this.geolocate);
        }
    };

    private onTimeoutChange = (timeout: number): void => {
        this.setState({ timeout });
    };

    private onOk = (): void => {
        const { timeout, position } = this.state;

        this.props.onChoose(
            position
                ? { uri: getGeoUri(position), timestamp: position.timestamp, timeout }
                : {
                      timeout,
                  },
        );
        this.props.onFinished();
    };

    public render(): React.ReactNode {
        if (this.state.error) {
            return (
                <div className="mx_LocationPicker mx_LocationPicker_hasError">
                    <MapError error={this.state.error} onFinished={this.props.onFinished} />
                </div>
            );
        }

        return (
            <div className="mx_LocationPicker">
                <div id="mx_LocationPicker_map" />

                {this.props.shareType === LocationShareType.Pin && (
                    <div className="mx_LocationPicker_pinText">
                        <span>
                            {this.state.position
                                ? _t("location_sharing|click_move_pin")
                                : _t("location_sharing|click_drop_pin")}
                        </span>
                    </div>
                )}
                <div className="mx_LocationPicker_footer">
                    <form onSubmit={this.onOk}>
                        {this.props.shareType === LocationShareType.Live && (
                            <LiveDurationDropdown onChange={this.onTimeoutChange} timeout={this.state.timeout} />
                        )}
                        <AccessibleButton
                            data-testid="location-picker-submit-button"
                            type="submit"
                            element="button"
                            kind="primary"
                            className="mx_LocationPicker_submitButton"
                            disabled={!this.state.position}
                            onClick={this.onOk}
                        >
                            {_t("location_sharing|share_button")}
                        </AccessibleButton>
                    </form>
                </div>
                <div id={this.getMarkerId()}>
                    {/*
                    maplibregl hijacks the div above to style the marker
                    it must be in the dom when the map is initialised
                    and keep a consistent class
                    we want to hide the marker until it is set in the case of pin drop
                    so hide the internal visible elements
                    */}

                    {!!this.marker && (
                        <Marker
                            roomMember={isSharingOwnLocation(this.props.shareType) ? this.props.sender : undefined}
                            useMemberColor={this.props.shareType === LocationShareType.Live}
                        />
                    )}
                </div>
            </div>
        );
    }
}

export default LocationPicker;
