/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import { BreadcrumbsStore } from "../../../stores/BreadcrumbsStore";
import AccessibleButton from "../elements/AccessibleButton";
import RoomAvatar from "../avatars/RoomAvatar";
import { _t } from "../../../languageHandler";
import { Room } from "matrix-js-sdk/src/models/room";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import Analytics from "../../../Analytics";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

interface IProps {
}

interface IState {
}

export default class RoomBreadcrumbs2 extends React.PureComponent<IProps, IState> {
    private isMounted = true;

    constructor(props: IProps) {
        super(props);

        BreadcrumbsStore.instance.on(UPDATE_EVENT, this.onBreadcrumbsUpdate);
    }

    public componentWillUnmount() {
        this.isMounted = false;
        BreadcrumbsStore.instance.off(UPDATE_EVENT, this.onBreadcrumbsUpdate);
    }

    private onBreadcrumbsUpdate = () => {
        if (!this.isMounted) return;
        this.forceUpdate(); // we have no state, so this is the best we can do
    };

    private viewRoom = (room: Room, index: number) => {
        Analytics.trackEvent("Breadcrumbs", "click_node", index);
        defaultDispatcher.dispatch({action: "view_room", room_id: room.roomId});
    };

    public render(): React.ReactElement {
        // TODO: Decorate crumbs with icons
        const tiles = BreadcrumbsStore.instance.rooms.map((r, i) => {
            return (
                <AccessibleButton
                    className="mx_RoomBreadcrumbs2_crumb"
                    key={r.roomId}
                    onClick={() => this.viewRoom(r, i)}
                    aria-label={_t("Room %(name)s", {name: r.name})}
                >
                    <RoomAvatar room={r} width={32} height={32}/>
                </AccessibleButton>
            )
        });

        if (tiles.length === 0) {
            tiles.push(
                <div className="mx_RoomBreadcrumbs2_placeholder">
                    {_t("No recently visited rooms")}
                </div>
            );
        }

        return <div className='mx_RoomBreadcrumbs2'>{tiles}</div>;
    }
}
