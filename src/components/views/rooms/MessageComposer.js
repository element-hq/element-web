/*
Copyright 2015, 2016 OpenMarket Ltd

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
var React = require('react');

var CallHandler = require('../../../CallHandler');
var MatrixClientPeg = require('../../../MatrixClientPeg');
var Modal = require('../../../Modal');
var sdk = require('../../../index');
var dis = require('../../../dispatcher');
import Autocomplete from './Autocomplete';
import classNames from 'classnames';

import UserSettingsStore from '../../../UserSettingsStore';


export default class MessageComposer extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.onCallClick = this.onCallClick.bind(this);
        this.onHangupClick = this.onHangupClick.bind(this);
        this.onUploadClick = this.onUploadClick.bind(this);
        this.onUploadFileSelected = this.onUploadFileSelected.bind(this);
        this.onVoiceCallClick = this.onVoiceCallClick.bind(this);
        this.onInputContentChanged = this.onInputContentChanged.bind(this);
        this.onUpArrow = this.onUpArrow.bind(this);
        this.onDownArrow = this.onDownArrow.bind(this);
        this._tryComplete = this._tryComplete.bind(this);
        this._onAutocompleteConfirm = this._onAutocompleteConfirm.bind(this);
        this.onToggleFormattingClicked = this.onToggleFormattingClicked.bind(this);
        this.onToggleMarkdownClicked = this.onToggleMarkdownClicked.bind(this);
        this.onInputStateChanged = this.onInputStateChanged.bind(this);
        this.onEvent = this.onEvent.bind(this);

        this.state = {
            autocompleteQuery: '',
            selection: null,
            inputState: {
                style: [],
                blockType: null,
                isRichtextEnabled: UserSettingsStore.getSyncedSetting('MessageComposerInput.isRichTextEnabled', true),
                wordCount: 0,
            },
            showFormatting: UserSettingsStore.getSyncedSetting('MessageComposer.showFormatting', false),
        };

    }

    componentDidMount() {
        // N.B. using 'event' rather than 'RoomEvents' otherwise the crypto handler
        // for 'event' fires *after* 'RoomEvent', and our room won't have yet been
        // marked as encrypted.
        // XXX: fragile as all hell - fixme somehow, perhaps with a dedicated Room.encryption event or something.
        MatrixClientPeg.get().on("event", this.onEvent);
    }

    componentWillUnmount() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("event", this.onEvent);
        }
    }

    onEvent(event) {
        if (event.getType() !== 'm.room.encryption') return;
        if (event.getRoomId() !== this.props.room.roomId) return;
        this.forceUpdate();
    }

    onUploadClick(ev) {
        if (MatrixClientPeg.get().isGuest()) {
            let NeedToRegisterDialog = sdk.getComponent("dialogs.NeedToRegisterDialog");
            Modal.createDialog(NeedToRegisterDialog, {
                title: "Please Register",
                description: "Guest users can't upload files. Please register to upload.",
            });
            return;
        }

        this.refs.uploadInput.click();
    }

    onUploadFileSelected(ev) {
        let files = ev.target.files;

        let QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
        let TintableSvg = sdk.getComponent("elements.TintableSvg");

        let fileList = [];
        for (let i=0; i<files.length; i++) {
            fileList.push(<li key={i}>
                <TintableSvg key={i} src="img/files.svg" width="16" height="16" /> {files[i].name}
            </li>);
        }

        Modal.createDialog(QuestionDialog, {
            title: "Upload Files",
            description: (
                <div>
                    <p>Are you sure you want upload the following files?</p>
                    <ul style={{listStyle: 'none', textAlign: 'left'}}>
                        {fileList}
                    </ul>
                </div>
            ),
            onFinished: (shouldUpload) => {
                if(shouldUpload) {
                    // MessageComposer shouldn't have to rely on its parent passing in a callback to upload a file
                    if (files) {
                        for(var i=0; i<files.length; i++) {
                            this.props.uploadFile(files[i]);
                        }
                    }
                }

                this.refs.uploadInput.value = null;
            },
        });
    }

    onHangupClick() {
        var call = CallHandler.getCallForRoom(this.props.room.roomId);
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
            type: 'voice',
            room_id: this.props.room.roomId,
        });
    }

    onInputContentChanged(content: string, selection: {start: number, end: number}) {
        this.setState({
            autocompleteQuery: content,
            selection,
        });
    }

    onInputStateChanged(inputState) {
        this.setState({inputState});
    }

    onUpArrow() {
       return this.refs.autocomplete.onUpArrow();
    }

    onDownArrow() {
        return this.refs.autocomplete.onDownArrow();
    }

    _tryComplete(): boolean {
        if (this.refs.autocomplete) {
            return this.refs.autocomplete.onCompletionClicked();
        }
        return false;
    }

    _onAutocompleteConfirm(range, completion) {
        if (this.messageComposerInput) {
            this.messageComposerInput.setDisplayedCompletion(range, completion);
        }
    }

    onFormatButtonClicked(name: "bold" | "italic" | "strike" | "code" | "underline" | "quote" | "bullet" | "numbullet", event) {
        event.preventDefault();
        this.messageComposerInput.onFormatButtonClicked(name, event);
    }

    onToggleFormattingClicked() {
        UserSettingsStore.setSyncedSetting('MessageComposer.showFormatting', !this.state.showFormatting);
        this.setState({showFormatting: !this.state.showFormatting});
    }

    onToggleMarkdownClicked(e) {
        e.preventDefault(); // don't steal focus from the editor!
        this.messageComposerInput.enableRichtext(!this.state.inputState.isRichtextEnabled);
    }

    render() {
        var me = this.props.room.getMember(MatrixClientPeg.get().credentials.userId);
        var uploadInputStyle = {display: 'none'};
        var MemberAvatar = sdk.getComponent('avatars.MemberAvatar');
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        var MessageComposerInput = sdk.getComponent("rooms.MessageComposerInput" +
            (UserSettingsStore.isFeatureEnabled('rich_text_editor') ? "" : "Old"));

        var controls = [];

        controls.push(
            <div key="controls_avatar" className="mx_MessageComposer_avatar">
                <MemberAvatar member={me} width={24} height={24} />
            </div>
        );

        let e2eimg, e2etitle;

        if (MatrixClientPeg.get().isRoomEncrypted(this.props.room.roomId)) {
            // FIXME: show a /!\ if there are untrusted devices in the room...
            e2eimg = 'img/e2e-verified.svg';
            e2etitle = 'Encrypted room';
        } else {
            e2eimg = 'img/e2e-unencrypted.svg';
            e2etitle = 'Unencrypted room';
        }

        controls.push(
            <img key="e2eIcon" className="mx_MessageComposer_e2eIcon" src={e2eimg} width="12" height="12"
                alt={e2etitle} title={e2etitle}
            />
        );
        var callButton, videoCallButton, hangupButton;
        if (this.props.callState && this.props.callState !== 'ended') {
            hangupButton =
                <div key="controls_hangup" className="mx_MessageComposer_hangup" onClick={this.onHangupClick}>
                    <img src="img/hangup.svg" alt="Hangup" title="Hangup" width="25" height="26"/>
                </div>;
        }
        else {
            callButton =
                <div key="controls_call" className="mx_MessageComposer_voicecall" onClick={this.onVoiceCallClick} title="Voice call">
                    <TintableSvg src="img/icon-call.svg" width="35" height="35"/>
                </div>;
            videoCallButton =
                <div key="controls_videocall" className="mx_MessageComposer_videocall" onClick={this.onCallClick} title="Video call">
                    <TintableSvg src="img/icons-video.svg" width="35" height="35"/>
                </div>;
        }

        var canSendMessages = this.props.room.currentState.maySendMessage(
            MatrixClientPeg.get().credentials.userId);

        if (canSendMessages) {
            // This also currently includes the call buttons. Really we should
            // check separately for whether we can call, but this is slightly
            // complex because of conference calls.
            var uploadButton = (
                <div key="controls_upload" className="mx_MessageComposer_upload"
                        onClick={this.onUploadClick} title="Upload file">
                    <TintableSvg src="img/icons-upload.svg" width="35" height="35"/>
                    <input ref="uploadInput" type="file"
                        style={uploadInputStyle}
                        multiple
                        onChange={this.onUploadFileSelected} />
                </div>
            );

            const formattingButton = (
                <img className="mx_MessageComposer_formatting"
                     title="Show Text Formatting Toolbar"
                     src="img/button-text-formatting.svg"
                     onClick={this.onToggleFormattingClicked}
                     style={{visibility: this.state.showFormatting ||
                       !UserSettingsStore.isFeatureEnabled('rich_text_editor') ? 'hidden' : 'visible'}}
                     key="controls_formatting" />
            );

            controls.push(
                <MessageComposerInput
                    ref={c => this.messageComposerInput = c}
                    key="controls_input"
                    onResize={this.props.onResize}
                    room={this.props.room}
                    tryComplete={this._tryComplete}
                    onUpArrow={this.onUpArrow}
                    onDownArrow={this.onDownArrow}
                    tabComplete={this.props.tabComplete} // used for old messagecomposerinput/tabcomplete
                    onContentChanged={this.onInputContentChanged}
                    onInputStateChanged={this.onInputStateChanged} />,
                formattingButton,
                uploadButton,
                hangupButton,
                callButton,
                videoCallButton
            );
        } else {
            controls.push(
                <div key="controls_error" className="mx_MessageComposer_noperm_error">
                    You do not have permission to post to this room
                </div>
            );
        }

        let autoComplete;
        if (UserSettingsStore.isFeatureEnabled('rich_text_editor')) {
            autoComplete = <div className="mx_MessageComposer_autocomplete_wrapper">
                <Autocomplete
                    ref="autocomplete"
                    onConfirm={this._onAutocompleteConfirm}
                    query={this.state.autocompleteQuery}
                    selection={this.state.selection} />
            </div>;
        }


        const {style, blockType} = this.state.inputState;
        const formatButtons = ["bold", "italic", "strike", "underline", "code", "quote", "bullet", "numbullet"].map(
            name => {
                const active = style.includes(name) || blockType === name;
                const suffix = active ? '-o-n' : '';
                const onFormatButtonClicked = this.onFormatButtonClicked.bind(this, name);
                const disabled = !this.state.inputState.isRichtextEnabled && 'underline' === name;
                const className = classNames("mx_MessageComposer_format_button", {
                    mx_MessageComposer_format_button_disabled: disabled,
                });
                return <img className={className}
                            title={name}
                            onMouseDown={disabled ? null : onFormatButtonClicked}
                            key={name}
                            src={`img/button-text-${name}${suffix}.svg`}
                            height="17" />;
            },
        );

        return (
            <div className="mx_MessageComposer mx_fadable" style={{ opacity: this.props.opacity }}>
                <div className="mx_MessageComposer_wrapper">
                    <div className="mx_MessageComposer_row">
                        {controls}
                    </div>
                </div>
                {UserSettingsStore.isFeatureEnabled('rich_text_editor') ?
                    <div className="mx_MessageComposer_formatbar_wrapper">
                        <div className="mx_MessageComposer_formatbar" style={this.state.showFormatting ? {} : {display: 'none'}}>
                            {formatButtons}
                            <div style={{flex: 1}}></div>
                            <img title={`Turn Markdown ${this.state.inputState.isRichtextEnabled ? 'on' : 'off'}`}
                                 onMouseDown={this.onToggleMarkdownClicked}
                                className="mx_MessageComposer_formatbar_markdown"
                                src={`img/button-md-${!this.state.inputState.isRichtextEnabled}.png`} />
                            <img title="Hide Text Formatting Toolbar"
                                 onClick={this.onToggleFormattingClicked}
                                 className="mx_MessageComposer_formatbar_cancel"
                                 src="img/icon-text-cancel.svg" />
                        </div>
                    </div>: null
                }
            </div>
        );
    }
};

MessageComposer.propTypes = {
    tabComplete: React.PropTypes.any,

    // a callback which is called when the height of the composer is
    // changed due to a change in content.
    onResize: React.PropTypes.func,

    // js-sdk Room object
    room: React.PropTypes.object.isRequired,

    // string representing the current voip call state
    callState: React.PropTypes.string,

    // callback when a file to upload is chosen
    uploadFile: React.PropTypes.func.isRequired,

    // opacity for dynamic UI fading effects
    opacity: React.PropTypes.number
};
