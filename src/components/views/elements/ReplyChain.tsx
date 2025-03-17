/*
Copyright 2024 New Vector Ltd.
Copyright 2017-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";
import { type MatrixEvent, type Room, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { makeUserPermalink, type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import SettingsStore from "../../../settings/SettingsStore";
import { type Layout } from "../../../settings/enums/Layout";
import { getUserNameColorClass } from "../../../utils/FormattingUtils";
import { Action } from "../../../dispatcher/actions";
import Spinner from "./Spinner";
import ReplyTile from "../rooms/ReplyTile";
import { Pill, PillType } from "./Pill";
import AccessibleButton from "./AccessibleButton";
import { getParentEventId, shouldDisplayReply } from "../../../utils/Reply";
import RoomContext from "../../../contexts/RoomContext";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { type GetRelationsForEvent } from "../rooms/EventTile";

/**
 * This number is based on the previous behavior - if we have message of height
 * over 60px then we want to show button that will allow to expand it.
 */
const SHOW_EXPAND_QUOTE_PIXELS = 60;

interface IProps {
    // the latest event in this chain of replies
    parentEv: MatrixEvent;
    // called when the ReplyChain contents has changed, including EventTiles thereof
    onHeightChanged?: () => void;
    permalinkCreator?: RoomPermalinkCreator;
    // Specifies which layout to use.
    layout?: Layout;
    // Whether to always show a timestamp
    alwaysShowTimestamps?: boolean;
    forExport?: boolean;
    isQuoteExpanded?: boolean;
    setQuoteExpanded: (isExpanded: boolean) => void;
    getRelationsForEvent?: GetRelationsForEvent;
}

interface IState {
    // The loaded events to be rendered as linear-replies
    events: MatrixEvent[];
    // The latest loaded event which has not yet been shown
    loadedEv: MatrixEvent | null;
    // Whether the component is still loading more events
    loading: boolean;
    // Whether as error was encountered fetching a replied to event.
    err: boolean;
}

