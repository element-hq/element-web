/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015 - 2022 The Matrix.org Foundation C.I.C.

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
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomState, RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { throttle } from "lodash";

import dis from "../../dispatcher/dispatcher";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../stores/right-panel/RightPanelStore";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import RoomSummaryCard from "../views/right_panel/RoomSummaryCard";
import WidgetCard from "../views/right_panel/WidgetCard";
import SettingsStore from "../../settings/SettingsStore";
import MemberList from "../views/rooms/MemberList";
import UserInfo from "../views/right_panel/UserInfo";
import ThirdPartyMemberInfo from "../views/rooms/ThirdPartyMemberInfo";
import FilePanel from "./FilePanel";
import ThreadView from "./ThreadView";
import ThreadPanel from "./ThreadPanel";
import NotificationPanel from "./NotificationPanel";
import ResizeNotifier from "../../utils/ResizeNotifier";
import PinnedMessagesCard from "../views/right_panel/PinnedMessagesCard";
import { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import { E2EStatus } from "../../utils/ShieldUtils";
import TimelineCard from "../views/right_panel/TimelineCard";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { IRightPanelCard, IRightPanelCardState } from "../../stores/right-panel/RightPanelStoreIPanelState";
import { Action } from "../../dispatcher/actions";
import { XOR } from "../../@types/common";

interface BaseProps {
    overwriteCard?: IRightPanelCard; // used to display a custom card and ignoring the RightPanelStore (used for UserView)
    resizeNotifier: ResizeNotifier;
    e2eStatus?: E2EStatus;
}

interface RoomlessProps extends BaseProps {
    room?: undefined;
    permalinkCreator?: undefined;
}

interface RoomProps extends BaseProps {
    room: Room;
    permalinkCreator: RoomPermalinkCreator;
}

type Props = XOR<RoomlessProps, RoomProps>;

interface IState {
    phase?: RightPanelPhases;
    searchQuery: string;
    cardState?: IRightPanelCardState;
}

export default class RightPanel extends React.Component<Props, IState> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    public constructor(props: Props, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        this.state = {
            searchQuery: "",
        };
    }

    private readonly delayedUpdate = throttle(
        (): void => {
            this.forceUpdate();
        },
        500,
        { leading: true, trailing: true },
    );

    public componentDidMount(): void {
        this.context.on(RoomStateEvent.Members, this.onRoomStateMember);
        RightPanelStore.instance.on(UPDATE_EVENT, this.onRightPanelStoreUpdate);
    }

    public componentWillUnmount(): void {
        this.context?.removeListener(RoomStateEvent.Members, this.onRoomStateMember);
        RightPanelStore.instance.off(UPDATE_EVENT, this.onRightPanelStoreUpdate);
    }

    public static getDerivedStateFromProps(props: Props): Partial<IState> {
        let currentCard: IRightPanelCard | undefined;
        if (props.room) {
            currentCard = RightPanelStore.instance.currentCardForRoom(props.room.roomId);
        }

        return {
            cardState: currentCard?.state,
            phase: currentCard?.phase ?? undefined,
        };
    }

    private onRoomStateMember = (ev: MatrixEvent, state: RoomState, member: RoomMember): void => {
        if (!this.props.room || member.roomId !== this.props.room.roomId) {
            return;
        }

        // redraw the badge on the membership list
        if (this.state.phase === RightPanelPhases.RoomMemberList) {
            this.delayedUpdate();
        } else if (
            this.state.phase === RightPanelPhases.RoomMemberInfo &&
            member.userId === this.state.cardState?.member?.userId
        ) {
            // refresh the member info (e.g. new power level)
            this.delayedUpdate();
        }
    };

    private onRightPanelStoreUpdate = (): void => {
        this.setState({ ...(RightPanel.getDerivedStateFromProps(this.props) as IState) });
    };

    private onClose = (): void => {
        // XXX: There are three different ways of 'closing' this panel depending on what state
        // things are in... this knows far more than it should do about the state of the rest
        // of the app and is generally a bit silly.
        if (this.props.overwriteCard?.state?.member) {
            // If we have a user prop then we're displaying a user from the 'user' page type
            // in LoggedInView, so need to change the page type to close the panel (we switch
            // to the home page which is not obviously the correct thing to do, but I'm not sure
            // anything else is - we could hide the close button altogether?)
            dis.dispatch({
                action: Action.ViewHomePage,
            });
        } else if (
            this.state.phase === RightPanelPhases.EncryptionPanel &&
            this.state.cardState?.verificationRequest?.pending
        ) {
            // When the user clicks close on the encryption panel cancel the pending request first if any
            this.state.cardState.verificationRequest.cancel();
        } else {
            RightPanelStore.instance.togglePanel(this.props.room?.roomId ?? null);
        }
    };

    private onSearchQueryChanged = (searchQuery: string): void => {
        this.setState({ searchQuery });
    };

    public render(): React.ReactNode {
        let card = <div />;
        const roomId = this.props.room?.roomId;
        const phase = this.props.overwriteCard?.phase ?? this.state.phase;
        const cardState = this.props.overwriteCard?.state ?? this.state.cardState;
        switch (phase) {
            case RightPanelPhases.RoomMemberList:
                if (!!roomId) {
                    card = (
                        <MemberList
                            roomId={roomId}
                            key={roomId}
                            onClose={this.onClose}
                            searchQuery={this.state.searchQuery}
                            onSearchQueryChanged={this.onSearchQueryChanged}
                        />
                    );
                }
                break;
            case RightPanelPhases.SpaceMemberList:
                if (!!cardState?.spaceId || !!roomId) {
                    card = (
                        <MemberList
                            roomId={cardState?.spaceId ?? roomId!}
                            key={cardState?.spaceId ?? roomId!}
                            onClose={this.onClose}
                            searchQuery={this.state.searchQuery}
                            onSearchQueryChanged={this.onSearchQueryChanged}
                        />
                    );
                }
                break;

            case RightPanelPhases.RoomMemberInfo:
            case RightPanelPhases.SpaceMemberInfo:
            case RightPanelPhases.EncryptionPanel: {
                if (!!cardState?.member) {
                    const roomMember = cardState.member instanceof RoomMember ? cardState.member : undefined;
                    card = (
                        <UserInfo
                            user={cardState.member}
                            room={this.context.getRoom(roomMember?.roomId) ?? this.props.room}
                            key={roomId ?? cardState.member.userId}
                            onClose={this.onClose}
                            phase={phase}
                            verificationRequest={cardState.verificationRequest}
                            verificationRequestPromise={cardState.verificationRequestPromise}
                        />
                    );
                }
                break;
            }
            case RightPanelPhases.Room3pidMemberInfo:
            case RightPanelPhases.Space3pidMemberInfo:
                if (!!cardState?.memberInfoEvent) {
                    card = <ThirdPartyMemberInfo event={cardState.memberInfoEvent} key={roomId} />;
                }
                break;

            case RightPanelPhases.NotificationPanel:
                card = <NotificationPanel onClose={this.onClose} />;
                break;

            case RightPanelPhases.PinnedMessages:
                if (!!this.props.room && SettingsStore.getValue("feature_pinning")) {
                    card = (
                        <PinnedMessagesCard
                            room={this.props.room}
                            onClose={this.onClose}
                            permalinkCreator={this.props.permalinkCreator}
                        />
                    );
                }
                break;
            case RightPanelPhases.Timeline:
                if (!!this.props.room) {
                    card = (
                        <TimelineCard
                            classNames="mx_ThreadPanel mx_TimelineCard"
                            room={this.props.room}
                            timelineSet={this.props.room.getUnfilteredTimelineSet()}
                            resizeNotifier={this.props.resizeNotifier}
                            onClose={this.onClose}
                            permalinkCreator={this.props.permalinkCreator}
                            e2eStatus={this.props.e2eStatus}
                        />
                    );
                }
                break;
            case RightPanelPhases.FilePanel:
                if (!!roomId) {
                    card = (
                        <FilePanel roomId={roomId} resizeNotifier={this.props.resizeNotifier} onClose={this.onClose} />
                    );
                }
                break;

            case RightPanelPhases.ThreadView:
                if (!!this.props.room && !!cardState?.threadHeadEvent) {
                    card = (
                        <ThreadView
                            room={this.props.room}
                            resizeNotifier={this.props.resizeNotifier}
                            onClose={this.onClose}
                            mxEvent={cardState.threadHeadEvent}
                            initialEvent={cardState.initialEvent}
                            isInitialEventHighlighted={cardState.isInitialEventHighlighted}
                            initialEventScrollIntoView={cardState.initialEventScrollIntoView}
                            permalinkCreator={this.props.permalinkCreator}
                            e2eStatus={this.props.e2eStatus}
                        />
                    );
                }
                break;

            case RightPanelPhases.ThreadPanel:
                if (!!this.props.room) {
                    card = (
                        <ThreadPanel
                            roomId={this.props.room.roomId}
                            resizeNotifier={this.props.resizeNotifier}
                            onClose={this.onClose}
                            permalinkCreator={this.props.permalinkCreator}
                        />
                    );
                }
                break;

            case RightPanelPhases.RoomSummary:
                if (!!this.props.room) {
                    card = (
                        <RoomSummaryCard
                            room={this.props.room}
                            onClose={this.onClose}
                            // whenever RightPanel is passed a room it is passed a permalinkcreator
                            permalinkCreator={this.props.permalinkCreator!}
                        />
                    );
                }
                break;

            case RightPanelPhases.Widget:
                if (!!this.props.room && !!cardState?.widgetId) {
                    card = <WidgetCard room={this.props.room} widgetId={cardState.widgetId} onClose={this.onClose} />;
                }
                break;
        }

        return (
            <aside className="mx_RightPanel dark-panel" id="mx_RightPanel">
                {card}
            </aside>
        );
    }
}
