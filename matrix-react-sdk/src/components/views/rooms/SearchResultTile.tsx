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

import RoomContext from "../../../contexts/RoomContext";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import DateSeparator from "../messages/DateSeparator";
import EventTile, { haveTileForEvent } from "./EventTile";

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

@replaceableComponent("views.rooms.SearchResultTile")
export default class SearchResultTile extends React.Component<IProps> {
    static contextType = RoomContext;

    public render() {
        const result = this.props.searchResult;
        const mxEv = result.context.getEvent();
        const eventId = mxEv.getId();

        const ts1 = mxEv.getTs();
        const ret = [<DateSeparator key={ts1 + "-search"} ts={ts1} />];
        const layout = SettingsStore.getValue("layout");
        const isTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
        const alwaysShowTimestamps = SettingsStore.getValue("alwaysShowTimestamps");
        const enableFlair = SettingsStore.getValue(UIFeature.Flair);

        const timeline = result.context.getTimeline();
        for (let j = 0; j < timeline.length; j++) {
            const ev = timeline[j];
            let highlights;
            const contextual = (j != result.context.getOurEventIndex());
            if (!contextual) {
                highlights = this.props.searchHighlights;
            }
            if (haveTileForEvent(ev, this.context?.showHiddenEventsInTimeline)) {
                ret.push(
                    <EventTile
                        key={`${eventId}+${j}`}
                        mxEvent={ev}
                        layout={layout}
                        contextual={contextual}
                        highlights={highlights}
                        permalinkCreator={this.props.permalinkCreator}
                        highlightLink={this.props.resultLink}
                        onHeightChanged={this.props.onHeightChanged}
                        isTwelveHour={isTwelveHour}
                        alwaysShowTimestamps={alwaysShowTimestamps}
                        enableFlair={enableFlair}
                    />,
                );
            }
        }

        return <li data-scroll-tokens={eventId}>{ ret }</li>;
    }
}
