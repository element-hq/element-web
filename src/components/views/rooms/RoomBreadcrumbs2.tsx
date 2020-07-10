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
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { _t } from "../../../languageHandler";
import { Room } from "matrix-js-sdk/src/models/room";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import Analytics from "../../../Analytics";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { CSSTransition } from "react-transition-group";
import RoomListStore from "../../../stores/room-list/RoomListStore2";
import { DefaultTagID } from "../../../stores/room-list/models";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";

// TODO: Remove banner on launch: https://github.com/vector-im/riot-web/issues/14367
// TODO: Rename on launch: https://github.com/vector-im/riot-web/issues/14367

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
    // Both of these control the animation for the breadcrumbs. For details on the
    // actual animation, see the CSS.
    //
    // doAnimation is to lie to the CSSTransition component (see onBreadcrumbsUpdate
    // for info). skipFirst is used to try and reduce jerky animation - also see the
    // breadcrumb update function for info on that.
    doAnimation: boolean;
    skipFirst: boolean;
}

export default class RoomBreadcrumbs2 extends React.PureComponent<IProps, IState> {
    private isMounted = true;

    constructor(props: IProps) {
        super(props);

        this.state = {
            doAnimation: true, // technically we want animation on mount, but it won't be perfect
            skipFirst: false, // render the thing, as boring as it is
        };

        BreadcrumbsStore.instance.on(UPDATE_EVENT, this.onBreadcrumbsUpdate);
    }

    public componentWillUnmount() {
        this.isMounted = false;
        BreadcrumbsStore.instance.off(UPDATE_EVENT, this.onBreadcrumbsUpdate);
    }

    private onBreadcrumbsUpdate = () => {
        if (!this.isMounted) return;

        // We need to trick the CSSTransition component into updating, which means we need to
        // tell it to not animate, then to animate a moment later. This causes two updates
        // which means two renders. The skipFirst change is so that our don't-animate state
        // doesn't show the breadcrumb we're about to reveal as it causes a visual jump/jerk.
        // The second update, on the next available tick, causes the "enter" animation to start
        // again and this time we want to show the newest breadcrumb because it'll be hidden
        // off screen for the animation.
        this.setState({doAnimation: false, skipFirst: true});
        setTimeout(() => this.setState({doAnimation: true, skipFirst: false}), 0);
    };

    private viewRoom = (room: Room, index: number) => {
        Analytics.trackEvent("Breadcrumbs", "click_node", index);
        defaultDispatcher.dispatch({action: "view_room", room_id: room.roomId});
    };

    public render(): React.ReactElement {
        const tiles = BreadcrumbsStore.instance.rooms.map((r, i) => {
            const roomTags = RoomListStore.instance.getTagsForRoom(r);
            const roomTag = roomTags.includes(DefaultTagID.DM) ? DefaultTagID.DM : roomTags[0];
            return (
                <AccessibleTooltipButton
                    className="mx_RoomBreadcrumbs2_crumb"
                    key={r.roomId}
                    onClick={() => this.viewRoom(r, i)}
                    aria-label={_t("Room %(name)s", {name: r.name})}
                    title={r.name}
                    tooltipClassName={"mx_RoomBreadcrumbs2_Tooltip"}
                >
                    <DecoratedRoomAvatar
                        room={r}
                        avatarSize={32}
                        tag={roomTag}
                        displayBadge={true}
                        forceCount={true}
                    />
                </AccessibleTooltipButton>
            );
        });

        if (tiles.length > 0) {
            // NOTE: The CSSTransition timeout MUST match the timeout in our CSS!
            return (
                <CSSTransition
                    appear={true} in={this.state.doAnimation} timeout={640}
                    classNames='mx_RoomBreadcrumbs2'
                >
                    <div className='mx_RoomBreadcrumbs2'>
                        {tiles.slice(this.state.skipFirst ? 1 : 0)}
                    </div>
                </CSSTransition>
            );
        } else {
            return (
                <div className='mx_RoomBreadcrumbs2'>
                    <div className="mx_RoomBreadcrumbs2_placeholder">
                        {_t("No recently visited rooms")}
                    </div>
                </div>
            );
        }
    }
}
