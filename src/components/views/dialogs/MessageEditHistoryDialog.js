/*
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

import React from 'react';
import PropTypes from 'prop-types';
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import { _t } from '../../../languageHandler';
import * as sdk from "../../../index";
import {wantsDateSeparator} from '../../../DateUtils';
import SettingsStore from '../../../settings/SettingsStore';

export default class MessageEditHistoryDialog extends React.PureComponent {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
    };

    constructor(props) {
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

    loadMoreEdits = async (backwards) => {
        if (backwards || (!this.state.nextBatch && !this.state.isLoading)) {
            // bail out on backwards as we only paginate in one direction
            return false;
        }
        const opts = {from: this.state.nextBatch};
        const roomId = this.props.mxEvent.getRoomId();
        const eventId = this.props.mxEvent.getId();
        const client = MatrixClientPeg.get();
        let result;
        let resolve;
        let reject;
        const promise = new Promise((_resolve, _reject) => {resolve = _resolve; reject = _reject;});
        try {
            result = await client.relations(
                roomId, eventId, "m.replace", "m.room.message", opts);
        } catch (error) {
            // log if the server returned an error
            if (error.errcode) {
                console.error("fetching /relations failed with error", error);
            }
            this.setState({error}, () => reject(error));
            return promise;
        }

        const newEvents = result.events;
        this._locallyRedactEventsIfNeeded(newEvents);
        this.setState({
            originalEvent: this.state.originalEvent || result.originalEvent,
            events: this.state.events.concat(newEvents),
            nextBatch: result.nextBatch,
            isLoading: false,
        }, () => {
            const hasMoreResults = !!this.state.nextBatch;
            resolve(hasMoreResults);
        });
        return promise;
    }

    _locallyRedactEventsIfNeeded(newEvents) {
        const roomId = this.props.mxEvent.getRoomId();
        const client = MatrixClientPeg.get();
        const room = client.getRoom(roomId);
        const pendingEvents = room.getPendingEvents();
        for (const e of newEvents) {
            const pendingRedaction = pendingEvents.find(pe => {
                return pe.getType() === "m.room.redaction" && pe.getAssociatedId() === e.getId();
            });
            if (pendingRedaction) {
                e.markLocallyRedacted(pendingRedaction);
            }
        }
    }

    componentDidMount() {
        this.loadMoreEdits();
    }

    _renderEdits() {
        const EditHistoryMessage = sdk.getComponent('messages.EditHistoryMessage');
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const nodes = [];
        let lastEvent;
        let allEvents = this.state.events;
        // append original event when we've done last pagination
        if (this.state.originalEvent && !this.state.nextBatch) {
            allEvents = allEvents.concat(this.state.originalEvent);
        }
        const baseEventId = this.props.mxEvent.getId();
        allEvents.forEach((e, i) => {
            if (!lastEvent || wantsDateSeparator(lastEvent.getDate(), e.getDate())) {
                nodes.push(<li key={e.getTs() + "~"}><DateSeparator ts={e.getTs()} /></li>);
            }
            const isBaseEvent = e.getId() === baseEventId;
            nodes.push((
                <EditHistoryMessage
                    key={e.getId()}
                    previousEdit={!isBaseEvent ? allEvents[i + 1] : null}
                    isBaseEvent={isBaseEvent}
                    mxEvent={e}
                    isTwelveHour={this.state.isTwelveHour}
                />));
            lastEvent = e;
        });
        return nodes;
    }

    render() {
        let content;
        if (this.state.error) {
            const {error} = this.state;
            if (error.errcode === "M_UNRECOGNIZED") {
                content = (<p className="mx_MessageEditHistoryDialog_error">
                    {_t("Your homeserver doesn't seem to support this feature.")}
                </p>);
            } else if (error.errcode) {
                // some kind of error from the homeserver
                content = (<p className="mx_MessageEditHistoryDialog_error">
                    {_t("Something went wrong!")}
                </p>);
            } else {
                content = (<p className="mx_MessageEditHistoryDialog_error">
                    {_t("Cannot reach homeserver")}
                    <br />
                    {_t("Ensure you have a stable internet connection, or get in touch with the server admin")}
                </p>);
            }
        } else if (this.state.isLoading) {
            const Spinner = sdk.getComponent("elements.Spinner");
            content = <Spinner />;
        } else {
            const ScrollPanel = sdk.getComponent("structures.ScrollPanel");
            content = (<ScrollPanel
                className="mx_MessageEditHistoryDialog_scrollPanel"
                onFillRequest={ this.loadMoreEdits }
                stickyBottom={false}
                startAtBottom={false}
            >
                <ul className="mx_MessageEditHistoryDialog_edits mx_MessagePanel_alwaysShowTimestamps">{this._renderEdits()}</ul>
            </ScrollPanel>);
        }
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className='mx_MessageEditHistoryDialog' hasCancel={true}
                        onFinished={this.props.onFinished} title={_t("Message edits")}>
                {content}
            </BaseDialog>
        );
    }
}
