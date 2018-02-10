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

export default class Quote extends React.Component {
    static propTypes = {
        // The parent event
        parentEv: PropTypes.instanceOf(MatrixEvent),

        onWidgetLoad: PropTypes.func.isRequired,
    };

    constructor(props, context) {
        super(props, context);

        /*
        this.state = {
            // The event related to this quote and their nested rich quotes
            events: [],
            // Whether the top (oldest) event should be shown or spoilered
            show: true,
            // Whether an error was encountered fetching nested older event, show node if it does
            err: false,
            loading: true,
        };*/

        this.state = {
            // The loaded events to be rendered as linear-replies
            events: [],

            // The latest loaded event which has not yet been shown
            loadedEv: null,
            // Whether the component is still loading more events
            loading: true,

            // Whether as error was encountered fetching a replied to event.
            err: null,
        };

        this.onQuoteClick = this.onQuoteClick.bind(this);
    }

    componentWillMount() {
        this.room = this.getRoom(this.props.parentEv.getRoomId());
        this.initialize();
    }

    async initialize() {
        const {parentEv} = this.props;
        const inReplyTo = Quote.getInReplyTo(parentEv);

        const ev = await this.getEvent(this.room, inReplyTo['event_id']);
        this.setState({
            events: [ev],
        }, this.loadNextEvent);
    }

    async loadNextEvent() {
        this.props.onWidgetLoad();
        const ev = this.state.events[0];
        const inReplyTo = Quote.getInReplyTo(ev);

        if (!inReplyTo) {
            this.setState({
                loading: false,
            });
            return;
        }

        const loadedEv = await this.getEvent(this.room, inReplyTo['event_id']);
        this.setState({loadedEv});
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

        await MatrixClientPeg.get().getEventTimeline(room.getUnfilteredTimelineSet(), eventId);
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
        if (mRelatesTo) {
            const mInReplyTo = mRelatesTo['m.in_reply_to'];
            if ('event_id' in mInReplyTo) return mInReplyTo;
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
        if (!SettingsStore.isFeatureEnabled("feature_rich_quoting") || !Quote.getInReplyTo(parentEv)) return null;
        return <Quote parentEv={parentEv} onWidgetLoad={onWidgetLoad} />;
    }

    render() {
        let header = null;
        if (this.state.loadedEv) {
            const ev = this.state.loadedEv;
            const Pill = sdk.getComponent('elements.Pill');
            const room = MatrixClientPeg.get().getRoom(ev.getRoomId());
            header = <blockquote className="mx_Quote">
                {
                    _t('<a>In reply to</a> <pill>', {}, {
                        'a': (sub) => <a onClick={this.onQuoteClick} className="mx_Quote_show">{ sub }</a>,
                        'pill': <Pill type={Pill.TYPE_USER_MENTION} room={room}
                                      url={makeUserPermalink(ev.getSender())} shouldShowPillAvatar={true} />,
                    })
                }
            </blockquote>;
        } else if (this.state.loading) {
            header = <blockquote>LOADING...</blockquote>;
        }

        const EventTile = sdk.getComponent('views.rooms.EventTile');
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const evTiles = this.state.events.map((ev) => {
            let dateSep = null;

            if (wantsDateSeparator(this.props.parentEv.getDate(), ev.getDate())) {
                dateSep = <a href={this.props.url}><DateSeparator ts={ev.getTs()} /></a>;
            }

            return <blockquote className="mx_Quote" key={ev.getId()}>
                { dateSep }
                <EventTile mxEvent={ev} tileShape="quote" />
            </blockquote>;
        });

        return <div>
            <div>{ header }</div>
            <div>{ evTiles }</div>
        </div>;
    }
}
