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

import React, { useEffect, useState } from "react";
import { BeaconLocationState } from "matrix-js-sdk/src/content-helpers";

import { Icon as ExternalLinkIcon } from "../../../../res/img/external-link.svg";
import { _t } from "../../../languageHandler";
import { makeMapSiteLink, parseGeoUri } from "../../../utils/location";
import CopyableText from "../elements/CopyableText";
import TooltipTarget from "../elements/TooltipTarget";

interface Props {
    latestLocationState?: BeaconLocationState;
}

const ShareLatestLocation: React.FC<Props> = ({ latestLocationState }) => {
    const [coords, setCoords] = useState<GeolocationCoordinates | undefined>();
    useEffect(() => {
        if (!latestLocationState?.uri) {
            return;
        }
        const coords = parseGeoUri(latestLocationState.uri);
        setCoords(coords);
    }, [latestLocationState]);

    if (!latestLocationState || !coords) {
        return null;
    }

    const latLonString = `${coords.latitude},${coords.longitude}`;
    const mapLink = makeMapSiteLink(coords);

    return (
        <>
            <TooltipTarget label={_t("Open in OpenStreetMap")}>
                <a data-testid="open-location-in-osm" href={mapLink} target="_blank" rel="noreferrer noopener">
                    <ExternalLinkIcon className="mx_ShareLatestLocation_icon" />
                </a>
            </TooltipTarget>
            <CopyableText className="mx_ShareLatestLocation_copy" border={false} getTextToCopy={() => latLonString} />
        </>
    );
};

export default ShareLatestLocation;
