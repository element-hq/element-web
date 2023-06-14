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

import React from "react";
import { Beacon } from "matrix-js-sdk/src/matrix";

import { Icon as CloseIcon } from "../../../../res/img/image-view/close.svg";
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
                <Heading size="h4">{_t("View List")}</Heading>
                <AccessibleButton
                    className="mx_DialogSidebar_closeButton"
                    onClick={requestClose}
                    title={_t("Close sidebar")}
                    data-testid="dialog-sidebar-close"
                >
                    <CloseIcon className="mx_DialogSidebar_closeButtonIcon" />
                </AccessibleButton>
            </div>
            {beacons?.length ? (
                <ol className="mx_DialogSidebar_list">
                    {beacons.map((beacon) => (
                        <BeaconListItem key={beacon.identifier} beacon={beacon} onClick={() => onBeaconClick(beacon)} />
                    ))}
                </ol>
            ) : (
                <div className="mx_DialogSidebar_noResults">{_t("No live locations")}</div>
            )}
        </div>
    );
};

export default DialogSidebar;
