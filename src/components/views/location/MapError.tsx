/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import { Icon as WarningBadge } from "../../../../res/img/element-icons/warning-badge.svg";
import { _t } from "../../../languageHandler";
import { getLocationShareErrorMessage, LocationShareError } from "../../../utils/location";
import AccessibleButton from "../elements/AccessibleButton";
import Heading from "../typography/Heading";

export interface MapErrorProps {
    error: LocationShareError;
    onFinished?: () => void;
    isMinimised?: boolean;
    className?: string;
    onClick?: () => void;
}

export const MapError: React.FC<MapErrorProps> = ({ error, isMinimised, className, onFinished, onClick }) => (
    <div
        data-testid="map-rendering-error"
        className={classNames("mx_MapError", className, { mx_MapError_isMinimised: isMinimised })}
        onClick={onClick}
    >
        <WarningBadge className="mx_MapError_icon" />
        <Heading className="mx_MapError_heading" size="3">
            {_t("location_sharing|failed_load_map")}
        </Heading>
        <p className="mx_MapError_message">{getLocationShareErrorMessage(error)}</p>
        {onFinished && (
            <AccessibleButton element="button" kind="primary" onClick={onFinished}>
                {_t("action|ok")}
            </AccessibleButton>
        )}
    </div>
);
