/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 New Vector Ltd

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
import { _t, _td } from '../../../languageHandler';
import CallHandler from '../../../CallHandler';
import MatrixClientPeg from '../../../MatrixClientPeg';
import Modal from '../../../Modal';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import RoomViewStore from '../../../stores/RoomViewStore';
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";
import Stickerpicker from './Stickerpicker';
import { makeRoomPermalink } from '../../../utils/permalinks/Permalinks';
import ContentMessages from '../../../ContentMessages';
import classNames from 'classnames';

import E2EIcon from './E2EIcon';

const formatButtonList = [
    _td("bold"),
    _td("italic"),
    _td("deleted"),
    _td("underlined"),
    _td("inline-code"),
    _td("block-quote"),
    _td("bulleted-list"),
    _td("numbered-list"),
];

function ComposerAvatar(props) {
    const MemberStatusMessageAvatar = sdk.getComponent('avatars.MemberStatusMessageAvatar');
    return <div className="mx_MessageComposer_avatar">
        <MemberStatusMessageAvatar member={props.me} width={24} height={24} />
    </div>;
}

ComposerAvatar.propTypes = {
    me: PropTypes.object.isRequired,
}

function CallButton(props) {
    const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
    const onVoiceCallClick = (ev) => {
        dis.dispatch({
            action: 'place_call',
            type: "voice",
            room_id: props.roomId,
        });
    };

    return <AccessibleButton className="mx_MessageComposer_button mx_MessageComposer_voicecall"
        onClick={onVoiceCallClick}
        title={_t('Voice call')}
    />
}

CallButton.propTypes = {
    roomId: PropTypes.string.isRequired
}

function VideoCallButton(props) {
    const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
    const onCallClick = (ev) => {
        dis.dispatch({
            action: 'place_call',
            type: ev.shiftKey ? "screensharing" : "video",
            room_id: props.roomId,
        });
    };

    return <AccessibleButton className="mx_MessageComposer_button mx_MessageComposer_videocall"
        onClick={onCallClick}
        title={_t('Video call')}
    />;
}

VideoCallButton.propTypes = {
    roomId: PropTypes.string.isRequired,
};

function HangupButton(props) {
    const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
    const onHangupClick = () => {
        const call = CallHandler.getCallForRoom(props.roomId);
        if (!call) {
            return;
        }
        dis.dispatch({
            action: 'hangup',
            // hangup the call for this room, which may not be the room in props
            // (e.g. conferences which will hangup the 1:1 room instead)
            room_id: call.roomId,
        });
    };
    return  <AccessibleButton className="mx_MessageComposer_button mx_MessageComposer_hangup"
        onClick={onHangupClick}
        title={_t('Hangup')}
    />;
}

HangupButton.propTypes = {
    roomId: PropTypes.string.isRequired,
}

function FormattingButton(props) {
    const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
    return <AccessibleButton
        element="img"
        className="mx_MessageComposer_formatting"
        alt={_t("Show Text Formatting Toolbar")}
        title={_t("Show Text Formatting Toolbar")}
        src={require("../../../../res/img/button-text-formatting.svg")}
        style={{visibility: props.showFormatting ? 'hidden' : 'visible'}}
        onClick={props.onClickHandler}
    />;
}

FormattingButton.propTypes = {
    showFormatting: PropTypes.bool.isRequired,
    onClickHandler: PropTypes.func.isRequired,
}

