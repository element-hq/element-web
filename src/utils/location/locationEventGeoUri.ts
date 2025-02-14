/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, M_LOCATION } from "matrix-js-sdk/src/matrix";

/**
 * Find the geo-URI contained within a location event.
 */
export const locationEventGeoUri = (mxEvent: MatrixEvent): string => {
    // unfortunately we're stuck supporting legacy `content.geo_uri`
    // events until the end of days, or until we figure out mutable
    // events - so folks can read their old chat history correctly.
    // https://github.com/matrix-org/matrix-doc/issues/3516
    const content = mxEvent.getContent();
    const loc = M_LOCATION.findIn(content) as { uri?: string };
    return loc ? loc.uri : content["geo_uri"];
};
