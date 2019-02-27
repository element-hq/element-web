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

    onUploadClick(ev) {
        if (MatrixClientPeg.get().isGuest()) {
            dis.dispatch({action: 'require_registration'});
            return;
        }

        this.refs.uploadInput.click();
    }

    onUploadFileSelected(files) {
        const tfiles = files.target.files;
        this.uploadFiles(tfiles);
    }

    uploadFiles(files) {
        const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        const fileList = [];
        const acceptedFiles = [];
        const failedFiles = [];

        for (let i=0; i<files.length; i++) {
            const fileAcceptedOrError = this.props.uploadAllowed(files[i]);
            if (fileAcceptedOrError === true) {
                acceptedFiles.push(<li key={i}>
                    <TintableSvg key={i} src={require("../../../../res/img/files.svg")} width="16" height="16" /> { files[i].name || _t('Attachment') }
                </li>);
                fileList.push(files[i]);
            } else {
                failedFiles.push(<li key={i}>
                    <TintableSvg key={i} src={require("../../../../res/img/files.svg")} width="16" height="16" /> { files[i].name || _t('Attachment') } <p>{ _t('Reason') + ": " + fileAcceptedOrError}</p>
                </li>);
            }
        }

        const isQuoting = Boolean(RoomViewStore.getQuotingEvent());
        let replyToWarning = null;
        if (isQuoting) {
            replyToWarning = <p>{
                _t('At this time it is not possible to reply with a file so this will be sent without being a reply.')
            }</p>;
        }

        const acceptedFilesPart = acceptedFiles.length === 0 ? null : (
            <div>
                <p>{ _t('Are you sure you want to upload the following files?') }</p>
                <ul style={{listStyle: 'none', textAlign: 'left'}}>
                    { acceptedFiles }
                </ul>
            </div>
        );

        const failedFilesPart = failedFiles.length === 0 ? null : (
            <div>
                <p>{ _t('The following files cannot be uploaded:') }</p>
                <ul style={{listStyle: 'none', textAlign: 'left'}}>
                    { failedFiles }
                </ul>
            </div>
        );
        let buttonText;
        if (acceptedFiles.length > 0 && failedFiles.length > 0) {
            buttonText = "Upload selected"
        } else if (failedFiles.length > 0) {
            buttonText = "Close"
        }

        Modal.createTrackedDialog('Upload Files confirmation', '', QuestionDialog, {
            title: _t('Upload Files'),
            description: (
                <div>
                    { acceptedFilesPart }
                    { failedFilesPart }
                    { replyToWarning }
                </div>
            ),
            hasCancelButton: acceptedFiles.length > 0,
            button: buttonText,
            onFinished: (shouldUpload) => {
                if (shouldUpload) {
                    // MessageComposer shouldn't have to rely on its parent passing in a callback to upload a file
                    if (fileList) {
                        for (let i=0; i<fileList.length; i++) {
                            this.props.uploadFile(fileList[i]);
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
        dis.dispatch({
            action: 'view_room',
            highlighted: true,
            event_id: createEventId,
            room_id: replacementRoomId,

            // Try to join via the server that sent the event. This converts $something:example.org
            // into a server domain by splitting on colons and ignoring the first entry ("$something").
            via_servers: [this.state.tombstone.getId().split(':').splice(1).join(':')],
        });
    }

    render() {
        const uploadInputStyle = {display: 'none'};
        const MemberStatusMessageAvatar = sdk.getComponent('avatars.MemberStatusMessageAvatar');
        const MessageComposerInput = sdk.getComponent("rooms.MessageComposerInput");

        const controls = [];

        if (this.state.me) {
            controls.push(
                <div key="controls_avatar" className="mx_MessageComposer_avatar">
                    <MemberStatusMessageAvatar member={this.state.me} width={24} height={24} />
                </div>,
            );
        }

        if (this.props.e2eStatus) {
            controls.push(<E2EIcon
                status={this.props.e2eStatus}
                key="e2eIcon"
                className="mx_MessageComposer_e2eIcon" />
            );
        }

        let callButton;
        let videoCallButton;
        let hangupButton;

        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        // Call buttons
        if (this.props.callState && this.props.callState !== 'ended') {
            hangupButton =
                <AccessibleButton className="mx_MessageComposer_button mx_MessageComposer_hangup"
                    key="controls_hangup"
                    onClick={this.onHangupClick}
                    title={_t('Hangup')}
                >
                </AccessibleButton>;
        } else {
            callButton =
                <AccessibleButton className="mx_MessageComposer_button mx_MessageComposer_voicecall"
                    key="controls_call"
                    onClick={this.onVoiceCallClick}
                    title={_t('Voice call')}
                >
                </AccessibleButton>;
            videoCallButton =
                <AccessibleButton className="mx_MessageComposer_button mx_MessageComposer_videocall"
                    key="controls_videocall"
                    onClick={this.onCallClick}
                    title={_t('Video call')}
                >
                </AccessibleButton>;
        }

        if (!this.state.tombstone && this.state.canSendMessages) {
            // This also currently includes the call buttons. Really we should
            // check separately for whether we can call, but this is slightly
            // complex because of conference calls.
            const uploadButton = (
                <AccessibleButton className="mx_MessageComposer_button mx_MessageComposer_upload"
                    key="controls_upload"
                    onClick={this.onUploadClick}
                    title={_t('Upload file')}
                >
                    <input ref="uploadInput" type="file"
                        style={uploadInputStyle}
                        multiple
                        onChange={this.onUploadFileSelected} />
                </AccessibleButton>
            );

            const formattingButton = this.state.inputState.isRichTextEnabled ? (
                <AccessibleButton element="img" className="mx_MessageComposer_formatting"
                     alt={_t("Show Text Formatting Toolbar")}
                     title={_t("Show Text Formatting Toolbar")}
                     src={require("../../../../res/img/button-text-formatting.svg")}
                     onClick={this.onToggleFormattingClicked}
                     style={{visibility: this.state.showFormatting ? 'hidden' : 'visible'}}
                     key="controls_formatting" />
            ) : null;

            const roomIsEncrypted = MatrixClientPeg.get().isRoomEncrypted(this.props.room.roomId);
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
                    onInputStateChanged={this.onInputStateChanged}
                    permalinkCreator={this.props.permalinkCreator} />,
                formattingButton,
                stickerpickerButton,
                uploadButton,
                hangupButton,
                callButton,
                videoCallButton,
            );
        } else if (this.state.tombstone) {
            const replacementRoomId = this.state.tombstone.getContent()['replacement_room'];

            controls.push(<div className="mx_MessageComposer_replaced_wrapper">
                <div className="mx_MessageComposer_replaced_valign">
                    <img className="mx_MessageComposer_roomReplaced_icon" src={require("../../../../res/img/room_replaced.svg")} />
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
                            src={require(`../../../../res/img/button-text-${name}${suffix}.svg`)}
                            height="17" />;
                },
            );

            formatBar =
                <div className="mx_MessageComposer_formatbar_wrapper">
                    <div className="mx_MessageComposer_formatbar">
                        { formatButtons }
                        <div style={{ flex: 1 }}></div>
                        <AccessibleButton className="mx_MessageComposer_formatbar_markdown mx_MessageComposer_markdownDisabled"
                            onClick={this.onToggleMarkdownClicked}
                            title={_t("Markdown is disabled")}
                        />
                        <AccessibleButton element="img" title={_t("Hide Text Formatting Toolbar")}
                            onClick={this.onToggleFormattingClicked}
                            className="mx_MessageComposer_formatbar_cancel mx_filterFlipColor"
                            src={require("../../../../res/img/icon-text-cancel.svg")}
                        />
                    </div>
                </div>;
        }

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

    // function to test whether a file should be allowed to be uploaded.
    uploadAllowed: PropTypes.func.isRequired,

    // string representing the current room app drawer state
    showApps: PropTypes.bool
};