class UploadButton extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
    }
    constructor(props, context) {
        super(props, context);
        this.onUploadClick = this.onUploadClick.bind(this);
        this.onUploadFileInputChange = this.onUploadFileInputChange.bind(this);
    }

    onUploadClick(ev) {
        if (MatrixClientPeg.get().isGuest()) {
            dis.dispatch({action: 'require_registration'});
            return;
        }
        this.refs.uploadInput.click();
    }

    onUploadFileInputChange(ev) {
        if (ev.target.files.length === 0) return;

        // take a copy so we can safely reset the value of the form control
        // (Note it is a FileList: we can't use slice or sesnible iteration).
        const tfiles = [];
        for (let i = 0; i < ev.target.files.length; ++i) {
            tfiles.push(ev.target.files[i]);
        }

        ContentMessages.sharedInstance().sendContentListToRoom(
            tfiles, this.props.roomId, MatrixClientPeg.get(),
        );

        // This is the onChange handler for a file form control, but we're
        // not keeping any state, so reset the value of the form control
        // to empty.
        // NB. we need to set 'value': the 'files' property is immutable.
        ev.target.value = '';
    }

    render() {
        const uploadInputStyle = {display: 'none'};
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        return (
            <AccessibleButton className="mx_MessageComposer_button mx_MessageComposer_upload"
                onClick={this.onUploadClick}
                title={_t('Upload file')}
            >
                <input ref="uploadInput" type="file"
                    style={uploadInputStyle}
                    multiple
                    onChange={this.onUploadFileInputChange}
                />
            </AccessibleButton>
        );
    }
}

export default class SlateMessageComposer extends React.Component {
    constructor(props, context) {
        super(props, context);
        this._onAutocompleteConfirm = this._onAutocompleteConfirm.bind(this);
        this.onToggleFormattingClicked = this.onToggleFormattingClicked.bind(this);
        this.onToggleMarkdownClicked = this.onToggleMarkdownClicked.bind(this);
        this.onInputStateChanged = this.onInputStateChanged.bind(this);
        this.onEvent = this.onEvent.bind(this);
        this._onRoomStateEvents = this._onRoomStateEvents.bind(this);
        this._onRoomViewStoreUpdate = this._onRoomViewStoreUpdate.bind(this);
        this._onTombstoneClick = this._onTombstoneClick.bind(this);
        this.renderPlaceholderText = this.renderPlaceholderText.bind(this);
        this.renderFormatBar = this.renderFormatBar.bind(this);

        this.state = {
            inputState: {
                marks: [],
                blockType: null,
                isRichTextEnabled: SettingsStore.getValue('MessageComposerInput.isRichTextEnabled'),
            },
            showFormatting: SettingsStore.getValue('MessageComposer.showFormatting'),
            isQuoting: Boolean(RoomViewStore.getQuotingEvent()),
            tombstone: this._getRoomTombstone(),
            canSendMessages: this.props.room.maySendMessage(),
        };
    }

    componentDidMount() {
        // N.B. using 'event' rather than 'RoomEvents' otherwise the crypto handler
        // for 'event' fires *after* 'RoomEvent', and our room won't have yet been
        // marked as encrypted.
        // XXX: fragile as all hell - fixme somehow, perhaps with a dedicated Room.encryption event or something.
        MatrixClientPeg.get().on("event", this.onEvent);
        MatrixClientPeg.get().on("RoomState.events", this._onRoomStateEvents);
        this._roomStoreToken = RoomViewStore.addListener(this._onRoomViewStoreUpdate);
        this._waitForOwnMember();
    }

    _waitForOwnMember() {
        // if we have the member already, do that
        const me = this.props.room.getMember(MatrixClientPeg.get().getUserId());
        if (me) {
            this.setState({me});
            return;
        }
        // Otherwise, wait for member loading to finish and then update the member for the avatar.
        // The members should already be loading, and loadMembersIfNeeded
        // will return the promise for the existing operation
        this.props.room.loadMembersIfNeeded().then(() => {
            const me = this.props.room.getMember(MatrixClientPeg.get().getUserId());
            this.setState({me});
        });
    }

