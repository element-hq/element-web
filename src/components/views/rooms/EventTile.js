/*
Copyright 2015, 2016 OpenMarket Ltd
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

'use strict';


const React = require('react');
import PropTypes from 'prop-types';
const classNames = require("classnames");
import { _t, _td } from '../../../languageHandler';
const Modal = require('../../../Modal');

const sdk = require('../../../index');
const TextForEvent = require('../../../TextForEvent');
import withMatrixClient from '../../../wrappers/withMatrixClient';

const ContextualMenu = require('../../structures/ContextualMenu');
import dis from '../../../dispatcher';
import {makeEventPermalink} from "../../../matrix-to";

const ObjectUtils = require('../../../ObjectUtils');

const eventTileTypes = {
    'm.room.message': 'messages.MessageEvent',
    'm.sticker': 'messages.MessageEvent',
    'm.call.invite': 'messages.TextualEvent',
    'm.call.answer': 'messages.TextualEvent',
    'm.call.hangup': 'messages.TextualEvent',
};

const stateEventTileTypes = {
    'm.room.member': 'messages.TextualEvent',
    'm.room.name': 'messages.TextualEvent',
    'm.room.avatar': 'messages.RoomAvatarEvent',
    'm.room.third_party_invite': 'messages.TextualEvent',
    'm.room.history_visibility': 'messages.TextualEvent',
    'm.room.encryption': 'messages.TextualEvent',
    'm.room.topic': 'messages.TextualEvent',
    'm.room.power_levels': 'messages.TextualEvent',
    'm.room.pinned_events': 'messages.TextualEvent',

    'im.vector.modular.widgets': 'messages.TextualEvent',
};

function getHandlerTile(ev) {
    const type = ev.getType();
    return ev.isState() ? stateEventTileTypes[type] : eventTileTypes[type];
}

const MAX_READ_AVATARS = 5;

// Our component structure for EventTiles on the timeline is:
//
// .-EventTile------------------------------------------------.
// | MemberAvatar (SenderProfile)                   TimeStamp |
// |    .-{Message,Textual}Event---------------. Read Avatars |
// |    |   .-MFooBody-------------------.     |              |
// |    |   |  (only if MessageEvent)    |     |              |
// |    |   '----------------------------'     |              |
// |    '--------------------------------------'              |
// '----------------------------------------------------------'

module.exports = withMatrixClient(React.createClass({
    displayName: 'EventTile',

    propTypes: {
        /* MatrixClient instance for sender verification etc */
        matrixClient: PropTypes.object.isRequired,

        /* the MatrixEvent to show */
        mxEvent: PropTypes.object.isRequired,

        /* true if mxEvent is redacted. This is a prop because using mxEvent.isRedacted()
         * might not be enough when deciding shouldComponentUpdate - prevProps.mxEvent
         * references the same this.props.mxEvent.
         */
        isRedacted: PropTypes.bool,

        /* true if this is a continuation of the previous event (which has the
         * effect of not showing another avatar/displayname
         */
        continuation: PropTypes.bool,

        /* true if this is the last event in the timeline (which has the effect
         * of always showing the timestamp)
         */
        last: PropTypes.bool,

        /* true if this is search context (which has the effect of greying out
         * the text
         */
        contextual: PropTypes.bool,

        /* a list of words to highlight, ordered by longest first */
        highlights: PropTypes.array,

        /* link URL for the highlights */
        highlightLink: PropTypes.string,

        /* should show URL previews for this event */
        showUrlPreview: PropTypes.bool,

        /* is this the focused event */
        isSelectedEvent: PropTypes.bool,

        /* callback called when dynamic content in events are loaded */
        onWidgetLoad: PropTypes.func,

        /* a list of read-receipts we should show. Each object has a 'roomMember' and 'ts'. */
        readReceipts: PropTypes.arrayOf(React.PropTypes.object),

        /* opaque readreceipt info for each userId; used by ReadReceiptMarker
         * to manage its animations. Should be an empty object when the room
         * first loads
         */
        readReceiptMap: PropTypes.object,

        /* A function which is used to check if the parent panel is being
         * unmounted, to avoid unnecessary work. Should return true if we
         * are being unmounted.
         */
        checkUnmounting: PropTypes.func,

        /* the status of this event - ie, mxEvent.status. Denormalised to here so
         * that we can tell when it changes. */
        eventSendStatus: PropTypes.string,

        /* the shape of the tile. by default, the layout is intended for the
         * normal room timeline.  alternative values are: "file_list", "file_grid"
         * and "notif".  This could be done by CSS, but it'd be horribly inefficient.
         * It could also be done by subclassing EventTile, but that'd be quite
         * boiilerplatey.  So just make the necessary render decisions conditional
         * for now.
         */
        tileShape: PropTypes.string,

        // show twelve hour timestamps
        isTwelveHour: PropTypes.bool,
    },

    getInitialState: function() {
        return {menu: false, allReadAvatars: false, verified: null};
    },

    componentWillMount: function() {
        // don't do RR animations until we are mounted
        this._suppressReadReceiptAnimation = true;
        this._verifyEvent(this.props.mxEvent);
    },

    componentDidMount: function() {
        this._suppressReadReceiptAnimation = false;
        this.props.matrixClient.on("deviceVerificationChanged",
                                 this.onDeviceVerificationChanged);
        this.props.mxEvent.on("Event.decrypted", this._onDecrypted);
    },

    componentWillReceiveProps: function(nextProps) {
        // re-check the sender verification as outgoing events progress through
        // the send process.
        if (nextProps.eventSendStatus !== this.props.eventSendStatus) {
            this._verifyEvent(nextProps.mxEvent);
        }
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        if (!ObjectUtils.shallowEqual(this.state, nextState)) {
            return true;
        }

        if (!this._propsEqual(this.props, nextProps)) {
            return true;
        }

        return false;
    },

    componentWillUnmount: function() {
        const client = this.props.matrixClient;
        client.removeListener("deviceVerificationChanged",
                              this.onDeviceVerificationChanged);
        this.props.mxEvent.removeListener("Event.decrypted", this._onDecrypted);
    },

    /** called when the event is decrypted after we show it.
     */
    _onDecrypted: function() {
        // we need to re-verify the sending device.
        // (we call onWidgetLoad in _verifyEvent to handle the case where decryption
        // has caused a change in size of the event tile)
        this._verifyEvent(this.props.mxEvent);
        this.forceUpdate();
    },

    onDeviceVerificationChanged: function(userId, device) {
        if (userId == this.props.mxEvent.getSender()) {
            this._verifyEvent(this.props.mxEvent);
        }
    },

    _verifyEvent: async function(mxEvent) {
        if (!mxEvent.isEncrypted()) {
            return;
        }

        const verified = await this.props.matrixClient.isEventSenderVerified(mxEvent);
        this.setState({
            verified: verified,
        }, () => {
            // Decryption may have caused a change in size
            this.props.onWidgetLoad();
        });
    },

    _propsEqual: function(objA, objB) {
        const keysA = Object.keys(objA);
        const keysB = Object.keys(objB);

        if (keysA.length !== keysB.length) {
            return false;
        }

        for (let i = 0; i < keysA.length; i++) {
            const key = keysA[i];

            if (!objB.hasOwnProperty(key)) {
                return false;
            }

            // need to deep-compare readReceipts
            if (key == 'readReceipts') {
                const rA = objA[key];
                const rB = objB[key];
                if (rA === rB) {
                    continue;
                }

                if (!rA || !rB) {
                    return false;
                }

                if (rA.length !== rB.length) {
                    return false;
                }
                for (let j = 0; j < rA.length; j++) {
                    if (rA[j].roomMember.userId !== rB[j].roomMember.userId) {
                        return false;
                    }
                }
            } else {
                if (objA[key] !== objB[key]) {
                    return false;
                }
            }
        }
        return true;
    },

    shouldHighlight: function() {
        const actions = this.props.matrixClient.getPushActionsForEvent(this.props.mxEvent);
        if (!actions || !actions.tweaks) { return false; }

        // don't show self-highlights from another of our clients
        if (this.props.mxEvent.getSender() === this.props.matrixClient.credentials.userId) {
            return false;
        }

        return actions.tweaks.highlight;
    },

    onEditClicked: function(e) {
        const MessageContextMenu = sdk.getComponent('context_menus.MessageContextMenu');
        const buttonRect = e.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = buttonRect.right + window.pageXOffset;
        const y = (buttonRect.top + (buttonRect.height / 2) + window.pageYOffset) - 19;
        const self = this;
        ContextualMenu.createMenu(MessageContextMenu, {
            chevronOffset: 10,
            mxEvent: this.props.mxEvent,
            left: x,
            top: y,
            eventTileOps: this.refs.tile && this.refs.tile.getEventTileOps ? this.refs.tile.getEventTileOps() : undefined,
            onFinished: function() {
                self.setState({menu: false});
            },
        });
        this.setState({menu: true});
    },

    toggleAllReadAvatars: function() {
        this.setState({
            allReadAvatars: !this.state.allReadAvatars,
        });
    },

    getReadAvatars: function() {
        // return early if there are no read receipts
        if (!this.props.readReceipts || this.props.readReceipts.length === 0) {
            return (<span className="mx_EventTile_readAvatars"></span>);
        }

        const ReadReceiptMarker = sdk.getComponent('rooms.ReadReceiptMarker');
        const avatars = [];
        const receiptOffset = 15;
        let left = 0;

        const receipts = this.props.readReceipts || [];
        for (let i = 0; i < receipts.length; ++i) {
            const receipt = receipts[i];

            let hidden = true;
            if ((i < MAX_READ_AVATARS) || this.state.allReadAvatars) {
                hidden = false;
            }
            // TODO: we keep the extra read avatars in the dom to make animation simpler
            // we could optimise this to reduce the dom size.

            // If hidden, set offset equal to the offset of the final visible avatar or
            // else set it proportional to index
            left = (hidden ? MAX_READ_AVATARS - 1 : i) * -receiptOffset;

            const userId = receipt.roomMember.userId;
            var readReceiptInfo;

            if (this.props.readReceiptMap) {
                readReceiptInfo = this.props.readReceiptMap[userId];
                if (!readReceiptInfo) {
                    readReceiptInfo = {};
                    this.props.readReceiptMap[userId] = readReceiptInfo;
                }
            }

            // add to the start so the most recent is on the end (ie. ends up rightmost)
            avatars.unshift(
                <ReadReceiptMarker key={userId} member={receipt.roomMember}
                    leftOffset={left} hidden={hidden}
                    readReceiptInfo={readReceiptInfo}
                    checkUnmounting={this.props.checkUnmounting}
                    suppressAnimation={this._suppressReadReceiptAnimation}
                    onClick={this.toggleAllReadAvatars}
                    timestamp={receipt.ts}
                    showTwelveHour={this.props.isTwelveHour}
                />,
            );
        }
        let remText;
        if (!this.state.allReadAvatars) {
            const remainder = receipts.length - MAX_READ_AVATARS;
            if (remainder > 0) {
                remText = <span className="mx_EventTile_readAvatarRemainder"
                    onClick={this.toggleAllReadAvatars}
                    style={{ right: -(left - receiptOffset) }}>{ remainder }+
                </span>;
            }
        }

        return <span className="mx_EventTile_readAvatars">
            { remText }
            { avatars }
        </span>;
    },

    onSenderProfileClick: function(event) {
        const mxEvent = this.props.mxEvent;
        dis.dispatch({
            action: 'insert_mention',
            user_id: mxEvent.getSender(),
        });
    },

    onCryptoClicked: function(e) {
        const event = this.props.mxEvent;

        Modal.createTrackedDialogAsync('Encrypted Event Dialog', '', (cb) => {
            require(['../../../async-components/views/dialogs/EncryptedEventDialog'], cb);
        }, {
            event: event,
        });
    },

    onPermalinkClicked: function(e) {
        // This allows the permalink to be opened in a new tab/window or copied as
        // matrix.to, but also for it to enable routing within Riot when clicked.
        e.preventDefault();
        dis.dispatch({
            action: 'view_room',
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
        });
    },

    _renderE2EPadlock: function() {
        const ev = this.props.mxEvent;
        const props = {onClick: this.onCryptoClicked};


        if (ev.getContent().msgtype === 'm.bad.encrypted') {
            return <E2ePadlockUndecryptable {...props} />;
        } else if (ev.isEncrypted()) {
            if (this.state.verified) {
                return <E2ePadlockVerified {...props} />;
            } else {
                return <E2ePadlockUnverified {...props} />;
            }
        } else {
            // XXX: if the event is being encrypted (ie eventSendStatus ===
            // encrypting), it might be nice to show something other than the
            // open padlock?

            // if the event is not encrypted, but it's an e2e room, show the
            // open padlock
            const e2eEnabled = this.props.matrixClient.isRoomEncrypted(ev.getRoomId());
            if (e2eEnabled) {
                return <E2ePadlockUnencrypted {...props} />;
            }
        }

        // no padlock needed
        return null;
    },

    render: function() {
        const MessageTimestamp = sdk.getComponent('messages.MessageTimestamp');
        const SenderProfile = sdk.getComponent('messages.SenderProfile');
        const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');

        //console.log("EventTile showUrlPreview for %s is %s", this.props.mxEvent.getId(), this.props.showUrlPreview);

        const content = this.props.mxEvent.getContent();
        const msgtype = content.msgtype;
        const eventType = this.props.mxEvent.getType();

        // Info messages are basically information about commands processed on a room
        // For now assume that anything that doesn't have a content body is an isInfoMessage
        const isInfoMessage = !content.body; // Boolean comparison of non-boolean content body

        const EventTileType = sdk.getComponent(getHandlerTile(this.props.mxEvent));
        // This shouldn't happen: the caller should check we support this type
        // before trying to instantiate us
        if (!EventTileType) {
            throw new Error("Event type not supported");
        }

        const isSending = (['sending', 'queued', 'encrypting'].indexOf(this.props.eventSendStatus) !== -1);
        const isRedacted = (eventType === 'm.room.message') && this.props.isRedacted;

        const classes = classNames({
            mx_EventTile: true,
            mx_EventTile_info: isInfoMessage,
            mx_EventTile_12hr: this.props.isTwelveHour,
            mx_EventTile_encrypting: this.props.eventSendStatus == 'encrypting',
            mx_EventTile_sending: isSending,
            mx_EventTile_notSent: this.props.eventSendStatus == 'not_sent',
            mx_EventTile_highlight: this.props.tileShape == 'notif' ? false : this.shouldHighlight(),
            mx_EventTile_selected: this.props.isSelectedEvent,
            mx_EventTile_continuation: this.props.tileShape ? '' : this.props.continuation,
            mx_EventTile_last: this.props.last,
            mx_EventTile_contextual: this.props.contextual,
            menu: this.state.menu,
            mx_EventTile_verified: this.state.verified == true,
            mx_EventTile_unverified: this.state.verified == false,
            mx_EventTile_bad: msgtype === 'm.bad.encrypted',
            mx_EventTile_emote: msgtype === 'm.emote',
            mx_EventTile_redacted: isRedacted,
        });

        const permalink = makeEventPermalink(this.props.mxEvent.getRoomId(), this.props.mxEvent.getId());

        const readAvatars = this.getReadAvatars();

        let avatar, sender;
        let avatarSize;
        let needsSenderProfile;

        if (this.props.tileShape === "notif") {
            avatarSize = 24;
            needsSenderProfile = true;
        } else if (isInfoMessage) {
            // a small avatar, with no sender profile, for
            // joins/parts/etc
            avatarSize = 14;
            needsSenderProfile = false;
        } else if (this.props.continuation && this.props.tileShape !== "file_grid") {
            // no avatar or sender profile for continuation messages
            avatarSize = 0;
            needsSenderProfile = false;
        } else {
            avatarSize = 30;
            needsSenderProfile = true;
        }

        if (this.props.mxEvent.sender && avatarSize) {
            avatar = (
                    <div className="mx_EventTile_avatar">
                        <MemberAvatar member={this.props.mxEvent.sender}
                            width={avatarSize} height={avatarSize}
                            viewUserOnClick={true}
                        />
                    </div>
            );
        }

        if (needsSenderProfile) {
            let text = null;
            if (!this.props.tileShape || this.props.tileShape === 'quote') {
                if (msgtype === 'm.image') text = _td('%(senderName)s sent an image');
                else if (msgtype === 'm.video') text = _td('%(senderName)s sent a video');
                else if (msgtype === 'm.file') text = _td('%(senderName)s uploaded a file');
                sender = <SenderProfile onClick={this.onSenderProfileClick} mxEvent={this.props.mxEvent} enableFlair={!text} text={text} />;
            } else {
                sender = <SenderProfile mxEvent={this.props.mxEvent} enableFlair={true} />;
            }
        }

        const editButton = (
            <span className="mx_EventTile_editButton" title={_t("Options")} onClick={this.onEditClicked} />
        );

        const timestamp = this.props.mxEvent.getTs() ?
            <MessageTimestamp showTwelveHour={this.props.isTwelveHour} ts={this.props.mxEvent.getTs()} /> : null;

        switch (this.props.tileShape) {
            case 'notif': {
                const room = this.props.matrixClient.getRoom(this.props.mxEvent.getRoomId());
                return (
                    <div className={classes}>
                        <div className="mx_EventTile_roomName">
                            <a href={permalink} onClick={this.onPermalinkClicked}>
                                { room ? room.name : '' }
                            </a>
                        </div>
                        <div className="mx_EventTile_senderDetails">
                            { avatar }
                            <a href={permalink} onClick={this.onPermalinkClicked}>
                                { sender }
                                { timestamp }
                            </a>
                        </div>
                        <div className="mx_EventTile_line" >
                            <EventTileType ref="tile"
                                           mxEvent={this.props.mxEvent}
                                           highlights={this.props.highlights}
                                           highlightLink={this.props.highlightLink}
                                           showUrlPreview={this.props.showUrlPreview}
                                           onWidgetLoad={this.props.onWidgetLoad} />
                        </div>
                    </div>
                );
            }
            case 'file_grid': {
                return (
                    <div className={classes}>
                        <div className="mx_EventTile_line" >
                            <EventTileType ref="tile"
                                           mxEvent={this.props.mxEvent}
                                           highlights={this.props.highlights}
                                           highlightLink={this.props.highlightLink}
                                           showUrlPreview={this.props.showUrlPreview}
                                           tileShape={this.props.tileShape}
                                           onWidgetLoad={this.props.onWidgetLoad} />
                        </div>
                        <a
                            className="mx_EventTile_senderDetailsLink"
                            href={permalink}
                            onClick={this.onPermalinkClicked}
                        >
                            <div className="mx_EventTile_senderDetails">
                                { sender }
                                { timestamp }
                            </div>
                        </a>
                    </div>
                );
            }
            case 'quote': {
                return (
                    <div className={classes}>
                        { avatar }
                        { sender }
                        <div className="mx_EventTile_line mx_EventTile_quote">
                            <a href={permalink} onClick={this.onPermalinkClicked}>
                                { timestamp }
                            </a>
                            { this._renderE2EPadlock() }
                            <EventTileType ref="tile"
                                           tileShape="quote"
                                           mxEvent={this.props.mxEvent}
                                           highlights={this.props.highlights}
                                           highlightLink={this.props.highlightLink}
                                           onWidgetLoad={this.props.onWidgetLoad}
                                           showUrlPreview={false} />
                        </div>
                    </div>
                );
            }
            default: {
                return (
                    <div className={classes}>
                        <div className="mx_EventTile_msgOption">
                            { readAvatars }
                        </div>
                        { avatar }
                        { sender }
                        <div className="mx_EventTile_line">
                            <a href={permalink} onClick={this.onPermalinkClicked}>
                                { timestamp }
                            </a>
                            { this._renderE2EPadlock() }
                            <EventTileType ref="tile"
                                           mxEvent={this.props.mxEvent}
                                           highlights={this.props.highlights}
                                           highlightLink={this.props.highlightLink}
                                           showUrlPreview={this.props.showUrlPreview}
                                           onWidgetLoad={this.props.onWidgetLoad} />
                            { editButton }
                        </div>
                    </div>
                );
            }
        }
    },
}));

