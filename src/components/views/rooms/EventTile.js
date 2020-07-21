/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import ReplyThread from "../elements/ReplyThread";
import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import classNames from "classnames";
import { _t, _td } from '../../../languageHandler';
import * as TextForEvent from "../../../TextForEvent";
import * as sdk from "../../../index";
import dis from '../../../dispatcher/dispatcher';
import SettingsStore from "../../../settings/SettingsStore";
import {EventStatus} from 'matrix-js-sdk';
import {formatTime} from "../../../DateUtils";
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import {ALL_RULE_TYPES} from "../../../mjolnir/BanList";
import * as ObjectUtils from "../../../ObjectUtils";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import {E2E_STATE} from "./E2EIcon";
import {toRem} from "../../../utils/units";

const eventTileTypes = {
    'm.room.message': 'messages.MessageEvent',
    'm.sticker': 'messages.MessageEvent',
    'm.key.verification.cancel': 'messages.MKeyVerificationConclusion',
    'm.key.verification.done': 'messages.MKeyVerificationConclusion',
    'm.room.encryption': 'messages.EncryptionEvent',
    'm.call.invite': 'messages.TextualEvent',
    'm.call.answer': 'messages.TextualEvent',
    'm.call.hangup': 'messages.TextualEvent',
};

const stateEventTileTypes = {
    'm.room.encryption': 'messages.EncryptionEvent',
    'm.room.canonical_alias': 'messages.TextualEvent',
    'm.room.create': 'messages.RoomCreate',
    'm.room.member': 'messages.TextualEvent',
    'm.room.name': 'messages.TextualEvent',
    'm.room.avatar': 'messages.RoomAvatarEvent',
    'm.room.third_party_invite': 'messages.TextualEvent',
    'm.room.history_visibility': 'messages.TextualEvent',
    'm.room.topic': 'messages.TextualEvent',
    'm.room.power_levels': 'messages.TextualEvent',
    'm.room.pinned_events': 'messages.TextualEvent',
    'm.room.server_acl': 'messages.TextualEvent',
    // TODO: Enable support for m.widget event type (https://github.com/vector-im/riot-web/issues/13111)
    'im.vector.modular.widgets': 'messages.TextualEvent',
    'm.room.tombstone': 'messages.TextualEvent',
    'm.room.join_rules': 'messages.TextualEvent',
    'm.room.guest_access': 'messages.TextualEvent',
    'm.room.related_groups': 'messages.TextualEvent',
};

// Add all the Mjolnir stuff to the renderer
for (const evType of ALL_RULE_TYPES) {
    stateEventTileTypes[evType] = 'messages.TextualEvent';
}

