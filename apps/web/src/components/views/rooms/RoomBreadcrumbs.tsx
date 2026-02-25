/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { type EmptyObject, type Room } from "matrix-js-sdk/src/matrix";
import { CSSTransition } from "react-transition-group";

import { BreadcrumbsStore } from "../../../stores/BreadcrumbsStore";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { _t } from "../../../languageHandler";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { useRovingTabIndex } from "../../../accessibility/RovingTabIndex";
import Toolbar from "../../../accessibility/Toolbar";
import { Action } from "../../../dispatcher/actions";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";

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

const RoomBreadcrumbTile: React.FC<{ room: Room; onClick: (ev: ButtonEvent) => void }> = ({ room, onClick }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex();

    return (
        <AccessibleButton
            className="mx_RoomBreadcrumbs_crumb"
            onClick={onClick}
            aria-label={_t("a11y|room_name", { name: room.name })}
            title={room.name}
            onFocus={onFocus}
            ref={ref}
            tabIndex={isActive ? 0 : -1}
            placement="right"
        >
            <DecoratedRoomAvatar
                room={room}
                size="32px"
                displayBadge={true}
                hideIfDot={true}
                tooltipProps={{ tabIndex: isActive ? 0 : -1 }}
            />
        </AccessibleButton>
    );
};

export default class RoomBreadcrumbs extends React.PureComponent<EmptyObject, IState> {
    private unmounted = false;
    private toolbar = createRef<HTMLDivElement>();

    public constructor(props: EmptyObject) {
        super(props);

        this.state = {
            doAnimation: true, // technically we want animation on mount, but it won't be perfect
            skipFirst: false, // render the thing, as boring as it is
        };
    }

    public componentDidMount(): void {
        this.unmounted = false;
        BreadcrumbsStore.instance.on(UPDATE_EVENT, this.onBreadcrumbsUpdate);
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        BreadcrumbsStore.instance.off(UPDATE_EVENT, this.onBreadcrumbsUpdate);
    }

    private onBreadcrumbsUpdate = (): void => {
        if (this.unmounted) return;

        // We need to trick the CSSTransition component into updating, which means we need to
        // tell it to not animate, then to animate a moment later. This causes two updates
        // which means two renders. The skipFirst change is so that our don't-animate state
        // doesn't show the breadcrumb we're about to reveal as it causes a visual jump/jerk.
        // The second update, on the next available tick, causes the "enter" animation to start
        // again and this time we want to show the newest breadcrumb because it'll be hidden
        // off screen for the animation.
        this.setState({ doAnimation: false, skipFirst: true });
        window.setTimeout(() => this.setState({ doAnimation: true, skipFirst: false }), 0);
    };

    private viewRoom = (room: Room, index: number, viaKeyboard = false): void => {
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            metricsTrigger: "WebHorizontalBreadcrumbs",
            metricsViaKeyboard: viaKeyboard,
        });
    };

    public render(): React.ReactElement {
        const tiles = BreadcrumbsStore.instance.rooms.map((r, i) => (
            <RoomBreadcrumbTile
                key={r.roomId}
                room={r}
                onClick={(ev: ButtonEvent) => this.viewRoom(r, i, ev.type !== "click")}
            />
        ));

        if (tiles.length > 0) {
            // NOTE: The CSSTransition timeout MUST match the timeout in our CSS!
            return (
                <CSSTransition
                    appear={true}
                    in={this.state.doAnimation}
                    timeout={640}
                    classNames="mx_RoomBreadcrumbs"
                    nodeRef={this.toolbar}
                >
                    <Toolbar
                        className="mx_RoomBreadcrumbs"
                        aria-label={_t("room_list|breadcrumbs_label")}
                        ref={this.toolbar}
                    >
                        {tiles.slice(this.state.skipFirst ? 1 : 0)}
                    </Toolbar>
                </CSSTransition>
            );
        } else {
            return (
                <div className="mx_RoomBreadcrumbs">
                    <div className="mx_RoomBreadcrumbs_placeholder">{_t("room_list|breadcrumbs_empty")}</div>
                </div>
            );
        }
    }
}
