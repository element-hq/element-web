/*
Copyright 2017 New Vector Ltd

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
import sdk from '../../../index';
import {_t} from '../../../languageHandler';
import PropTypes from 'prop-types';
import MatrixClientPeg from '../../../MatrixClientPeg';
import {wantsDateSeparator} from '../../../DateUtils';
import {MatrixEvent} from 'matrix-js-sdk';
import {makeUserPermalink} from "../../../matrix-to";
import SettingsStore from "../../../settings/SettingsStore";

// This component does no cycle detection, simply because the only way to make such a cycle
// would be to craft event_id's, using a custom homeserver; even then the impact would be low
// as each event being loaded (after the first) is triggered by an explicit user action.
export default class Reply extends React.Component {
    static propTypes = {
        // The parent event
        parentEv: PropTypes.instanceOf(MatrixEvent),

        onWidgetLoad: PropTypes.func.isRequired,
    };

    constructor(props, context) {
        super(props, context);

        this.state = {
            // The loaded events to be rendered as linear-replies
            events: [],

            // The latest loaded event which has not yet been shown
            loadedEv: null,
            // Whether the component is still loading more events
            loading: true,

            // Whether as error was encountered fetching a replied to event.
            err: false,
        };

        this.onQuoteClick = this.onQuoteClick.bind(this);

        this.unmounted = false;
    }

    componentWillMount() {
        this.room = this.getRoom(this.props.parentEv.getRoomId());
        this.initialize();
    }

    componentWillUnmount() {
        this.unmounted = true;
    }

    async initialize() {
        const {parentEv} = this.props;
        const inReplyTo = Reply.getInReplyTo(parentEv);

        const ev = await this.getEvent(this.room, inReplyTo['event_id']);
        if (this.unmounted) return;

        if (ev) {
            this.setState({
                events: [ev],
            }, this.loadNextEvent);
        } else {
            this.setState({err: true});
        }
    }

    async loadNextEvent() {
        this.props.onWidgetLoad();
        const ev = this.state.events[0];
        const inReplyTo = Reply.getInReplyTo(ev);

        if (!inReplyTo) {
            if (this.unmounted) return;
            this.setState({
                loading: false,
            });
            return;
        }

        const loadedEv = await this.getEvent(this.room, inReplyTo['event_id']);
        if (this.unmounted) return;

        if (loadedEv) {
            this.setState({loadedEv});
        } else {
            this.setState({err: true});
        }
    }

    getRoom(id) {
        const cli = MatrixClientPeg.get();
        if (id[0] === '!') return cli.getRoom(id);

        return cli.getRooms().find((r) => {
            return r.getAliases().includes(id);
        });
    }

    async getEvent(room, eventId) {
        const event = room.findEventById(eventId);
        if (event) return event;

        try {
            await MatrixClientPeg.get().getEventTimeline(room.getUnfilteredTimelineSet(), eventId);
        } catch (e) {
            return;
        }
        return room.findEventById(eventId);
    }

    onQuoteClick() {
        const events = [this.state.loadedEv].concat(this.state.events);

        this.setState({
            loadedEv: null,
            events,
        }, this.loadNextEvent);
    }

    static getInReplyTo(ev) {
        if (ev.isRedacted()) return;

        const mRelatesTo = ev.getWireContent()['m.relates_to'];
        if (mRelatesTo && mRelatesTo['m.in_reply_to']) {
            const mInReplyTo = mRelatesTo['m.in_reply_to'];
            if (mInReplyTo['event_id']) return mInReplyTo;
        }
    }

    static getRelationship(ev) {
        return {
            'm.relates_to': {
                'm.in_reply_to': {
                    'event_id': ev.getId(),
                },
            },
        };
    }

    static getQuote(parentEv, onWidgetLoad) {
        if (!SettingsStore.isFeatureEnabled("feature_rich_quoting") || !Reply.getInReplyTo(parentEv)) return null;
        return <Reply parentEv={parentEv} onWidgetLoad={onWidgetLoad} />;
    }

    render() {
        let header = null;

        if (this.state.err) {
            header = <blockquote className="mx_Reply mx_Reply_error">
                {
                    _t('Unable to load event that was replied to, ' +
                        'it either does not exist or you do not have permission to view it.')
                }
            </blockquote>;
        } else if (this.state.loadedEv) {
            const ev = this.state.loadedEv;
            const Pill = sdk.getComponent('elements.Pill');
            const room = MatrixClientPeg.get().getRoom(ev.getRoomId());
            header = <blockquote className="mx_Reply">
                {
                    _t('<a>In reply to</a> <pill>', {}, {
                        'a': (sub) => <a onClick={this.onQuoteClick} className="mx_Reply_show">{ sub }</a>,
                        'pill': <Pill type={Pill.TYPE_USER_MENTION} room={room}
                                      url={makeUserPermalink(ev.getSender())} shouldShowPillAvatar={true} />,
                    })
                }
            </blockquote>;
        } else if (this.state.loading) {
            const Spinner = sdk.getComponent("elements.Spinner");
            header = <Spinner w={16} h={16} />;
        }

        const EventTile = sdk.getComponent('views.rooms.EventTile');
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const evTiles = this.state.events.map((ev) => {
            let dateSep = null;

            if (wantsDateSeparator(this.props.parentEv.getDate(), ev.getDate())) {
                dateSep = <a href={this.props.url}><DateSeparator ts={ev.getTs()} /></a>;
            }

            return <blockquote className="mx_Reply" key={ev.getId()}>
                { dateSep }
                <EventTile mxEvent={ev}
                           tileShape="reply"
                           onWidgetLoad={this.props.onWidgetLoad}
                           isTwelveHour={SettingsStore.getValue("showTwelveHourTimestamps")} />
            </blockquote>;
        });

        return <div>
            <div>{ header }</div>
            <div>{ evTiles }</div>
        </div>;
    }
}
