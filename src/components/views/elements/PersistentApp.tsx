/*
Copyright 2018 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import { EventSubscription } from 'fbemitter';
import { Room } from "matrix-js-sdk/src/models/room";

import RoomViewStore from '../../../stores/RoomViewStore';
import ActiveWidgetStore, { ActiveWidgetStoreEvent } from '../../../stores/ActiveWidgetStore';
import WidgetUtils from '../../../utils/WidgetUtils';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import AppTile from "./AppTile";
import { Container, WidgetLayoutStore } from '../../../stores/widgets/WidgetLayoutStore';
import { RightPanelPhases } from '../../../stores/right-panel/RightPanelStorePhases';
import RightPanelStore from '../../../stores/right-panel/RightPanelStore';
import { UPDATE_EVENT } from '../../../stores/AsyncStore';

interface IProps {
    // none
}

interface IState {
    roomId: string;
    persistentWidgetId: string;
    rightPanelPhase?: RightPanelPhases;
}

@replaceableComponent("views.elements.PersistentApp")
export default class PersistentApp extends React.Component<IProps, IState> {
    private roomStoreToken: EventSubscription;

    constructor(props: IProps) {
        super(props);

        this.state = {
            roomId: RoomViewStore.getRoomId(),
            persistentWidgetId: ActiveWidgetStore.instance.getPersistentWidgetId(),
            rightPanelPhase: RightPanelStore.instance.currentCard.phase,
        };
    }

    public componentDidMount(): void {
        this.roomStoreToken = RoomViewStore.addListener(this.onRoomViewStoreUpdate);
        ActiveWidgetStore.instance.on(ActiveWidgetStoreEvent.Update, this.onActiveWidgetStoreUpdate);
        RightPanelStore.instance.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        MatrixClientPeg.get().on("Room.myMembership", this.onMyMembership);
    }

    public componentWillUnmount(): void {
        if (this.roomStoreToken) {
            this.roomStoreToken.remove();
        }
        ActiveWidgetStore.instance.removeListener(ActiveWidgetStoreEvent.Update, this.onActiveWidgetStoreUpdate);
        RightPanelStore.instance.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Room.myMembership", this.onMyMembership);
        }
    }

    private onRoomViewStoreUpdate = (): void => {
        if (RoomViewStore.getRoomId() === this.state.roomId) return;
        this.setState({
            roomId: RoomViewStore.getRoomId(),
        });
    };

    private onRightPanelStoreUpdate = () => {
        this.setState({
            rightPanelPhase: RightPanelStore.instance.currentCard.phase,
        });
    };

    private onActiveWidgetStoreUpdate = (): void => {
        this.setState({
            persistentWidgetId: ActiveWidgetStore.instance.getPersistentWidgetId(),
        });
    };

    private onMyMembership = async (room: Room, membership: string): Promise<void> => {
        const persistentWidgetInRoomId = ActiveWidgetStore.instance.getRoomId(this.state.persistentWidgetId);
        if (membership !== "join") {
            // we're not in the room anymore - delete
            if (room .roomId === persistentWidgetInRoomId) {
                ActiveWidgetStore.instance.destroyPersistentWidget(this.state.persistentWidgetId);
            }
        }
    };

    public render(): JSX.Element {
        const wId = this.state.persistentWidgetId;
        if (wId) {
            const persistentWidgetInRoomId = ActiveWidgetStore.instance.getRoomId(wId);

            const persistentWidgetInRoom = MatrixClientPeg.get().getRoom(persistentWidgetInRoomId);

            // Sanity check the room - the widget may have been destroyed between render cycles, and
            // thus no room is associated anymore.
            if (!persistentWidgetInRoom) return null;

            const wls = WidgetLayoutStore.instance;

            const userIsPartOfTheRoom = persistentWidgetInRoom.getMyMembership() == "join";
            const fromAnotherRoom = this.state.roomId !== persistentWidgetInRoomId;

            const notInRightPanel =
                !(this.state.rightPanelPhase == RightPanelPhases.Widget &&
                wId == RightPanelStore.instance.currentCard.state?.widgetId);
            const notInCenterContainer =
                    !wls.getContainerWidgets(persistentWidgetInRoom, Container.Center).some((app) => app.id == wId);
            const notInTopContainer =
                !wls.getContainerWidgets(persistentWidgetInRoom, Container.Top).some(app => app.id == wId);
            if (
                // the widget should only be shown as a persistent app (in a floating pip container) if it is not visible on screen
                // either, because we are viewing a different room OR because it is in none of the possible containers of the room view.
                (fromAnotherRoom && userIsPartOfTheRoom) ||
                (notInRightPanel && notInCenterContainer && notInTopContainer && userIsPartOfTheRoom)
            ) {
                // get the widget data
                const appEvent = WidgetUtils.getRoomWidgets(persistentWidgetInRoom).find((ev) => {
                    return ev.getStateKey() === ActiveWidgetStore.instance.getPersistentWidgetId();
                });
                const app = WidgetUtils.makeAppConfig(
                    appEvent.getStateKey(), appEvent.getContent(), appEvent.getSender(),
                    persistentWidgetInRoomId, appEvent.getId(),
                );
                return <AppTile
                    key={app.id}
                    app={app}
                    fullWidth={true}
                    room={persistentWidgetInRoom}
                    userId={MatrixClientPeg.get().credentials.userId}
                    creatorUserId={app.creatorUserId}
                    widgetPageTitle={WidgetUtils.getWidgetDataTitle(app)}
                    waitForIframeLoad={app.waitForIframeLoad}
                    miniMode={true}
                    showMenubar={false}
                />;
            }
        }
        return null;
    }
}

