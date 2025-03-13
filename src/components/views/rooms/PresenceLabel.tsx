/*
Copyright 2024 New Vector Ltd.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { UnstableValue } from "matrix-js-sdk/src/NamespacedValue";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { formatDuration } from "../../../DateUtils";

export const BUSY_PRESENCE_NAME = new UnstableValue("busy", "org.matrix.msc3026.busy");

interface IProps {
    // number of milliseconds ago this user was last active.
    // zero = unknown
    activeAgo?: number;
    // if true, activeAgo is an approximation and "Now" should
    // be shown instead
    currentlyActive?: boolean;
    // offline, online, etc
    presenceState?: string;
    // whether to apply colouring to the label
    coloured?: boolean;
    className?: string;
}

export default class PresenceLabel extends React.Component<IProps> {
    public static defaultProps = {
        activeAgo: -1,
    };

    private getPrettyPresence(presence?: string, activeAgo?: number, currentlyActive?: boolean): string {
        // for busy presence, we ignore the 'currentlyActive' flag: they're busy whether
        // they're active or not. It can be set while the user is active in which case
        // the 'active ago' ends up being 0.
        if (presence && BUSY_PRESENCE_NAME.matches(presence)) return _t("presence|busy");

        if (presence === "io.element.unreachable") return _t("presence|unreachable");

        if (!currentlyActive && activeAgo !== undefined && activeAgo > 0) {
            const duration = formatDuration(activeAgo);
            if (presence === "online") return _t("presence|online_for", { duration: duration });
            if (presence === "unavailable") return _t("presence|idle_for", { duration: duration }); // XXX: is this actually right?
            if (presence === "offline") return _t("presence|offline_for", { duration: duration });
            return _t("presence|unknown_for", { duration: duration });
        } else {
            if (presence === "online") return _t("presence|online");
            if (presence === "unavailable") return _t("presence|idle"); // XXX: is this actually right?
            if (presence === "offline") return _t("presence|offline");
            return _t("presence|unknown");
        }
    }

    public render(): React.ReactNode {
        return (
            <div
                className={classNames("mx_PresenceLabel", this.props.className, {
                    mx_PresenceLabel_online: this.props.coloured && this.props.presenceState === "online",
                })}
            >
                {this.getPrettyPresence(this.props.presenceState, this.props.activeAgo, this.props.currentlyActive)}
            </div>
        );
    }
}
