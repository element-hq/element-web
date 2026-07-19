/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import type ResizeNotifier from "../../utils/ResizeNotifier";
import { type SpaceKey, UPDATE_SELECTED_SPACE } from "../../stores/spaces";
import { RoomListPanel } from "../views/rooms/RoomListPanel";
import { SDKContext } from "../../contexts/SDKContext.ts";

interface IProps {
    isMinimized: boolean;
    resizeNotifier: ResizeNotifier;
}

interface IState {
    activeSpace: SpaceKey;
}

export default class LeftPanel extends React.Component<IProps, IState> {
    public static contextType = SDKContext;
    declare public context: React.ContextType<typeof SDKContext>;

    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props, context);

        this.state = {
            activeSpace: context.spaceStore.activeSpace,
        };
    }

    public componentDidMount(): void {
        this.context.spaceStore.on(UPDATE_SELECTED_SPACE, this.updateActiveSpace);
    }

    public componentWillUnmount(): void {
        this.context.spaceStore.off(UPDATE_SELECTED_SPACE, this.updateActiveSpace);
    }

    private updateActiveSpace = (activeSpace: SpaceKey): void => {
        this.setState({ activeSpace });
    };

    public render(): React.ReactNode {
        const containerClasses = classNames({
            mx_LeftPanel: true,
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
