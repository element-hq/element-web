/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useState } from "react";
import { type ContentHelpers } from "matrix-js-sdk/src/matrix";
import { Tooltip } from "@vector-im/compound-web";

import { Icon as ExternalLinkIcon } from "../../../../res/img/external-link.svg";
import { _t } from "../../../languageHandler";
import { makeMapSiteLink, parseGeoUri } from "../../../utils/location";
import CopyableText from "../elements/CopyableText";

interface Props {
    latestLocationState?: ContentHelpers.BeaconLocationState;
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
            <Tooltip label={_t("timeline|context_menu|open_in_osm")}>
                <a data-testid="open-location-in-osm" href={mapLink} target="_blank" rel="noreferrer noopener">
                    <ExternalLinkIcon className="mx_ShareLatestLocation_icon" />
                </a>
            </Tooltip>
            <CopyableText className="mx_ShareLatestLocation_copy" border={false} getTextToCopy={() => latLonString} />
        </>
    );
};

export default ShareLatestLocation;
