/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import OnlineOrUnavailableIcon from "@vector-im/compound-design-tokens/assets/web/icons/presence-solid-8x8";
import OfflineIcon from "@vector-im/compound-design-tokens/assets/web/icons/presence-outline-8x8";
import DNDIcon from "@vector-im/compound-design-tokens/assets/web/icons/presence-strikethrough-8x8";
import classNames from "classnames";
import { UnstableValue } from "matrix-js-sdk/src/NamespacedValue";

interface Props {
    className?: string;
    presenceState: string;
}

export const BUSY_PRESENCE_NAME = new UnstableValue("busy", "org.matrix.msc3026.busy");

function getIconForPresenceState(state: string): React.JSX.Element {
    switch (state) {
        case "online":
            return <OnlineOrUnavailableIcon height="8px" width="8px" className="mx_PresenceIconView_online" />;
        case "offline":
            return <OfflineIcon height="8px" width="8px" className="mx_PresenceIconView_offline" />;
        case "unavailable":
        case "io.element.unreachable":
            return <OnlineOrUnavailableIcon height="8px" width="8px" className="mx_PresenceIconView_unavailable" />;
        case BUSY_PRESENCE_NAME.name:
        case BUSY_PRESENCE_NAME.altName:
            return <DNDIcon height="8px" width="8px" className="mx_PresenceIconView_dnd" />;
        default:
            throw new Error(`Presence state "${state}" is unknown.`);
    }
}

const AvatarPresenceIconView: React.FC<Props> = ({ className, presenceState }) => {
    const names = classNames("mx_PresenceIconView", className);
    return <div className={names}>{getIconForPresenceState(presenceState)}</div>;
};

export default AvatarPresenceIconView;
