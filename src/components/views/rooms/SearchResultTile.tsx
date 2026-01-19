/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2023 The Matrix.org Foundation C.I.C.
Copyright 2015 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import ChevronRightIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-right";
import { IconButton } from "@vector-im/compound-web";

import RoomContext from "../../../contexts/RoomContext";
import SettingsStore from "../../../settings/SettingsStore";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import DateSeparator from "../messages/DateSeparator";
import EventTile from "./EventTile";
import type LegacyCallEventGrouper from "../../structures/LegacyCallEventGrouper";
import { buildLegacyCallEventGroupers } from "../../structures/LegacyCallEventGrouper";
import { haveRendererForEvent } from "../../../events/EventTileFactory";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { _t } from "../../../languageHandler";

interface IProps {
    // a list of strings to be highlighted in the results
    searchHighlights?: string[];
    resultEvent: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    showDateSeparator?: boolean;
}

export default class SearchResultTile extends React.Component<IProps> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    // A map of <callId, LegacyCallEventGrouper>
    private callEventGroupers = new Map<string, LegacyCallEventGrouper>();

    public constructor(props: IProps) {
        super(props);

        this.buildLegacyCallEventGroupers([this.props.resultEvent]);
    }

    private buildLegacyCallEventGroupers(events?: MatrixEvent[]): void {
        this.callEventGroupers = buildLegacyCallEventGroupers(this.callEventGroupers, events);
    }

    public render(): React.ReactNode {
        const resultEvent = this.props.resultEvent;
        const eventId = resultEvent.getId();
        if (!eventId) return null;

        const cli = MatrixClientPeg.safeGet();
        if (!haveRendererForEvent(resultEvent, cli, this.context?.showHiddenEvents)) return null;

        const ts1 = resultEvent.getTs();
        const ret: React.ReactNode[] = [];
        if (this.props.showDateSeparator !== false) {
            ret.push(<DateSeparator key={ts1 + "-search"} roomId={resultEvent.getRoomId()!} ts={ts1} />);
        }
        const layout = SettingsStore.getValue("layout");
        const isTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
        const alwaysShowTimestamps = SettingsStore.getValue("alwaysShowTimestamps");

        ret.push(
            <EventTile
                key={`${eventId}-search`}
                mxEvent={resultEvent}
                layout={layout}
                contextual={false}
                highlights={this.props.searchHighlights}
                permalinkCreator={this.props.permalinkCreator}
                isTwelveHour={isTwelveHour}
                alwaysShowTimestamps={alwaysShowTimestamps}
                lastInSection={true}
                continuation={false}
                callEventGrouper={this.callEventGroupers.get(resultEvent.getContent().call_id)}
            />,
        );

        const onJumpToEvent = (ev: React.MouseEvent): void => {
            ev.preventDefault();
            ev.stopPropagation();
            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                event_id: eventId,
                highlighted: true,
                room_id: resultEvent.getRoomId(),
                metricsTrigger: undefined,
            });
        };

        return (
            <li data-scroll-tokens={eventId} className="mx_SearchResultTile">
                <ol>{ret}</ol>
                <IconButton
                    className="mx_SearchResultTile_jump"
                    aria-label={_t("timeline|mab|view_in_room")}
                    title={_t("timeline|mab|view_in_room")}
                    onClick={onJumpToEvent}
                >
                    <ChevronRightIcon />
                </IconButton>
            </li>
        );
    }
}
