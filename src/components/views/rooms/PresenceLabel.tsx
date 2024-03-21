/*
Copyright 2015, 2016 OpenMarket Ltd

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
import { UnstableValue } from "matrix-js-sdk/src/NamespacedValue";

import { _t } from "../../../languageHandler";
import { formatDuration } from "../../../DateUtils";

const BUSY_PRESENCE_NAME = new UnstableValue("busy", "org.matrix.msc3026.busy");

interface IProps {
    // number of milliseconds ago this user was last active.
    // zero = unknown
    activeAgo?: number;
    // if true, activeAgo is an approximation and "Now" should
    // be shown instead
    currentlyActive?: boolean;
    // offline, online, etc
    presenceState?: string;
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
            <div className="mx_PresenceLabel">
                {this.getPrettyPresence(this.props.presenceState, this.props.activeAgo, this.props.currentlyActive)}
            </div>
        );
    }
}