// This component does no cycle detection, simply because the only way to make such a cycle would be to
// craft event_id's, using a homeserver that generates predictable event IDs; even then the impact would
// be low as each event being loaded (after the first) is triggered by an explicit user action.
export default class ReplyChain extends React.Component<IProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    private unmounted = false;
    private room: Room;
    private blockquoteRef = React.createRef<HTMLQuoteElement>();

    public constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);

        this.state = {
            events: [],
            loadedEv: null,
            loading: true,
            err: false,
        };

        this.room = this.matrixClient.getRoom(this.props.parentEv.getRoomId())!;
    }

    private get matrixClient(): MatrixClient {
        return MatrixClientPeg.safeGet();
    }

    public componentDidMount(): void {
        this.unmounted = false;
        this.initialize();
        this.trySetExpandableQuotes();
    }

    public componentDidUpdate(): void {
        this.props.onHeightChanged?.();
        this.trySetExpandableQuotes();
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private trySetExpandableQuotes(): void {
        if (this.props.isQuoteExpanded === undefined && this.blockquoteRef.current) {
            const el: HTMLElement | null = this.blockquoteRef.current.querySelector(".mx_EventTile_body");
            if (el) {
                const code: HTMLElement | null = el.querySelector("code");
                const isCodeEllipsisShown = code ? code.offsetHeight >= SHOW_EXPAND_QUOTE_PIXELS : false;
                const isElipsisShown = el.offsetHeight >= SHOW_EXPAND_QUOTE_PIXELS || isCodeEllipsisShown;
                if (isElipsisShown) {
                    this.props.setQuoteExpanded(false);
                }
            }
        }
    }

    private async initialize(): Promise<void> {
        const { parentEv } = this.props;
        // at time of making this component we checked that props.parentEv has a parentEventId
        const ev = await this.getEvent(getParentEventId(parentEv));

        if (this.unmounted) return;

        if (ev) {
            const loadedEv = await this.getNextEvent(ev);
            this.setState({
                events: [ev],
                loadedEv,
                loading: false,
            });
        } else {
            this.setState({ err: true });
        }
    }

    private async getNextEvent(ev: MatrixEvent): Promise<MatrixEvent | null> {
        try {
            const inReplyToEventId = getParentEventId(ev);
            if (!inReplyToEventId) return null;
            return await this.getEvent(inReplyToEventId);
        } catch {
            return null;
        }
    }

    private async getEvent(eventId?: string): Promise<MatrixEvent | null> {
        if (!eventId) return null;
        const event = this.room.findEventById(eventId);
        if (event) return event;

        try {
            // ask the client to fetch the event we want using the context API, only interface to do so is to ask
            // for a timeline with that event, but once it is loaded we can use findEventById to look up the ev map
            await this.matrixClient.getEventTimeline(this.room.getUnfilteredTimelineSet(), eventId);
        } catch {
            // if it fails catch the error and return early, there's no point trying to find the event in this case.
            // Return null as it is falsy and thus should be treated as an error (as the event cannot be resolved).
            return null;
        }
        return this.room.findEventById(eventId) ?? null;
    }

    public canCollapse = (): boolean => {
        return this.state.events.length > 1;
    };

    public collapse = (): void => {
        this.initialize();
    };

    private onQuoteClick = async (): Promise<void> => {
        if (!this.state.loadedEv) return;
        const events = [this.state.loadedEv, ...this.state.events];

        let loadedEv: MatrixEvent | null = null;
        if (events.length > 0) {
            loadedEv = await this.getNextEvent(events[0]);
        }

        this.setState({
            loadedEv,
            events,
        });

        dis.fire(Action.FocusSendMessageComposer);
    };

    private getReplyChainColorClass(ev: MatrixEvent): string {
        return getUserNameColorClass(ev.getSender()!).replace("Username", "ReplyChain");
    }

    public render(): React.ReactNode {
        let header: JSX.Element | undefined;
        if (this.state.err) {
            header = (
                <blockquote className="mx_ReplyChain mx_ReplyChain_error">
                    {_t("timeline|reply|error_loading")}
                </blockquote>
            );
        } else if (this.state.loadedEv && shouldDisplayReply(this.state.events[0])) {
            const ev = this.state.loadedEv;
            const room = this.matrixClient.getRoom(ev.getRoomId());
            header = (
                <blockquote className={`mx_ReplyChain ${this.getReplyChainColorClass(ev)}`}>
                    {_t(
                        "timeline|reply|in_reply_to",
                        {},
                        {
                            a: (sub) => (
                                <AccessibleButton
                                    kind="link_inline"
                                    className="mx_ReplyChain_show"
                                    onClick={this.onQuoteClick}
                                >
                                    {sub}
                                </AccessibleButton>
                            ),
                            pill: (
                                <Pill
                                    type={PillType.UserMention}
                                    room={room ?? undefined}
                                    url={makeUserPermalink(ev.getSender()!)}
                                    shouldShowPillAvatar={SettingsStore.getValue("Pill.shouldShowPillAvatar")}
                                />
                            ),
                        },
                    )}
                </blockquote>
            );
        } else if (this.props.forExport) {
            const eventId = getParentEventId(this.props.parentEv);
            header = (
                <p className="mx_ReplyChain_Export">
                    {_t(
                        "timeline|reply|in_reply_to_for_export",
                        {},
                        {
                            a: (sub) => (
                                <a className="mx_reply_anchor" href={`#${eventId}`} data-scroll-to={eventId}>
                                    {" "}
                                    {sub}{" "}
                                </a>
                            ),
                        },
                    )}
                </p>
            );
        } else if (this.state.loading) {
            header = <Spinner w={16} h={16} />;
        }

        const { isQuoteExpanded } = this.props;
        const evTiles = this.state.events.map((ev) => {
            const classname = classNames({
                "mx_ReplyChain": true,
                [this.getReplyChainColorClass(ev)]: true,
                // We don't want to add the class if it's undefined, it should only be expanded/collapsed when it's true/false
                "mx_ReplyChain--expanded": isQuoteExpanded === true,
                // We don't want to add the class if it's undefined, it should only be expanded/collapsed when it's true/false
                "mx_ReplyChain--collapsed": isQuoteExpanded === false,
            });
            return (
                <blockquote ref={this.blockquoteRef} className={classname} key={ev.getId()}>
                    <ReplyTile
                        mxEvent={ev}
                        onHeightChanged={this.props.onHeightChanged}
                        permalinkCreator={this.props.permalinkCreator}
                        toggleExpandedQuote={() => this.props.setQuoteExpanded(!this.props.isQuoteExpanded)}
                        getRelationsForEvent={this.props.getRelationsForEvent}
                    />
                </blockquote>
            );
        });

        return (
            <div className="mx_ReplyChain_wrapper">
                <div>{header}</div>
                <div>{evTiles}</div>
            </div>
        );
    }
}
