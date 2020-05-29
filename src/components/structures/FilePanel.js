/*
Copyright 2016 OpenMarket Ltd
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
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';

import {Filter} from 'matrix-js-sdk';
import * as sdk from '../../index';
import {MatrixClientPeg} from '../../MatrixClientPeg';
import EventIndexPeg from "../../indexing/EventIndexPeg";
import { _t } from '../../languageHandler';

/*
 * Component which shows the filtered file using a TimelinePanel
 */
const FilePanel = createReactClass({
    displayName: 'FilePanel',
    // This is used to track if a decrypted event was a live event and should be
    // added to the timeline.
    decryptingEvents: new Set(),

    propTypes: {
        roomId: PropTypes.string.isRequired,
    },

    getInitialState: function() {
        return {
            timelineSet: null,
        };
    },

    onRoomTimeline(ev, room, toStartOfTimeline, removed, data) {
        if (room.roomId !== this.props.roomId) return;
        if (toStartOfTimeline || !data || !data.liveEvent || ev.isRedacted()) return;

        if (ev.isBeingDecrypted()) {
            this.decryptingEvents.add(ev.getId());
        } else {
            this.addEncryptedLiveEvent(ev);
        }
    },

    onEventDecrypted(ev, err) {
        if (ev.getRoomId() !== this.props.roomId) return;
        const eventId = ev.getId();

        if (!this.decryptingEvents.delete(eventId)) return;
        if (err) return;

        this.addEncryptedLiveEvent(ev);
    },

    addEncryptedLiveEvent(ev, toStartOfTimeline) {
        if (!this.state.timelineSet) return;

        const timeline = this.state.timelineSet.getLiveTimeline();
        if (ev.getType() !== "m.room.message") return;
        if (["m.file", "m.image", "m.video", "m.audio"].indexOf(ev.getContent().msgtype) == -1) {
            return;
        }

        if (!this.state.timelineSet.eventIdToTimeline(ev.getId())) {
            this.state.timelineSet.addEventToTimeline(ev, timeline, false);
        }
    },

    async componentDidMount() {
        const client = MatrixClientPeg.get();

        await this.updateTimelineSet(this.props.roomId);

        if (!MatrixClientPeg.get().isRoomEncrypted(this.props.roomId)) return;

        // The timelineSets filter makes sure that encrypted events that contain
        // URLs never get added to the timeline, even if they are live events.
        // These methods are here to manually listen for such events and add
        // them despite the filter's best efforts.
        //
        // We do this only for encrypted rooms and if an event index exists,
        // this could be made more general in the future or the filter logic
        // could be fixed.
        if (EventIndexPeg.get() !== null) {
            client.on('Room.timeline', this.onRoomTimeline);
            client.on('Event.decrypted', this.onEventDecrypted);
        }
    },

    componentWillUnmount() {
        const client = MatrixClientPeg.get();
        if (client === null) return;

        if (!MatrixClientPeg.get().isRoomEncrypted(this.props.roomId)) return;

        if (EventIndexPeg.get() !== null) {
            client.removeListener('Room.timeline', this.onRoomTimeline);
            client.removeListener('Event.decrypted', this.onEventDecrypted);
        }
    },

    async fetchFileEventsServer(room) {
        const client = MatrixClientPeg.get();

        const filter = new Filter(client.credentials.userId);
        filter.setDefinition(
            {
                "room": {
                    "timeline": {
                        "contains_url": true,
                        "types": [
                            "m.room.message",
                        ],
                    },
                },
            },
        );

        const filterId = await client.getOrCreateFilter("FILTER_FILES_" + client.credentials.userId, filter);
        filter.filterId = filterId;
        const timelineSet = room.getOrCreateFilteredTimelineSet(filter);

        return timelineSet;
    },

    onPaginationRequest(timelineWindow, direction, limit) {
        const client = MatrixClientPeg.get();
        const eventIndex = EventIndexPeg.get();
        const roomId = this.props.roomId;

        const room = client.getRoom(roomId);

        // We override the pagination request for encrypted rooms so that we ask
        // the event index to fulfill the pagination request. Asking the server
        // to paginate won't ever work since the server can't correctly filter
        // out events containing URLs
        if (client.isRoomEncrypted(roomId) && eventIndex !== null) {
            return eventIndex.paginateTimelineWindow(room, timelineWindow, direction, limit);
        } else {
            return timelineWindow.paginate(direction, limit);
        }
    },

    async updateTimelineSet(roomId: string) {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(roomId);
        const eventIndex = EventIndexPeg.get();

        this.noRoom = !room;

        if (room) {
            let timelineSet;

            try {
                timelineSet = await this.fetchFileEventsServer(room);

                // If this room is encrypted the file panel won't be populated
                // correctly since the defined filter doesn't support encrypted
                // events and the server can't check if encrypted events contain
                // URLs.
                //
                // This is where our event index comes into place, we ask the
                // event index to populate the timelineSet for us. This call
                // will add 10 events to the live timeline of the set. More can
                // be requested using pagination.
                if (client.isRoomEncrypted(roomId) && eventIndex !== null) {
                    const timeline = timelineSet.getLiveTimeline();
                    await eventIndex.populateFileTimeline(timelineSet, timeline, room, 10);
                }

                this.setState({ timelineSet: timelineSet });
            } catch (error) {
                console.error("Failed to get or create file panel filter", error);
            }
        } else {
            console.error("Failed to add filtered timelineSet for FilePanel as no room!");
        }
    },

    render: function() {
        if (MatrixClientPeg.get().isGuest()) {
            return <div className="mx_FilePanel mx_RoomView_messageListWrapper">
                <div className="mx_RoomView_empty">
                { _t("You must <a>register</a> to use this functionality",
                    {},
                    { 'a': (sub) => <a href="#/register" key="sub">{ sub }</a> })
                }
                </div>
            </div>;
        } else if (this.noRoom) {
            return <div className="mx_FilePanel mx_RoomView_messageListWrapper">
                <div className="mx_RoomView_empty">{ _t("You must join the room to see its files") }</div>
            </div>;
        }

        // wrap a TimelinePanel with the jump-to-event bits turned off.
        const TimelinePanel = sdk.getComponent("structures.TimelinePanel");
        const Loader = sdk.getComponent("elements.Spinner");

        if (this.state.timelineSet) {
            // console.log("rendering TimelinePanel for timelineSet " + this.state.timelineSet.room.roomId + " " +
            //             "(" + this.state.timelineSet._timelines.join(", ") + ")" + " with key " + this.props.roomId);
            return (
                <div className="mx_FilePanel" role="tabpanel">
                    <TimelinePanel key={"filepanel_" + this.props.roomId}
                        manageReadReceipts={false}
                        manageReadMarkers={false}
                        timelineSet={this.state.timelineSet}
                        showUrlPreview = {false}
                        onPaginationRequest={this.onPaginationRequest}
                        tileShape="file_grid"
                        resizeNotifier={this.props.resizeNotifier}
                        empty={_t('There are no visible files in this room')}
                    />
                </div>
            );
        } else {
            return (
                <div className="mx_FilePanel" role="tabpanel">
                    <Loader />
                </div>
            );
        }
    },
});

export default FilePanel;
