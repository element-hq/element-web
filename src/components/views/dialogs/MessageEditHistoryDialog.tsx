/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type MatrixEvent, EventType, RelationType, type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { defer } from "matrix-js-sdk/src/utils";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import { wantsDateSeparator } from "../../../DateUtils";
import SettingsStore from "../../../settings/SettingsStore";
import BaseDialog from "./BaseDialog";
import ScrollPanel from "../../structures/ScrollPanel";
import Spinner from "../elements/Spinner";
import EditHistoryMessage from "../messages/EditHistoryMessage";
import DateSeparator from "../messages/DateSeparator";

interface IProps {
    mxEvent: MatrixEvent;
    onFinished(): void;
}

interface IState {
    originalEvent: MatrixEvent | null;
    error: MatrixError | null;
    events: MatrixEvent[];
    nextBatch: string | null;
    isLoading: boolean;
    isTwelveHour: boolean;
}

export default class MessageEditHistoryDialog extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            originalEvent: null,
            error: null,
            events: [],
            nextBatch: null,
            isLoading: true,
            isTwelveHour: SettingsStore.getValue("showTwelveHourTimestamps"),
        };
    }

    private loadMoreEdits = async (backwards?: boolean): Promise<boolean> => {
        if (backwards || (!this.state.nextBatch && !this.state.isLoading)) {
            // bail out on backwards as we only paginate in one direction
            return false;
        }
        const opts = { from: this.state.nextBatch ?? undefined };
        const roomId = this.props.mxEvent.getRoomId()!;
        const eventId = this.props.mxEvent.getId()!;
        const client = MatrixClientPeg.safeGet();

        const { resolve, reject, promise } = defer<boolean>();
        let result: Awaited<ReturnType<MatrixClient["relations"]>>;

        try {
            result = await client.relations(roomId, eventId, RelationType.Replace, EventType.RoomMessage, opts);
        } catch (error) {
            // log if the server returned an error
            if (error instanceof MatrixError && error.errcode) {
                logger.error("fetching /relations failed with error", error);
            }
            this.setState({ error: error as MatrixError }, () => reject(error));
            return promise;
        }

        const newEvents = result.events;
        this.locallyRedactEventsIfNeeded(newEvents);
        this.setState(
            {
                originalEvent: this.state.originalEvent ?? result.originalEvent ?? null,
                events: this.state.events.concat(newEvents),
                nextBatch: result.nextBatch ?? null,
                isLoading: false,
            },
            () => {
                const hasMoreResults = !!this.state.nextBatch;
                resolve(hasMoreResults);
            },
        );
        return promise;
    };

    private locallyRedactEventsIfNeeded(newEvents: MatrixEvent[]): void {
        const roomId = this.props.mxEvent.getRoomId();
        const client = MatrixClientPeg.safeGet();
        const room = client.getRoom(roomId);
        if (!room) return;
        const pendingEvents = room.getPendingEvents();
        for (const e of newEvents) {
            const pendingRedaction = pendingEvents.find((pe) => {
                return pe.getType() === EventType.RoomRedaction && pe.getAssociatedId() === e.getId();
            });
            if (pendingRedaction) {
                e.markLocallyRedacted(pendingRedaction);
            }
        }
    }

    public componentDidMount(): void {
        this.loadMoreEdits();
    }

    private renderEdits(): JSX.Element[] {
        const nodes: JSX.Element[] = [];
        let lastEvent: MatrixEvent;
        let allEvents = this.state.events;
        // append original event when we've done last pagination
        if (this.state.originalEvent && !this.state.nextBatch) {
            allEvents = allEvents.concat(this.state.originalEvent);
        }
        const baseEventId = this.props.mxEvent.getId();
        allEvents.forEach((e, i) => {
            if (!lastEvent || wantsDateSeparator(lastEvent.getDate() || undefined, e.getDate() || undefined)) {
                nodes.push(
                    <li key={e.getTs() + "~"}>
                        <DateSeparator roomId={e.getRoomId()!} ts={e.getTs()} />
                    </li>,
                );
            }
            const isBaseEvent = e.getId() === baseEventId;
            nodes.push(
                <EditHistoryMessage
                    key={e.getId()}
                    previousEdit={!isBaseEvent ? allEvents[i + 1] : undefined}
                    isBaseEvent={isBaseEvent}
                    mxEvent={e}
                    isTwelveHour={this.state.isTwelveHour}
                />,
            );
            lastEvent = e;
        });
        return nodes;
    }

    public render(): React.ReactNode {
        let content;
        if (this.state.error) {
            const { error } = this.state;
            if (error.errcode === "M_UNRECOGNIZED") {
                content = <p className="mx_MessageEditHistoryDialog_error">{_t("error|edit_history_unsupported")}</p>;
            } else if (error.errcode) {
                // some kind of error from the homeserver
                content = <p className="mx_MessageEditHistoryDialog_error">{_t("error|something_went_wrong")}</p>;
            } else {
                content = (
                    <p className="mx_MessageEditHistoryDialog_error">
                        {_t("cannot_reach_homeserver")}
                        <br />
                        {_t("cannot_reach_homeserver_detail")}
                    </p>
                );
            }
        } else if (this.state.isLoading) {
            content = <Spinner />;
        } else {
            content = (
                <ScrollPanel
                    className="mx_MessageEditHistoryDialog_scrollPanel"
                    onFillRequest={this.loadMoreEdits}
                    stickyBottom={false}
                    startAtBottom={false}
                >
                    <ul className="mx_MessageEditHistoryDialog_edits">{this.renderEdits()}</ul>
                </ScrollPanel>
            );
        }
        return (
            <BaseDialog
                className="mx_MessageEditHistoryDialog"
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("message_edit_dialog_title")}
            >
                {content}
            </BaseDialog>
        );
    }
}
