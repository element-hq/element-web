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

// For URLs of matrix.to links in the timeline which have been reformatted by
// HttpUtils transformTags to relative links. This excludes event URLs (with `[^\/]*`)
const REGEX_LOCAL_MATRIXTO = /^#\/room\/([\#\!][^\/]*)\/(\$[^\/]*)$/;

export default class Quote extends React.Component {
    static isMessageUrl(url) {
        return !!REGEX_LOCAL_MATRIXTO.exec(url);
    }

    static childContextTypes = {
        matrixClient: PropTypes.object,
        addRichQuote: PropTypes.func,
    };

    static propTypes = {
        // The matrix.to url of the event
        url: PropTypes.string,
        // The original node that was rendered
        node: PropTypes.instanceOf(Element),
        // The parent event
        parentEv: PropTypes.instanceOf(MatrixEvent),
    };

    constructor(props, context) {
        super(props, context);

        this.state = {
            // The event related to this quote and their nested rich quotes
            events: [],
            // Whether the top (oldest) event should be shown or spoilered
            show: true,
            // Whether an error was encountered fetching nested older event, show node if it does
            err: false,
        };

        this.onQuoteClick = this.onQuoteClick.bind(this);
        this.addRichQuote = this.addRichQuote.bind(this);
    }

    getChildContext() {
        return {
            matrixClient: MatrixClientPeg.get(),
            addRichQuote: this.addRichQuote,
        };
    }

    parseUrl(url) {
        if (!url) return;

        // Default to the empty array if no match for simplicity
        // resource and prefix will be undefined instead of throwing
        const matrixToMatch = REGEX_LOCAL_MATRIXTO.exec(url) || [];

        const [, roomIdentifier, eventId] = matrixToMatch;
        return {roomIdentifier, eventId};
    }

    componentWillReceiveProps(nextProps) {
        const {roomIdentifier, eventId} = this.parseUrl(nextProps.url);
        if (!roomIdentifier || !eventId) return;

        const room = this.getRoom(roomIdentifier);
        if (!room) return;

        // Only try and load the event if we know about the room
        // otherwise we just leave a `Quote` anchor which can be used to navigate/join the room manually.
        this.setState({ events: [] });
        if (room) this.getEvent(room, eventId, true);
    }

    componentWillMount() {
        this.componentWillReceiveProps(this.props);
    }

    getRoom(id) {
        const cli = MatrixClientPeg.get();
        if (id[0] === '!') return cli.getRoom(id);

        return cli.getRooms().find((r) => {
            return r.getAliases().includes(id);
        });
    }

    async getEvent(room, eventId, show) {
        const event = room.findEventById(eventId);
        if (event) {
            this.addEvent(event, show);
            return;
        }

        await MatrixClientPeg.get().getEventTimeline(room.getUnfilteredTimelineSet(), eventId);
        this.addEvent(room.findEventById(eventId), show);
    }

    addEvent(event, show) {
        const events = [event].concat(this.state.events);
        this.setState({events, show});
    }

    // addRichQuote(roomId, eventId) {
    addRichQuote(href) {
        const {roomIdentifier, eventId} = this.parseUrl(href);
        if (!roomIdentifier || !eventId) {
            this.setState({ err: true });
            return;
        }

        const room = this.getRoom(roomIdentifier);
        if (!room) {
            this.setState({ err: true });
            return;
        }

        this.getEvent(room, eventId, false);
    }

    onQuoteClick() {
        this.setState({ show: true });
    }

    render() {
        const events = this.state.events.slice();
        if (events.length) {
            const evTiles = [];

            if (!this.state.show) {
                const oldestEv = events.shift();
                const Pill = sdk.getComponent('elements.Pill');
                const room = MatrixClientPeg.get().getRoom(oldestEv.getRoomId());

                evTiles.push(<blockquote className="mx_Quote" key="load">
                    {
                        _t('<a>In reply to</a> <pill>', {}, {
                            'a': (sub) => <a onClick={this.onQuoteClick} className="mx_Quote_show">{ sub }</a>,
                            'pill': <Pill type={Pill.TYPE_USER_MENTION} room={room}
                                          url={makeUserPermalink(oldestEv.getSender())} shouldShowPillAvatar={true} />,
                        })
                    }
                </blockquote>);
            }

            const EventTile = sdk.getComponent('views.rooms.EventTile');
            const DateSeparator = sdk.getComponent('messages.DateSeparator');
            events.forEach((ev) => {
                let dateSep = null;

                if (wantsDateSeparator(this.props.parentEv.getDate(), ev.getDate())) {
                    dateSep = <a href={this.props.url}><DateSeparator ts={ev.getTs()} /></a>;
                }

                evTiles.push(<blockquote className="mx_Quote" key={ev.getId()}>
                    { dateSep }
                    <EventTile mxEvent={ev} tileShape="quote" />
                </blockquote>);
            });

            return <div>{ evTiles }</div>;
        }

        // Deliberately render nothing if the URL isn't recognised
        // in case we get an undefined/falsey node, replace it with null to make React happy
        return this.props.node || null;
    }
}
