/*
Copyright 2015 - 2023 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import { Room } from "matrix-js-sdk/src/matrix";

import AppsDrawer from "./AppsDrawer";
import SettingsStore from "../../../settings/SettingsStore";
import AutoHideScrollbar from "../../structures/AutoHideScrollbar";
import { UIFeature } from "../../../settings/UIFeature";
import ResizeNotifier from "../../../utils/ResizeNotifier";
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
            <AutoHideScrollbar className="mx_AuxPanel">
                {this.props.children}
                {appsDrawer}
                {callView}
            </AutoHideScrollbar>
        );
    }
}
