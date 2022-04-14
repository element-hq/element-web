/*
Copyright 2015 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import { SearchResult } from "matrix-js-sdk/src/models/search-result";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import SettingsStore from "../../../settings/SettingsStore";
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import DateSeparator from "../messages/DateSeparator";
import EventTile from "./EventTile";
import { shouldFormContinuation } from "../../structures/MessagePanel";
import { wantsDateSeparator } from "../../../DateUtils";
import CallEventGrouper, { buildCallEventGroupers } from "../../structures/CallEventGrouper";
import { haveRendererForEvent } from "../../../events/EventTileFactory";

interface IProps {
    // a matrix-js-sdk SearchResult containing the details of this result
    searchResult: SearchResult;
    // a list of strings to be highlighted in the results
    searchHighlights?: string[];
    // href for the highlights in this result
    resultLink?: string;
    onHeightChanged?: () => void;
    permalinkCreator?: RoomPermalinkCreator;
}

export default class SearchResultTile extends React.Component<IProps> {
    static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;

    // A map of <callId, CallEventGrouper>
    private callEventGroupers = new Map<string, CallEventGrouper>();

    constructor(props, context) {
        super(props, context);

        this.buildCallEventGroupers(this.props.searchResult.context.getTimeline());
    }

    private buildCallEventGroupers(events?: MatrixEvent[]): void {
        this.callEventGroupers = buildCallEventGroupers(this.callEventGroupers, events);
    }

    public render() {
        const result = this.props.searchResult;
        const resultEvent = result.context.getEvent();
        const eventId = resultEvent.getId();

        const ts1 = resultEvent.getTs();
        const ret = [<DateSeparator key={ts1 + "-search"} roomId={resultEvent.getRoomId()} ts={ts1} />];
        const layout = SettingsStore.getValue("layout");
        const isTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
        const alwaysShowTimestamps = SettingsStore.getValue("alwaysShowTimestamps");
        const threadsEnabled = SettingsStore.getValue("feature_thread");

        const timeline = result.context.getTimeline();
        for (let j = 0; j < timeline.length; j++) {
            const mxEv = timeline[j];
            let highlights;
            const contextual = (j != result.context.getOurEventIndex());
            if (!contextual) {
                highlights = this.props.searchHighlights;
            }

            if (haveRendererForEvent(mxEv, this.context?.showHiddenEvents)) {
                // do we need a date separator since the last event?
                const prevEv = timeline[j - 1];
                // is this a continuation of the previous message?
                const continuation = prevEv &&
                    !wantsDateSeparator(prevEv.getDate(), mxEv.getDate()) &&
                    shouldFormContinuation(
                        prevEv,
                        mxEv,
                        this.context?.showHiddenEvents,
                        threadsEnabled,
                        TimelineRenderingType.Search,
                    );

                let lastInSection = true;
                const nextEv = timeline[j + 1];
                if (nextEv) {
                    const willWantDateSeparator = wantsDateSeparator(mxEv.getDate(), nextEv.getDate());
                    lastInSection = (
                        willWantDateSeparator ||
                        mxEv.getSender() !== nextEv.getSender() ||
                        !shouldFormContinuation(
                            mxEv,
                            nextEv,
                            this.context?.showHiddenEvents,
                            threadsEnabled,
                            TimelineRenderingType.Search,
                        )
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

        return <li data-scroll-tokens={eventId}>
            <ol>{ ret }</ol>
        </li>;
    }
}
