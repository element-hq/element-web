/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import SpaceStore from "../../stores/spaces/SpaceStore";
import { type SpaceKey, UPDATE_SELECTED_SPACE } from "../../stores/spaces";
import { BreadcrumbsStore } from "../../stores/BreadcrumbsStore";
import type PageType from "../../PageTypes";
import { RoomListPanel } from "../views/rooms/RoomListPanel";

interface IProps {
    isMinimized: boolean;
    pageType: PageType;
    resizeNotifier: ResizeNotifier;
}

enum BreadcrumbsMode {
    Disabled,
    Legacy,
}

interface IState {
    showBreadcrumbs: BreadcrumbsMode;
    activeSpace: SpaceKey;
    supportsPstnProtocol: boolean;
}

export default class LeftPanel extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            activeSpace: SpaceStore.instance.activeSpace,
            showBreadcrumbs: LeftPanel.breadcrumbsMode,
            supportsPstnProtocol: LegacyCallHandler.instance.getSupportsPstnProtocol(),
        };
    }

    private static get breadcrumbsMode(): BreadcrumbsMode {
        return !BreadcrumbsStore.instance.visible ? BreadcrumbsMode.Disabled : BreadcrumbsMode.Legacy;
    }

    public componentDidMount(): void {
        SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.updateActiveSpace);
        LegacyCallHandler.instance.on(LegacyCallHandlerEvent.ProtocolSupport, this.updateProtocolSupport);
    }

    public componentWillUnmount(): void {
        SpaceStore.instance.off(UPDATE_SELECTED_SPACE, this.updateActiveSpace);
        LegacyCallHandler.instance.off(LegacyCallHandlerEvent.ProtocolSupport, this.updateProtocolSupport);
    }

    private updateProtocolSupport = (): void => {
        this.setState({ supportsPstnProtocol: LegacyCallHandler.instance.getSupportsPstnProtocol() });
    };

    private updateActiveSpace = (activeSpace: SpaceKey): void => {
        this.setState({ activeSpace });
    };

    public render(): React.ReactNode {
        const containerClasses = classNames({
            mx_LeftPanel: true,
            mx_LeftPanel_newRoomList: true,
            mx_LeftPanel_minimized: this.props.isMinimized,
        });

        return (
            <div className={containerClasses}>
                <div className="mx_LeftPanel_roomListContainer">
                    <RoomListPanel activeSpace={this.state.activeSpace} />
                </div>
            </div>
        );
    }
}
