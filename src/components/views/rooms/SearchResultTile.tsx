/*
Copyright 2015 OpenMarket Ltd
Copyright 2019 - 2023 The Matrix.org Foundation C.I.C.

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
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import SettingsStore from "../../../settings/SettingsStore";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import DateSeparator from "../messages/DateSeparator";
import EventTile from "./EventTile";
import { shouldFormContinuation } from "../../structures/MessagePanel";
import { wantsDateSeparator } from "../../../DateUtils";
import LegacyCallEventGrouper, { buildLegacyCallEventGroupers } from "../../structures/LegacyCallEventGrouper";
import { haveRendererForEvent } from "../../../events/EventTileFactory";

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
    public context!: React.ContextType<typeof RoomContext>;

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

        for (let j = 0; j < timeline.length; j++) {
            const mxEv = timeline[j];
            let highlights: string[] | undefined;
            const contextual = !this.props.ourEventsIndexes.includes(j);
            if (!contextual) {
                highlights = this.props.searchHighlights;
            }

            if (haveRendererForEvent(mxEv, this.context?.showHiddenEvents)) {
                // do we need a date separator since the last event?
                const prevEv = timeline[j - 1];
                // is this a continuation of the previous message?
                const continuation =
                    prevEv &&
                    !wantsDateSeparator(prevEv.getDate() || undefined, mxEv.getDate() || undefined) &&
                    shouldFormContinuation(prevEv, mxEv, this.context?.showHiddenEvents, TimelineRenderingType.Search);

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