module.exports.haveTileForEvent = function(e) {
    // Only messages have a tile (black-rectangle) if redacted
    if (e.isRedacted() && e.getType() !== 'm.room.message') return false;

    const handler = getHandlerTile(e);
    if (handler === undefined) return false;
    if (handler === 'messages.TextualEvent') {
        return TextForEvent.textForEvent(e) !== '';
    } else {
        return true;
    }
};

function E2ePadlockUndecryptable(props) {
    return (
        <E2ePadlock alt={_t("Undecryptable")}
            src="img/e2e-blocked.svg" width="12" height="12"
            style={{ marginLeft: "-1px" }} {...props} />
    );
}

function E2ePadlockVerified(props) {
    return (
        <E2ePadlock alt={_t("Encrypted by a verified device")}
            src="img/e2e-verified.svg" width="10" height="12"
            {...props} />
    );
}

function E2ePadlockUnverified(props) {
    return (
        <E2ePadlock alt={_t("Encrypted by an unverified device")}
            src="img/e2e-warning.svg" width="15" height="12"
            style={{ marginLeft: "-2px" }} {...props} />
    );
}

function E2ePadlockUnencrypted(props) {
    return (
        <E2ePadlock alt={_t("Unencrypted message")}
            src="img/e2e-unencrypted.svg" width="12" height="12"
            {...props} />
    );
}

function E2ePadlock(props) {
    return <img className="mx_EventTile_e2eIcon" {...props} />;
}

module.exports.getHandlerTile = getHandlerTile;
