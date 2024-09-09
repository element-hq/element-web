/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import dis from "../../../dispatcher/dispatcher";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { NotificationLevel } from "../../../stores/notifications/NotificationLevel";
import SettingsStore from "../../../settings/SettingsStore";

export enum HeaderKind {
    Room = "room",
}

interface IState {
    headerKind: HeaderKind;
    phase: RightPanelPhases | null;
    threadNotificationLevel: NotificationLevel;
    globalNotificationLevel: NotificationLevel;
    notificationsEnabled?: boolean;
}

interface IProps {}

export default abstract class HeaderButtons<P = {}> extends React.Component<IProps & P, IState> {
    private unmounted = false;
    private dispatcherRef?: string = undefined;
    private readonly watcherRef: string;

    public constructor(props: IProps & P, kind: HeaderKind) {
        super(props);

        const rps = RightPanelStore.instance;
        this.state = {
            headerKind: kind,
            phase: rps.currentCard.phase,
            threadNotificationLevel: NotificationLevel.None,
            globalNotificationLevel: NotificationLevel.None,
            notificationsEnabled: SettingsStore.getValue("feature_notifications"),
        };
        this.watcherRef = SettingsStore.watchSetting("feature_notifications", null, (...[, , , value]) =>
            this.setState({ notificationsEnabled: value }),
        );
    }

    public componentDidMount(): void {
        RightPanelStore.instance.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        RightPanelStore.instance.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        if (this.dispatcherRef) dis.unregister(this.dispatcherRef);
        if (this.watcherRef) SettingsStore.unwatchSetting(this.watcherRef);
    }

    public isPhase(phases: string | string[]): boolean {
        if (!RightPanelStore.instance.isOpen) return false;
        if (Array.isArray(phases)) {
            return !!this.state.phase && phases.includes(this.state.phase);
        } else {
            return phases === this.state.phase;
        }
    }

    private onRightPanelStoreUpdate = (): void => {
        if (this.unmounted) return;
        this.setState({ phase: RightPanelStore.instance.currentCard.phase });
    };

    // XXX: Make renderButtons a prop
    public abstract renderButtons(): JSX.Element;

    public render(): React.ReactNode {
        return this.renderButtons();
    }
}