    componentWillUnmount() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("event", this.onEvent);
            MatrixClientPeg.get().removeListener("RoomState.events", this._onRoomStateEvents);
        }
        if (this._roomStoreToken) {
            this._roomStoreToken.remove();
        }
    }

    onEvent(event) {
        if (event.getType() !== 'm.room.encryption') return;
        if (event.getRoomId() !== this.props.room.roomId) return;
        this.forceUpdate();
    }

    _onRoomStateEvents(ev, state) {
        if (ev.getRoomId() !== this.props.room.roomId) return;

        if (ev.getType() === 'm.room.tombstone') {
            this.setState({tombstone: this._getRoomTombstone()});
        }
        if (ev.getType() === 'm.room.power_levels') {
            this.setState({canSendMessages: this.props.room.maySendMessage()});
        }
    }

    _getRoomTombstone() {
        return this.props.room.currentState.getStateEvents('m.room.tombstone', '');
    }

    _onRoomViewStoreUpdate() {
        const isQuoting = Boolean(RoomViewStore.getQuotingEvent());
        if (this.state.isQuoting === isQuoting) return;
        this.setState({ isQuoting });
    }


    onInputStateChanged(inputState) {
        // Merge the new input state with old to support partial updates
        inputState = Object.assign({}, this.state.inputState, inputState);
        this.setState({inputState});
    }

    _onAutocompleteConfirm(range, completion) {
        if (this.messageComposerInput) {
            this.messageComposerInput.setDisplayedCompletion(range, completion);
        }
    }

    onFormatButtonClicked(name, event) {
        event.preventDefault();
        this.messageComposerInput.onFormatButtonClicked(name, event);
    }

    onToggleFormattingClicked() {
        SettingsStore.setValue("MessageComposer.showFormatting", null, SettingLevel.DEVICE, !this.state.showFormatting);
        this.setState({showFormatting: !this.state.showFormatting});
    }

    onToggleMarkdownClicked(e) {
        e.preventDefault(); // don't steal focus from the editor!
        this.messageComposerInput.enableRichtext(!this.state.inputState.isRichTextEnabled);
    }

    _onTombstoneClick(ev) {
        ev.preventDefault();

        const replacementRoomId = this.state.tombstone.getContent()['replacement_room'];
        const replacementRoom = MatrixClientPeg.get().getRoom(replacementRoomId);
        let createEventId = null;
        if (replacementRoom) {
            const createEvent = replacementRoom.currentState.getStateEvents('m.room.create', '');
            if (createEvent && createEvent.getId()) createEventId = createEvent.getId();
        }

        const viaServers = [this.state.tombstone.getSender().split(':').splice(1).join(':')];
        dis.dispatch({
            action: 'view_room',
            highlighted: true,
            event_id: createEventId,
            room_id: replacementRoomId,
            auto_join: true,

            // Try to join via the server that sent the event. This converts @something:example.org
            // into a server domain by splitting on colons and ignoring the first entry ("@something").
            via_servers: viaServers,
            opts: {
                // These are passed down to the js-sdk's /join call
                viaServers: viaServers,
            },
        });
    }

    renderPlaceholderText() {
        const roomIsEncrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.room.roomId);
        if (this.state.isQuoting) {
            if (roomIsEncrypted) {
                return _t('Send an encrypted reply…');
            } else {
                return _t('Send a reply (unencrypted)…');
            }
        } else {
            if (roomIsEncrypted) {
                return _t('Send an encrypted message…');
            } else {
                return _t('Send a message (unencrypted)…');
            }
        }
    }

    renderFormatBar() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const {marks, blockType} = this.state.inputState;
        const formatButtons = formatButtonList.map((name) => {
            // special-case to match the md serializer and the special-case in MessageComposerInput.js
            const markName = name === 'inline-code' ? 'code' : name;
            const active = marks.some(mark => mark.type === markName) || blockType === name;
            const suffix = active ? '-on' : '';
            const onFormatButtonClicked = this.onFormatButtonClicked.bind(this, name);
            const className = 'mx_MessageComposer_format_button mx_filterFlipColor';
            return (
                <img className={className}
                    title={_t(name)}
                    onMouseDown={onFormatButtonClicked}
                    key={name}
                    src={require(`../../../../res/img/button-text-${name}${suffix}.svg`)}
                    height="17"
                />
            );
        })

        return (
            <div className="mx_MessageComposer_formatbar_wrapper">
                <div className="mx_MessageComposer_formatbar">
                { formatButtons }
                <div style={{ flex: 1 }}></div>
                <AccessibleButton
                    className="mx_MessageComposer_formatbar_markdown mx_MessageComposer_markdownDisabled"
                    onClick={this.onToggleMarkdownClicked}
                    title={_t("Markdown is disabled")}
                />
                <AccessibleButton element="img" title={_t("Hide Text Formatting Toolbar")}
                    onClick={this.onToggleFormattingClicked}
                    className="mx_MessageComposer_formatbar_cancel mx_filterFlipColor"
                    src={require("../../../../res/img/icon-text-cancel.svg")}
                />
                </div>
            </div>
        );
    }

    render() {
        const controls = [
            this.state.me ? <ComposerAvatar key="controls_avatar" me={this.state.me} /> : null,
            this.props.e2eStatus ? <E2EIcon key="e2eIcon" status={this.props.e2eStatus} className="mx_MessageComposer_e2eIcon" /> : null,
        ];

        if (!this.state.tombstone && this.state.canSendMessages) {
            // This also currently includes the call buttons. Really we should
            // check separately for whether we can call, but this is slightly
            // complex because of conference calls.

            const MessageComposerInput = sdk.getComponent("rooms.MessageComposerInput");
            const showFormattingButton = this.state.inputState.isRichTextEnabled;
            const callInProgress = this.props.callState && this.props.callState !== 'ended';

            controls.push(
                <MessageComposerInput
                    ref={(c) => this.messageComposerInput = c}
                    key="controls_input"
                    room={this.props.room}
                    placeholder={this.renderPlaceholderText()}
                    onInputStateChanged={this.onInputStateChanged}
                    permalinkCreator={this.props.permalinkCreator} />,
                showFormattingButton ? <FormattingButton key="controls_formatting"
                    showFormatting={this.state.showFormatting} onClickHandler={this.onToggleFormattingClicked} /> : null,
                <Stickerpicker key='stickerpicker_controls_button' room={this.props.room} />,
                <UploadButton key="controls_upload" roomId={this.props.room.roomId} />,
                callInProgress ? <HangupButton key="controls_hangup" roomId={this.props.room.roomId} /> : null,
                callInProgress ? null : <CallButton key="controls_call" roomId={this.props.room.roomId} />,
                callInProgress ? null : <VideoCallButton key="controls_videocall" roomId={this.props.room.roomId} />,
            );
        } else if (this.state.tombstone) {
            const replacementRoomId = this.state.tombstone.getContent()['replacement_room'];

            const continuesLink = replacementRoomId ? (
                <a href={makeRoomPermalink(replacementRoomId)}
                    className="mx_MessageComposer_roomReplaced_link"
                    onClick={this._onTombstoneClick}
                >
                    {_t("The conversation continues here.")}
                </a>
            ) : '';

            controls.push(<div className="mx_MessageComposer_replaced_wrapper">
                <div className="mx_MessageComposer_replaced_valign">
                    <img className="mx_MessageComposer_roomReplaced_icon" src={require("../../../../res/img/room_replaced.svg")} />
                    <span className="mx_MessageComposer_roomReplaced_header">
                        {_t("This room has been replaced and is no longer active.")}
                    </span><br />
                    { continuesLink }
                </div>
            </div>);
        } else {
            controls.push(
                <div key="controls_error" className="mx_MessageComposer_noperm_error">
                    { _t('You do not have permission to post to this room') }
                </div>,
            );
        }

        const showFormatBar = this.state.showFormatting && this.state.inputState.isRichTextEnabled;

        const wrapperClasses = classNames({
            mx_MessageComposer_wrapper: true,
            mx_MessageComposer_hasE2EIcon: !!this.props.e2eStatus,
        });
        return (
            <div className="mx_MessageComposer">
                <div className={wrapperClasses}>
                    <div className="mx_MessageComposer_row">
                        { controls }
                    </div>
                </div>
                { showFormatBar ? this.renderFormatBar() : null }
            </div>
        );
    }
}

SlateMessageComposer.propTypes = {
    // js-sdk Room object
    room: PropTypes.object.isRequired,

    // string representing the current voip call state
    callState: PropTypes.string,

    // string representing the current room app drawer state
    showApps: PropTypes.bool
};