export function getHandlerTile(ev) {
    const type = ev.getType();

    // don't show verification requests we're not involved in,
    // not even when showing hidden events
    if (type === "m.room.message") {
        const content = ev.getContent();
        if (content && content.msgtype === "m.key.verification.request") {
            const client = MatrixClientPeg.get();
            const me = client && client.getUserId();
            if (ev.getSender() !== me && content.to !== me) {
                return undefined;
            } else {
                return "messages.MKeyVerificationRequest";
            }
        }
    }
    // these events are sent by both parties during verification, but we only want to render one
    // tile once the verification concludes, so filter out the one from the other party.
    if (type === "m.key.verification.done") {
        const client = MatrixClientPeg.get();
        const me = client && client.getUserId();
        if (ev.getSender() !== me) {
            return undefined;
        }
    }

    // sometimes MKeyVerificationConclusion declines to render.  Jankily decline to render and
    // fall back to showing hidden events, if we're viewing hidden events
    // XXX: This is extremely a hack. Possibly these components should have an interface for
    // declining to render?
    if (type === "m.key.verification.cancel" || type === "m.key.verification.done") {
        const MKeyVerificationConclusion = sdk.getComponent("messages.MKeyVerificationConclusion");
        if (!MKeyVerificationConclusion.prototype._shouldRender.call(null, ev, ev.request)) {
            return;
        }
    }

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

export default createReactClass({
    displayName: 'EventTile',

    propTypes: {
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
        onHeightChanged: PropTypes.func,

        /* a list of read-receipts we should show. Each object has a 'roomMember' and 'ts'. */
        readReceipts: PropTypes.arrayOf(PropTypes.object),

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

        // helper function to access relations for this event
        getRelationsForEvent: PropTypes.func,

        // whether to show reactions for this event
        showReactions: PropTypes.bool,

        // whether to use the irc layout
        useIRCLayout: PropTypes.bool,
    },

    getDefaultProps: function() {
        return {
            // no-op function because onHeightChanged is optional yet some sub-components assume its existence
            onHeightChanged: function() {},
        };
    },

    getInitialState: function() {
        return {
            // Whether the action bar is focused.
            actionBarFocused: false,
            // Whether all read receipts are being displayed. If not, only display
            // a truncation of them.
            allReadAvatars: false,
            // Whether the event's sender has been verified.
            verified: null,
            // Whether onRequestKeysClick has been called since mounting.
            previouslyRequestedKeys: false,
            // The Relations model from the JS SDK for reactions to `mxEvent`
            reactions: this.getReactions(),
        };
    },

    statics: {
        contextType: MatrixClientContext,
    },

    // TODO: [REACT-WARNING] Replace component with real class, use constructor for refs
    UNSAFE_componentWillMount: function() {
        // don't do RR animations until we are mounted
        this._suppressReadReceiptAnimation = true;
        this._verifyEvent(this.props.mxEvent);

        this._tile = createRef();
        this._replyThread = createRef();
    },

    componentDidMount: function() {
        this._suppressReadReceiptAnimation = false;
        const client = this.context;
        client.on("deviceVerificationChanged", this.onDeviceVerificationChanged);
        client.on("userTrustStatusChanged", this.onUserVerificationChanged);
        this.props.mxEvent.on("Event.decrypted", this._onDecrypted);
        if (this.props.showReactions) {
            this.props.mxEvent.on("Event.relationsCreated", this._onReactionsCreated);
        }
    },

    // TODO: [REACT-WARNING] Replace with appropriate lifecycle event
    UNSAFE_componentWillReceiveProps: function(nextProps) {
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

        return !this._propsEqual(this.props, nextProps);
    },

    componentWillUnmount: function() {
        const client = this.context;
        client.removeListener("deviceVerificationChanged", this.onDeviceVerificationChanged);
        client.removeListener("userTrustStatusChanged", this.onUserVerificationChanged);
        this.props.mxEvent.removeListener("Event.decrypted", this._onDecrypted);
        if (this.props.showReactions) {
            this.props.mxEvent.removeListener("Event.relationsCreated", this._onReactionsCreated);
        }
    },

    /** called when the event is decrypted after we show it.
     */
    _onDecrypted: function() {
        // we need to re-verify the sending device.
        // (we call onHeightChanged in _verifyEvent to handle the case where decryption
        // has caused a change in size of the event tile)
        this._verifyEvent(this.props.mxEvent);
        this.forceUpdate();
    },

    onDeviceVerificationChanged: function(userId, device) {
        if (userId === this.props.mxEvent.getSender()) {
            this._verifyEvent(this.props.mxEvent);
        }
    },

    onUserVerificationChanged: function(userId, _trustStatus) {
        if (userId === this.props.mxEvent.getSender()) {
            this._verifyEvent(this.props.mxEvent);
        }
    },

    _verifyEvent: async function(mxEvent) {
        if (!mxEvent.isEncrypted()) {
            return;
        }

        const encryptionInfo = this.context.getEventEncryptionInfo(mxEvent);
        const senderId = mxEvent.getSender();
        const userTrust = this.context.checkUserTrust(senderId);

        if (encryptionInfo.mismatchedSender) {
            // something definitely wrong is going on here
            this.setState({
                verified: E2E_STATE.WARNING,
            }, this.props.onHeightChanged); // Decryption may have caused a change in size
            return;
        }

        if (!userTrust.isCrossSigningVerified()) {
            // user is not verified, so default to everything is normal
            this.setState({
                verified: E2E_STATE.NORMAL,
            }, this.props.onHeightChanged); // Decryption may have caused a change in size
            return;
        }

        const eventSenderTrust = encryptionInfo.sender && this.context.checkDeviceTrust(
            senderId, encryptionInfo.sender.deviceId,
        );
        if (!eventSenderTrust) {
            this.setState({
                verified: E2E_STATE.UNKNOWN,
            }, this.props.onHeightChanged); // Decryption may have caused a change in size
            return;
        }

        if (!eventSenderTrust.isVerified()) {
            this.setState({
                verified: E2E_STATE.WARNING,
            }, this.props.onHeightChanged); // Decryption may have caused a change in size
            return;
        }

        if (!encryptionInfo.authenticated) {
            this.setState({
                verified: E2E_STATE.UNAUTHENTICATED,
            }, this.props.onHeightChanged); // Decryption may have caused a change in size
            return;
        }

        this.setState({
            verified: E2E_STATE.VERIFIED,
        }, this.props.onHeightChanged); // Decryption may have caused a change in size
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
            if (key === 'readReceipts') {
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
                    if (rA[j].userId !== rB[j].userId) {
                        return false;
                    }
                    // one has a member set and the other doesn't?
                    if (rA[j].roomMember !== rB[j].roomMember) {
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
        const actions = this.context.getPushActionsForEvent(this.props.mxEvent.replacingEvent() || this.props.mxEvent);
        if (!actions || !actions.tweaks) { return false; }

        // don't show self-highlights from another of our clients
        if (this.props.mxEvent.getSender() === this.context.credentials.userId) {
            return false;
        }

        return actions.tweaks.highlight;
    },

    toggleAllReadAvatars: function() {
        this.setState({
            allReadAvatars: !this.state.allReadAvatars,
        });
    },

    getReadAvatars: function() {
        // return early if there are no read receipts
        if (!this.props.readReceipts || this.props.readReceipts.length === 0) {
            return (<span className="mx_EventTile_readAvatars" />);
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

            const userId = receipt.userId;
            let readReceiptInfo;

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
                    fallbackUserId={userId}
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
                    style={{ right: "calc(" + toRem(-left) + " + " + receiptOffset + "px)" }}>{ remainder }+
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

    onRequestKeysClick: function() {
        this.setState({
            // Indicate in the UI that the keys have been requested (this is expected to
            // be reset if the component is mounted in the future).
            previouslyRequestedKeys: true,
        });

        // Cancel any outgoing key request for this event and resend it. If a response
        // is received for the request with the required keys, the event could be
        // decrypted successfully.
        this.context.cancelAndResendEventRoomKeyRequest(this.props.mxEvent);
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

        // event could not be decrypted
        if (ev.getContent().msgtype === 'm.bad.encrypted') {
            return <E2ePadlockUndecryptable />;
        }

        // event is encrypted, display padlock corresponding to whether or not it is verified
        if (ev.isEncrypted()) {
            if (this.state.verified === E2E_STATE.NORMAL) {
                return; // no icon if we've not even cross-signed the user
            } else if (this.state.verified === E2E_STATE.VERIFIED) {
                return; // no icon for verified
            } else if (this.state.verified === E2E_STATE.UNAUTHENTICATED) {
                return (<E2ePadlockUnauthenticated />);
            } else if (this.state.verified === E2E_STATE.UNKNOWN) {
                return (<E2ePadlockUnknown />);
            } else {
                return (<E2ePadlockUnverified />);
            }
        }

        if (this.context.isRoomEncrypted(ev.getRoomId())) {
            // else if room is encrypted
            // and event is being encrypted or is not_sent (Unknown Devices/Network Error)
            if (ev.status === EventStatus.ENCRYPTING) {
                return;
            }
            if (ev.status === EventStatus.NOT_SENT) {
                return;
            }
            if (ev.isState()) {
                return; // we expect this to be unencrypted
            }
            // if the event is not encrypted, but it's an e2e room, show the open padlock
            return <E2ePadlockUnencrypted />;
        }

        // no padlock needed
        return null;
    },

    onActionBarFocusChange(focused) {
        this.setState({
            actionBarFocused: focused,
        });
    },

    getTile() {
        return this._tile.current;
    },

    getReplyThread() {
        return this._replyThread.current;
    },

    getReactions() {
        if (
            !this.props.showReactions ||
            !this.props.getRelationsForEvent
        ) {
            return null;
        }
        const eventId = this.props.mxEvent.getId();
        if (!eventId) {
            // XXX: Temporary diagnostic logging for https://github.com/vector-im/riot-web/issues/11120
            console.error("EventTile attempted to get relations for an event without an ID");
            // Use event's special `toJSON` method to log key data.
            console.log(JSON.stringify(this.props.mxEvent, null, 4));
            console.trace("Stacktrace for https://github.com/vector-im/riot-web/issues/11120");
        }
        return this.props.getRelationsForEvent(eventId, "m.annotation", "m.reaction");
    },

    _onReactionsCreated(relationType, eventType) {
        if (relationType !== "m.annotation" || eventType !== "m.reaction") {
            return;
        }
        this.props.mxEvent.removeListener("Event.relationsCreated", this._onReactionsCreated);
        this.setState({
            reactions: this.getReactions(),
        });
    },

    render: function() {
        const MessageTimestamp = sdk.getComponent('messages.MessageTimestamp');
        const SenderProfile = sdk.getComponent('messages.SenderProfile');
        const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');

        //console.info("EventTile showUrlPreview for %s is %s", this.props.mxEvent.getId(), this.props.showUrlPreview);

        const content = this.props.mxEvent.getContent();
        const msgtype = content.msgtype;
        const eventType = this.props.mxEvent.getType();

        // Info messages are basically information about commands processed on a room
        const isBubbleMessage = eventType.startsWith("m.key.verification") ||
            (eventType === "m.room.message" && msgtype && msgtype.startsWith("m.key.verification")) ||
            (eventType === "m.room.encryption");
        let isInfoMessage = (
            !isBubbleMessage && eventType !== 'm.room.message' &&
            eventType !== 'm.sticker' && eventType !== 'm.room.create'
        );

        let tileHandler = getHandlerTile(this.props.mxEvent);
        // If we're showing hidden events in the timeline, we should use the
        // source tile when there's no regular tile for an event and also for
        // replace relations (which otherwise would display as a confusing
        // duplicate of the thing they are replacing).
        const useSource = !tileHandler || this.props.mxEvent.isRelation("m.replace");
        if (useSource && SettingsStore.getValue("showHiddenEventsInTimeline")) {
            tileHandler = "messages.ViewSourceEvent";
            // Reuse info message avatar and sender profile styling
            isInfoMessage = true;
        }
        // This shouldn't happen: the caller should check we support this type
        // before trying to instantiate us
        if (!tileHandler) {
            const {mxEvent} = this.props;
            console.warn(`Event type not supported: type:${mxEvent.getType()} isState:${mxEvent.isState()}`);
            return <div className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                <div className="mx_EventTile_line">
                    { _t('This event could not be displayed') }
                </div>
            </div>;
        }
        const EventTileType = sdk.getComponent(tileHandler);

        const isSending = (['sending', 'queued', 'encrypting'].indexOf(this.props.eventSendStatus) !== -1);
        const isRedacted = isMessageEvent(this.props.mxEvent) && this.props.isRedacted;
        const isEncryptionFailure = this.props.mxEvent.isDecryptionFailure();

        const isEditing = !!this.props.editState;
        const classes = classNames({
            mx_EventTile_bubbleContainer: isBubbleMessage,
            mx_EventTile: true,
            mx_EventTile_isEditing: isEditing,
            mx_EventTile_info: isInfoMessage,
            mx_EventTile_12hr: this.props.isTwelveHour,
            mx_EventTile_encrypting: this.props.eventSendStatus === 'encrypting',
            mx_EventTile_sending: !isEditing && isSending,
            mx_EventTile_notSent: this.props.eventSendStatus === 'not_sent',
            mx_EventTile_highlight: this.props.tileShape === 'notif' ? false : this.shouldHighlight(),
            mx_EventTile_selected: this.props.isSelectedEvent,
            mx_EventTile_continuation: this.props.tileShape ? '' : this.props.continuation,
            mx_EventTile_last: this.props.last,
            mx_EventTile_contextual: this.props.contextual,
            mx_EventTile_actionBarFocused: this.state.actionBarFocused,
            mx_EventTile_verified: !isBubbleMessage && this.state.verified === E2E_STATE.VERIFIED,
            mx_EventTile_unverified: !isBubbleMessage && this.state.verified === E2E_STATE.WARNING,
            mx_EventTile_unknown: !isBubbleMessage && this.state.verified === E2E_STATE.UNKNOWN,
            mx_EventTile_bad: isEncryptionFailure,
            mx_EventTile_emote: msgtype === 'm.emote',
        });

        let permalink = "#";
        if (this.props.permalinkCreator) {
            permalink = this.props.permalinkCreator.forEvent(this.props.mxEvent.getId());
        }

        const readAvatars = this.getReadAvatars();

        let avatar;
        let sender;
        let avatarSize;
        let needsSenderProfile;

        if (this.props.tileShape === "notif") {
            avatarSize = 24;
            needsSenderProfile = true;
        } else if (tileHandler === 'messages.RoomCreate' || isBubbleMessage) {
            avatarSize = 0;
            needsSenderProfile = false;
        } else if (isInfoMessage) {
            // a small avatar, with no sender profile, for
            // joins/parts/etc
            avatarSize = 14;
            needsSenderProfile = false;
        } else if (this.props.useIRCLayout) {
            avatarSize = 14;
            needsSenderProfile = true;
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
            if (!this.props.tileShape || this.props.tileShape === 'reply' || this.props.tileShape === 'reply_preview') {
                if (msgtype === 'm.image') text = _td('%(senderName)s sent an image');
                else if (msgtype === 'm.video') text = _td('%(senderName)s sent a video');
                else if (msgtype === 'm.file') text = _td('%(senderName)s uploaded a file');
                sender = <SenderProfile onClick={this.onSenderProfileClick}
                                        mxEvent={this.props.mxEvent}
                                        enableFlair={!text}
                                        text={text} />;
            } else {
                sender = <SenderProfile mxEvent={this.props.mxEvent} enableFlair={true} />;
            }
        }

        const MessageActionBar = sdk.getComponent('messages.MessageActionBar');
        const actionBar = !isEditing ? <MessageActionBar
            mxEvent={this.props.mxEvent}
            reactions={this.state.reactions}
            permalinkCreator={this.props.permalinkCreator}
            getTile={this.getTile}
            getReplyThread={this.getReplyThread}
            onFocusChange={this.onActionBarFocusChange}
        /> : undefined;

        const timestamp = this.props.mxEvent.getTs() ?
            <MessageTimestamp showTwelveHour={this.props.isTwelveHour} ts={this.props.mxEvent.getTs()} /> : null;

        const keyRequestHelpText =
            <div className="mx_EventTile_keyRequestInfo_tooltip_contents">
                <p>
                    { this.state.previouslyRequestedKeys ?
                        _t( 'Your key share request has been sent - please check your other sessions ' +
                            'for key share requests.') :
                        _t( 'Key share requests are sent to your other sessions automatically. If you ' +
                            'rejected or dismissed the key share request on your other sessions, click ' +
                            'here to request the keys for this session again.')
                    }
                </p>
                <p>
                    { _t( 'If your other sessions do not have the key for this message you will not ' +
                            'be able to decrypt them.')
                    }
                </p>
            </div>;
        const keyRequestInfoContent = this.state.previouslyRequestedKeys ?
            _t('Key request sent.') :
            _t(
                '<requestLink>Re-request encryption keys</requestLink> from your other sessions.',
                {},
                {'requestLink': (sub) => <a onClick={this.onRequestKeysClick}>{ sub }</a>},
            );

        const TooltipButton = sdk.getComponent('elements.TooltipButton');
        const keyRequestInfo = isEncryptionFailure ?
            <div className="mx_EventTile_keyRequestInfo">
                <span className="mx_EventTile_keyRequestInfo_text">
                    { keyRequestInfoContent }
                </span>
                <TooltipButton helpText={keyRequestHelpText} />
            </div> : null;

        let reactionsRow;
        if (!isRedacted) {
            const ReactionsRow = sdk.getComponent('messages.ReactionsRow');
            reactionsRow = <ReactionsRow
                mxEvent={this.props.mxEvent}
                reactions={this.state.reactions}
            />;
        }

        const linkedTimestamp = <a
                href={permalink}
                onClick={this.onPermalinkClicked}
                aria-label={formatTime(new Date(this.props.mxEvent.getTs()), this.props.isTwelveHour)}
            >
                { timestamp }
            </a>;

        const groupTimestamp = !this.props.useIRCLayout ? linkedTimestamp : null;
        const ircTimestamp = this.props.useIRCLayout ? linkedTimestamp : null;
        const groupPadlock = !this.props.useIRCLayout && !isBubbleMessage && this._renderE2EPadlock();
        const ircPadlock = this.props.useIRCLayout && !isBubbleMessage && this._renderE2EPadlock();

        switch (this.props.tileShape) {
            case 'notif': {
                const room = this.context.getRoom(this.props.mxEvent.getRoomId());
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
                        <div className="mx_EventTile_line">
                            <EventTileType ref={this._tile}
                                           mxEvent={this.props.mxEvent}
                                           highlights={this.props.highlights}
                                           highlightLink={this.props.highlightLink}
                                           showUrlPreview={this.props.showUrlPreview}
                                           onHeightChanged={this.props.onHeightChanged} />
                        </div>
                    </div>
                );
            }
            case 'file_grid': {
                return (
                    <div className={classes}>
                        <div className="mx_EventTile_line">
                            <EventTileType ref={this._tile}
                                           mxEvent={this.props.mxEvent}
                                           highlights={this.props.highlights}
                                           highlightLink={this.props.highlightLink}
                                           showUrlPreview={this.props.showUrlPreview}
                                           tileShape={this.props.tileShape}
                                           onHeightChanged={this.props.onHeightChanged} />
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

            case 'reply':
            case 'reply_preview': {
                let thread;
                if (this.props.tileShape === 'reply_preview') {
                    thread = ReplyThread.makeThread(
                        this.props.mxEvent,
                        this.props.onHeightChanged,
                        this.props.permalinkCreator,
                        this._replyThread,
                    );
                }
                return (
                    <div className={classes}>
                        { ircTimestamp }
                        { avatar }
                        { sender }
                        { ircPadlock }
                        <div className="mx_EventTile_reply">
                            { groupTimestamp }
                            { groupPadlock }
                            { thread }
                            <EventTileType ref={this._tile}
                                           mxEvent={this.props.mxEvent}
                                           highlights={this.props.highlights}
                                           highlightLink={this.props.highlightLink}
                                           onHeightChanged={this.props.onHeightChanged}
                                           showUrlPreview={false} />
                        </div>
                    </div>
                );
            }
            default: {
                const thread = ReplyThread.makeThread(
                    this.props.mxEvent,
                    this.props.onHeightChanged,
                    this.props.permalinkCreator,
                    this._replyThread,
                    this.props.useIRCLayout,
                );

                // tab-index=-1 to allow it to be focusable but do not add tab stop for it, primarily for screen readers
                return (
                    <div className={classes} tabIndex={-1}>
                        { ircTimestamp }
                        <div className="mx_EventTile_msgOption">
                            { readAvatars }
                        </div>
                        { sender }
                        { ircPadlock }
                        <div className="mx_EventTile_line">
                            { groupTimestamp }
                            { groupPadlock }
                            { thread }
                            <EventTileType ref={this._tile}
                                           mxEvent={this.props.mxEvent}
                                           replacingEventId={this.props.replacingEventId}
                                           editState={this.props.editState}
                                           highlights={this.props.highlights}
                                           highlightLink={this.props.highlightLink}
                                           showUrlPreview={this.props.showUrlPreview}
                                           onHeightChanged={this.props.onHeightChanged} />
                            { keyRequestInfo }
                            { reactionsRow }
                            { actionBar }
                        </div>
                        {
                            // The avatar goes after the event tile as it's absolutely positioned to be over the
                            // event tile line, so needs to be later in the DOM so it appears on top (this avoids
                            // the need for further z-indexing chaos)
                        }
                        { avatar }
                    </div>
                );
            }
        }
    },
});

// XXX this'll eventually be dynamic based on the fields once we have extensible event types
const messageTypes = ['m.room.message', 'm.sticker'];
function isMessageEvent(ev) {
    return (messageTypes.includes(ev.getType()));
}

export function haveTileForEvent(e) {
    // Only messages have a tile (black-rectangle) if redacted
    if (e.isRedacted() && !isMessageEvent(e)) return false;

    // No tile for replacement events since they update the original tile
    if (e.isRelation("m.replace")) return false;

    const handler = getHandlerTile(e);
    if (handler === undefined) return false;
    if (handler === 'messages.TextualEvent') {
        return TextForEvent.textForEvent(e) !== '';
    } else if (handler === 'messages.RoomCreate') {
        return Boolean(e.getContent()['predecessor']);
    } else {
        return true;
    }
}

function E2ePadlockUndecryptable(props) {
    return (
        <E2ePadlock title={_t("This message cannot be decrypted")} icon="undecryptable" {...props} />
    );
}

function E2ePadlockUnverified(props) {
    return (
        <E2ePadlock title={_t("Encrypted by an unverified session")} icon="unverified" {...props} />
    );
}

function E2ePadlockUnencrypted(props) {
    return (
        <E2ePadlock title={_t("Unencrypted")} icon="unencrypted" {...props} />
    );
}

function E2ePadlockUnknown(props) {
    return (
        <E2ePadlock title={_t("Encrypted by a deleted session")} icon="unknown" {...props} />
    );
}

function E2ePadlockUnauthenticated(props) {
    return (
        <E2ePadlock title={_t("The authenticity of this encrypted message can't be guaranteed on this device.")} icon="unauthenticated" {...props} />
    );
}

class E2ePadlock extends React.Component {
    static propTypes = {
        icon: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
    };

    constructor() {
        super();

        this.state = {
            hover: false,
        };
    }

    onHoverStart = () => {
        this.setState({hover: true});
    };

    onHoverEnd = () => {
        this.setState({hover: false});
    };

    render() {
        let tooltip = null;
        if (this.state.hover) {
            const Tooltip = sdk.getComponent("elements.Tooltip");
            tooltip = <Tooltip className="mx_EventTile_e2eIcon_tooltip" label={this.props.title} dir="auto" />;
        }

        let classes = `mx_EventTile_e2eIcon mx_EventTile_e2eIcon_${this.props.icon}`;
        if (!SettingsStore.getValue("alwaysShowEncryptionIcons")) {
            classes += ' mx_EventTile_e2eIcon_hidden';
        }

        return (
            <div
                className={classes}
                onClick={this.onClick}
                onMouseEnter={this.onHoverStart}
                onMouseLeave={this.onHoverEnd}
            >{tooltip}</div>
        );
    }
}
