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
import { makeRoomPermalink } from '../../../matrix-to';

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

export default class MessageComposer extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.onCallClick = this.onCallClick.bind(this);
        this.onHangupClick = this.onHangupClick.bind(this);
        this.onUploadClick = this.onUploadClick.bind(this);
        this.onUploadFileSelected = this.onUploadFileSelected.bind(this);
        this.uploadFiles = this.uploadFiles.bind(this);
        this.onVoiceCallClick = this.onVoiceCallClick.bind(this);
        this._onAutocompleteConfirm = this._onAutocompleteConfirm.bind(this);
        this.onToggleFormattingClicked = this.onToggleFormattingClicked.bind(this);
        this.onToggleMarkdownClicked = this.onToggleMarkdownClicked.bind(this);
        this.onInputStateChanged = this.onInputStateChanged.bind(this);
        this.onEvent = this.onEvent.bind(this);
        this._onRoomStateEvents = this._onRoomStateEvents.bind(this);
        this._onRoomViewStoreUpdate = this._onRoomViewStoreUpdate.bind(this);
        this._onTombstoneClick = this._onTombstoneClick.bind(this);

        this.state = {
            inputState: {
                marks: [],
                blockType: null,
                isRichTextEnabled: SettingsStore.getValue('MessageComposerInput.isRichTextEnabled'),
            },
            showFormatting: SettingsStore.getValue('MessageComposer.showFormatting'),
            isQuoting: Boolean(RoomViewStore.getQuotingEvent()),
            tombstone: this._getRoomTombstone(),
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
    }

    _getRoomTombstone() {
        return this.props.room.currentState.getStateEvents('m.room.tombstone', '');
    }

    _onRoomViewStoreUpdate() {
        const isQuoting = Boolean(RoomViewStore.getQuotingEvent());
        if (this.state.isQuoting === isQuoting) return;
        this.setState({ isQuoting });
    }

    onUploadClick(ev) {
        if (MatrixClientPeg.get().isGuest()) {
            dis.dispatch({action: 'require_registration'});
            return;
        }

        this.refs.uploadInput.click();
    }

    onUploadFileSelected(files) {
        this.uploadFiles(files.target.files);
    }

    uploadFiles(files) {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        const fileList = [];
        for (let i=0; i<files.length; i++) {
            fileList.push(<li key={i}>
                <TintableSvg key={i} src="img/files.svg" width="16" height="16" /> { files[i].name || _t('Attachment') }
            </li>);
        }

        const isQuoting = Boolean(RoomViewStore.getQuotingEvent());
        let replyToWarning = null;
        if (isQuoting) {
            replyToWarning = <p>{
                _t('At this time it is not possible to reply with a file so this will be sent without being a reply.')
            }</p>;
        }

        Modal.createTrackedDialog('Upload Files confirmation', '', QuestionDialog, {
            title: _t('Upload Files'),
            description: (
                <div>
                    <p>{ _t('Are you sure you want to upload the following files?') }</p>
                    <ul style={{listStyle: 'none', textAlign: 'left'}}>
                        { fileList }
                    </ul>
                    { replyToWarning }
                </div>
            ),
            onFinished: (shouldUpload) => {
                if (shouldUpload) {
                    // MessageComposer shouldn't have to rely on its parent passing in a callback to upload a file
                    if (files) {
                        for (let i=0; i<files.length; i++) {
                            this.props.uploadFile(files[i]);
                        }
                    }
                }

                this.refs.uploadInput.value = null;
            },
        });
    }

    onHangupClick() {
        const call = CallHandler.getCallForRoom(this.props.room.roomId);
        //var call = CallHandler.getAnyActiveCall();
        if (!call) {
            return;
        }
        dis.dispatch({
            action: 'hangup',
            // hangup the call for this room, which may not be the room in props
            // (e.g. conferences which will hangup the 1:1 room instead)
            room_id: call.roomId,
        });
    }

    onCallClick(ev) {
        dis.dispatch({
            action: 'place_call',
            type: ev.shiftKey ? "screensharing" : "video",
            room_id: this.props.room.roomId,
        });
    }

    onVoiceCallClick(ev) {
        dis.dispatch({
            action: 'place_call',
            type: "voice",
            room_id: this.props.room.roomId,
        });
    }

    onInputStateChanged(inputState) {
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
        dis.dispatch({
            action: 'view_room',
            highlighted: true,
            room_id: replacementRoomId,
        });
    }

    render() {
        const uploadInputStyle = {display: 'none'};
        const MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        const TintableSvg = sdk.getComponent("elements.TintableSvg");
        const MessageComposerInput = sdk.getComponent("rooms.MessageComposerInput");

        const controls = [];

        if (this.state.me) {
            controls.push(
                <div key="controls_avatar" className="mx_MessageComposer_avatar">
                    <MemberAvatar member={this.state.me} width={24} height={24} />
                </div>,
            );
        }

        let e2eImg, e2eTitle, e2eClass;
        const roomIsEncrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.room.roomId);
        if (roomIsEncrypted) {
            // FIXME: show a /!\ if there are untrusted devices in the room...
            e2eImg = 'img/e2e-verified.svg';
            e2eTitle = _t('Encrypted room');
            e2eClass = 'mx_MessageComposer_e2eIcon';
        } else {
            e2eImg = 'img/e2e-unencrypted.svg';
            e2eTitle = _t('Unencrypted room');
            e2eClass = 'mx_MessageComposer_e2eIcon mx_filterFlipColor';
        }

        controls.push(
            <img key="e2eIcon" className={e2eClass} src={e2eImg} width="12" height="12"
                alt={e2eTitle} title={e2eTitle}
            />,
        );

        let callButton;
        let videoCallButton;
        let hangupButton;

        // Call buttons
        if (this.props.callState && this.props.callState !== 'ended') {
            hangupButton =
                <div key="controls_hangup" className="mx_MessageComposer_hangup" onClick={this.onHangupClick}>
                    <img src="img/hangup.svg" alt={_t('Hangup')} title={_t('Hangup')} width="25" height="26" />
                </div>;
        } else {
            callButton =
                <div key="controls_call" className="mx_MessageComposer_voicecall" onClick={this.onVoiceCallClick} title={_t('Voice call')}>
                    <TintableSvg src="img/icon-call.svg" width="35" height="35" />
                </div>;
            videoCallButton =
                <div key="controls_videocall" className="mx_MessageComposer_videocall" onClick={this.onCallClick} title={_t('Video call')}>
                    <TintableSvg src="img/icons-video.svg" width="35" height="35" />
                </div>;
        }

        const canSendMessages = !this.state.tombstone && this.props.room.currentState.maySendMessage(
            MatrixClientPeg.get().credentials.userId);

        if (canSendMessages) {
            // This also currently includes the call buttons. Really we should
            // check separately for whether we can call, but this is slightly
            // complex because of conference calls.
            const uploadButton = (
                <div key="controls_upload" className="mx_MessageComposer_upload"
                        onClick={this.onUploadClick} title={_t('Upload file')}>
                    <TintableSvg src="img/icons-upload.svg" width="35" height="35" />
                    <input ref="uploadInput" type="file"
                        style={uploadInputStyle}
                        multiple
                        onChange={this.onUploadFileSelected} />
                </div>
            );

            const formattingButton = this.state.inputState.isRichTextEnabled ? (
                <img className="mx_MessageComposer_formatting"
                     title={_t("Show Text Formatting Toolbar")}
                     src="img/button-text-formatting.svg"
                     onClick={this.onToggleFormattingClicked}
                     style={{visibility: this.state.showFormatting ? 'hidden' : 'visible'}}
                     key="controls_formatting" />
            ) : null;

            let placeholderText;
            if (this.state.isQuoting) {
                if (roomIsEncrypted) {
                    placeholderText = _t('Send an encrypted reply…');
                } else {
                    placeholderText = _t('Send a reply (unencrypted)…');
                }
            } else {
                if (roomIsEncrypted) {
                    placeholderText = _t('Send an encrypted message…');
                } else {
                    placeholderText = _t('Send a message (unencrypted)…');
                }
            }

            const stickerpickerButton = <Stickerpicker key='stickerpicker_controls_button' room={this.props.room} />;

            controls.push(
                <MessageComposerInput
                    ref={(c) => this.messageComposerInput = c}
                    key="controls_input"
                    onResize={this.props.onResize}
                    room={this.props.room}
                    placeholder={placeholderText}
                    onFilesPasted={this.uploadFiles}
                    onInputStateChanged={this.onInputStateChanged} />,
                formattingButton,
                stickerpickerButton,
                uploadButton,
                hangupButton,
                callButton,
                videoCallButton,
            );
        } else if (this.state.tombstone) {
            const replacementRoomId = this.state.tombstone.getContent()['replacement_room'];

            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
            controls.push(<div className="mx_MessageComposer_replaced_wrapper">
                <div className="mx_MessageComposer_replaced_valign">
                    <img className="mx_MessageComposer_roomReplaced_icon" src="img/room_replaced.svg" />
                    <span className="mx_MessageComposer_roomReplaced_header">
                        {_t("This room has been replaced and is no longer active.")}
                    </span><br />
                    <a href={makeRoomPermalink(replacementRoomId)}
                        className="mx_MessageComposer_roomReplaced_link"
                        onClick={this._onTombstoneClick}
                    >
                        {_t("The conversation continues here.")}
                    </a>
                </div>
            </div>);
        } else {
            controls.push(
                <div key="controls_error" className="mx_MessageComposer_noperm_error">
                    { _t('You do not have permission to post to this room') }
                </div>,
            );
        }

        let formatBar;
        if (this.state.showFormatting && this.state.inputState.isRichTextEnabled) {
            const {marks, blockType} = this.state.inputState;
            const formatButtons = formatButtonList.map((name) => {
                // special-case to match the md serializer and the special-case in MessageComposerInput.js
                const markName = name === 'inline-code' ? 'code' : name;
                const active = marks.some(mark => mark.type === markName) || blockType === name;
                const suffix = active ? '-on' : '';
                const onFormatButtonClicked = this.onFormatButtonClicked.bind(this, name);
                const className = 'mx_MessageComposer_format_button mx_filterFlipColor';
                return <img className={className}
                            title={_t(name)}
                            onMouseDown={onFormatButtonClicked}
                            key={name}
                            src={`img/button-text-${name}${suffix}.svg`}
                            height="17" />;
                },
            );

            formatBar =
                <div className="mx_MessageComposer_formatbar_wrapper">
                    <div className="mx_MessageComposer_formatbar">
                        { formatButtons }
                        <div style={{flex: 1}}></div>
                        <img title={this.state.inputState.isRichTextEnabled ? _t("Turn Markdown on") : _t("Turn Markdown off")}
                             onMouseDown={this.onToggleMarkdownClicked}
                            className="mx_MessageComposer_formatbar_markdown mx_filterFlipColor"
                            src={`img/button-md-${!this.state.inputState.isRichTextEnabled}.png`} />
                        <img title={_t("Hide Text Formatting Toolbar")}
                             onClick={this.onToggleFormattingClicked}
                             className="mx_MessageComposer_formatbar_cancel mx_filterFlipColor"
                             src="img/icon-text-cancel.svg" />
                    </div>
                </div>
        }

        return (
            <div className="mx_MessageComposer">
                <div className="mx_MessageComposer_wrapper">
                    <div className="mx_MessageComposer_row">
                        { controls }
                    </div>
                </div>
                { formatBar }
            </div>
        );
    }
}

MessageComposer.propTypes = {
    // a callback which is called when the height of the composer is
    // changed due to a change in content.
    onResize: PropTypes.func,

    // js-sdk Room object
    room: PropTypes.object.isRequired,

    // string representing the current voip call state
    callState: PropTypes.string,

    // callback when a file to upload is chosen
    uploadFile: PropTypes.func.isRequired,

    // string representing the current room app drawer state
    showApps: PropTypes.bool,
};
