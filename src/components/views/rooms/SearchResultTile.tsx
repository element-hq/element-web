/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.
Copyright 2015 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import SettingsStore from "../../../settings/SettingsStore";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import DateSeparator from "../messages/DateSeparator";
import EventTile from "./EventTile";
import { shouldFormContinuation } from "../../structures/MessagePanel";
import { wantsDateSeparator } from "../../../DateUtils";
import type LegacyCallEventGrouper from "../../structures/LegacyCallEventGrouper";
import { buildLegacyCallEventGroupers } from "../../structures/LegacyCallEventGrouper";
import { haveRendererForEvent } from "../../../events/EventTileFactory";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IProps {
    // a list of strings to be highlighted in the results
    searchHighlights?: string[];
    // href for the highlights in this result
    resultLink?: string;
    // timeline of the search result
    timeline: MatrixEvent[];
    // indexes of the matching events (not contextual ones)
    ourEventsIndexes: number[];
    onHeightChanged?: () => void;
    permalinkCreator?: RoomPermalinkCreator;
}

export default class SearchResultTile extends React.Component<IProps> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    // A map of <callId, LegacyCallEventGrouper>
    private callEventGroupers = new Map<string, LegacyCallEventGrouper>();

    public constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);

        this.buildLegacyCallEventGroupers(this.props.timeline);
    }

    private buildLegacyCallEventGroupers(events?: MatrixEvent[]): void {
        this.callEventGroupers = buildLegacyCallEventGroupers(this.callEventGroupers, events);
    }

    public render(): React.ReactNode {
        const timeline = this.props.timeline;
        const resultEvent = timeline[this.props.ourEventsIndexes[0]];
        const eventId = resultEvent.getId();

        const ts1 = resultEvent.getTs();
        const ret = [<DateSeparator key={ts1 + "-search"} roomId={resultEvent.getRoomId()!} ts={ts1} />];
        const layout = SettingsStore.getValue("layout");
        const isTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
        const alwaysShowTimestamps = SettingsStore.getValue("alwaysShowTimestamps");

        const cli = MatrixClientPeg.safeGet();
        for (let j = 0; j < timeline.length; j++) {
            const mxEv = timeline[j];
            let highlights: string[] | undefined;
            const contextual = !this.props.ourEventsIndexes.includes(j);
            if (!contextual) {
                highlights = this.props.searchHighlights;
            }

            if (haveRendererForEvent(mxEv, cli, this.context?.showHiddenEvents)) {
                // do we need a date separator since the last event?
                const prevEv = timeline[j - 1];
                // is this a continuation of the previous message?
                const continuation =
                    prevEv &&
                    !wantsDateSeparator(prevEv.getDate() || undefined, mxEv.getDate() || undefined) &&
                    shouldFormContinuation(
                        prevEv,
                        mxEv,
                        cli,
                        this.context?.showHiddenEvents,
                        TimelineRenderingType.Search,
                    );

                let lastInSection = true;
                const nextEv = timeline[j + 1];
                if (nextEv) {
                    const willWantDateSeparator = wantsDateSeparator(
                        mxEv.getDate() || undefined,
                        nextEv.getDate() || undefined,
                    );
                    lastInSection =
                        willWantDateSeparator ||
                        mxEv.getSender() !== nextEv.getSender() ||
                        !shouldFormContinuation(
                            mxEv,
                            nextEv,
                            cli,
                            this.context?.showHiddenEvents,
                            TimelineRenderingType.Search,
                        );
                }

                ret.push(
                    <EventTile
                        key={`${eventId}+${j}`}
                        mxEvent={mxEv}
                        layout={layout}
                        contextual={contextual}
                        highlights={highlights}
                        permalinkCreator={this.props.permalinkCreator}
                        highlightLink={this.props.resultLink}
                        onHeightChanged={this.props.onHeightChanged}
                        isTwelveHour={isTwelveHour}
                        alwaysShowTimestamps={alwaysShowTimestamps}
                        lastInSection={lastInSection}
                        continuation={continuation}
                        callEventGrouper={this.callEventGroupers.get(mxEv.getContent().call_id)}
                    />,
                );
            }
        }

        return (
            <li data-scroll-tokens={eventId}>
                <ol>{ret}</ol>
            </li>
        );
    }
}
