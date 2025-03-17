/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import AppsDrawer from "./AppsDrawer";
import SettingsStore from "../../../settings/SettingsStore";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import { UIFeature } from "../../../settings/UIFeature";
import type ResizeNotifier from "../../../utils/ResizeNotifier";
import LegacyCallViewForRoom from "../voip/LegacyCallViewForRoom";
import { objectHasDiff } from "../../../utils/objects";

interface IProps {
    // js-sdk room object
    room: Room;
    userId: string;
    showApps: boolean; // Render apps
    resizeNotifier: ResizeNotifier;
    children?: ReactNode;
}

export default class AuxPanel extends React.Component<IProps> {
    public static defaultProps = {
        showApps: true,
    };

    public shouldComponentUpdate(nextProps: IProps): boolean {
        return objectHasDiff(this.props, nextProps);
    }

    public render(): React.ReactNode {
        const callView = (
            <LegacyCallViewForRoom
                roomId={this.props.room.roomId}
                resizeNotifier={this.props.resizeNotifier}
                showApps={this.props.showApps}
            />
        );

        let appsDrawer;
        if (SettingsStore.getValue(UIFeature.Widgets)) {
            appsDrawer = (
                <AppsDrawer
                    room={this.props.room}
                    userId={this.props.userId}
                    showApps={this.props.showApps}
                    resizeNotifier={this.props.resizeNotifier}
                />
            );
        }

        return (
            <AutoHideScrollbar role="region" className="mx_AuxPanel">
                {this.props.children}
                {appsDrawer}
                {callView}
            </AutoHideScrollbar>
        );
    }
}
