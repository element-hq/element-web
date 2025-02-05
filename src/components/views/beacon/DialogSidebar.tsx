/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Beacon } from "matrix-js-sdk/src/matrix";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import Heading from "../typography/Heading";
import BeaconListItem from "./BeaconListItem";

interface Props {
    beacons: Beacon[];
    requestClose: () => void;
    onBeaconClick: (beacon: Beacon) => void;
}

const DialogSidebar: React.FC<Props> = ({ beacons, onBeaconClick, requestClose }) => {
    return (
        <div className="mx_DialogSidebar">
            <div className="mx_DialogSidebar_header">
                <Heading size="4">{_t("action|view_list")}</Heading>
                <AccessibleButton
                    className="mx_DialogSidebar_closeButton"
                    onClick={requestClose}
                    title={_t("location_sharing|close_sidebar")}
                    data-testid="dialog-sidebar-close"
                >
                    <CloseIcon className="mx_DialogSidebar_closeButtonIcon" height="24px" width="24px" />
                </AccessibleButton>
            </div>
            {beacons?.length ? (
                <ol className="mx_DialogSidebar_list">
                    {beacons.map((beacon) => (
                        <BeaconListItem key={beacon.identifier} beacon={beacon} onClick={() => onBeaconClick(beacon)} />
                    ))}
                </ol>
            ) : (
                <div className="mx_DialogSidebar_noResults">{_t("location_sharing|live_locations_empty")}</div>
            )}
        </div>
    );
};

export default DialogSidebar;
