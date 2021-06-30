/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

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
import classNames from 'classnames';
import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import * as sdk from '../../../index';
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import dis from '../../../dispatcher/dispatcher';
import { ActionPayload } from "../../../dispatcher/payloads";
import Stickerpicker from './Stickerpicker';
import { makeRoomPermalink, RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import ContentMessages from '../../../ContentMessages';
import E2EIcon from './E2EIcon';
import SettingsStore from "../../../settings/SettingsStore";
import { aboveLeftOf, ContextMenu, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import ReplyPreview from "./ReplyPreview";
import { UIFeature } from "../../../settings/UIFeature";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import VoiceRecordComposerTile from "./VoiceRecordComposerTile";
import { VoiceRecordingStore } from "../../../stores/VoiceRecordingStore";
import { RecordingState } from "../../../voice/VoiceRecording";
import Tooltip, { Alignment } from "../elements/Tooltip";
import ResizeNotifier from "../../../utils/ResizeNotifier";
import { E2EStatus } from '../../../utils/ShieldUtils';
import SendMessageComposer from "./SendMessageComposer";
import { ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../dispatcher/actions";

interface IComposerAvatarProps {
    me: object;
}

function ComposerAvatar(props: IComposerAvatarProps) {
    const MemberStatusMessageAvatar = sdk.getComponent('avatars.MemberStatusMessageAvatar');
    return <div className="mx_MessageComposer_avatar">
        <MemberStatusMessageAvatar member={props.me} width={24} height={24} />
    </div>;
}

interface ISendButtonProps {
    onClick: () => void;
}

function SendButton(props: ISendButtonProps) {
    return (
        <AccessibleTooltipButton
            className="mx_MessageComposer_sendMessage"
            onClick={props.onClick}
            title={_t('Send message')}
        />
    );
}

const EmojiButton = ({ addEmoji }) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    let contextMenu;
    if (menuDisplayed) {
        const buttonRect = button.current.getBoundingClientRect();
        const EmojiPicker = sdk.getComponent('emojipicker.EmojiPicker');
        contextMenu = <ContextMenu {...aboveLeftOf(buttonRect)} onFinished={closeMenu} managed={false}>
            <EmojiPicker onChoose={addEmoji} showQuickReactions={true} />
        </ContextMenu>;
    }

    const className = classNames(
        "mx_MessageComposer_button",
        "mx_MessageComposer_emoji",
        {
            "mx_MessageComposer_button_highlight": menuDisplayed,
        },
    );

    // TODO: replace ContextMenuTooltipButton with a unified representation of
    // the header buttons and the right panel buttons
    return <React.Fragment>
        <ContextMenuTooltipButton
            className={className}
            onClick={openMenu}
            isExpanded={menuDisplayed}
            title={_t('Emoji picker')}
            inputRef={button}
        >

        </ContextMenuTooltipButton>

        { contextMenu }
    </React.Fragment>;
};

interface IUploadButtonProps {
    roomId: string;
}

class UploadButton extends React.Component<IUploadButtonProps> {
    private uploadInput = React.createRef<HTMLInputElement>();
    private dispatcherRef: string;

    constructor(props) {
        super(props);

        this.dispatcherRef = dis.register(this.onAction);
    }

    componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload) => {
        if (payload.action === "upload_file") {
            this.onUploadClick();
        }
    };

    private onUploadClick = () => {
        if (MatrixClientPeg.get().isGuest()) {
            dis.dispatch({ action: 'require_registration' });
            return;
        }
        this.uploadInput.current.click();
    };

    private onUploadFileInputChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
        if (ev.target.files.length === 0) return;

        // take a copy so we can safely reset the value of the form control
        // (Note it is a FileList: we can't use slice or sensible iteration).
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
    };

    render() {
        const uploadInputStyle = { display: 'none' };
        return (
            <AccessibleTooltipButton
                className="mx_MessageComposer_button mx_MessageComposer_upload"
                onClick={this.onUploadClick}
                title={_t('Upload file')}
            >
                <input
                    ref={this.uploadInput}
                    type="file"
                    style={uploadInputStyle}
                    multiple
                    onChange={this.onUploadFileInputChange}
                />
            </AccessibleTooltipButton>
        );
    }
}

interface IProps {
    room: Room;
    resizeNotifier: ResizeNotifier;
    permalinkCreator: RoomPermalinkCreator;
    replyToEvent?: MatrixEvent;
    e2eStatus?: E2EStatus;
}

interface IState {
    tombstone: MatrixEvent;
    canSendMessages: boolean;
    isComposerEmpty: boolean;
    haveRecording: boolean;
    recordingTimeLeftSeconds?: number;
    me?: RoomMember;
}

@replaceableComponent("views.rooms.MessageComposer")
export default class MessageComposer extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private messageComposerInput: SendMessageComposer;
    private voiceRecordingButton: VoiceRecordComposerTile;

    constructor(props) {
        super(props);
        VoiceRecordingStore.instance.on(UPDATE_EVENT, this.onVoiceStoreUpdate);

        this.state = {
            tombstone: this.getRoomTombstone(),
            canSendMessages: this.props.room.maySendMessage(),
            isComposerEmpty: true,
            haveRecording: false,
            recordingTimeLeftSeconds: null, // when set to a number, shows a toast
        };
    }

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on("RoomState.events", this.onRoomStateEvents);
        this.waitForOwnMember();
    }

    private onAction = (payload: ActionPayload) => {
        if (payload.action === 'reply_to_event') {
            // add a timeout for the reply preview to be rendered, so
            // that the ScrollPanel listening to the resizeNotifier can
            // correctly measure it's new height and scroll down to keep
            // at the bottom if it already is
            setTimeout(() => {
                this.props.resizeNotifier.notifyTimelineHeightChanged();
            }, 100);
        }
    };

    private waitForOwnMember() {
        // if we have the member already, do that
        const me = this.props.room.getMember(MatrixClientPeg.get().getUserId());
        if (me) {
            this.setState({ me });
            return;
        }
        // Otherwise, wait for member loading to finish and then update the member for the avatar.
        // The members should already be loading, and loadMembersIfNeeded
        // will return the promise for the existing operation
        this.props.room.loadMembersIfNeeded().then(() => {
            const me = this.props.room.getMember(MatrixClientPeg.get().getUserId());
            this.setState({ me });
        });
    }

    componentWillUnmount() {
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("RoomState.events", this.onRoomStateEvents);
        }
        VoiceRecordingStore.instance.off(UPDATE_EVENT, this.onVoiceStoreUpdate);
        dis.unregister(this.dispatcherRef);
    }

    private onRoomStateEvents = (ev, state) => {
        if (ev.getRoomId() !== this.props.room.roomId) return;

        if (ev.getType() === 'm.room.tombstone') {
            this.setState({ tombstone: this.getRoomTombstone() });
        }
        if (ev.getType() === 'm.room.power_levels') {
            this.setState({ canSendMessages: this.props.room.maySendMessage() });
        }
    };

    private getRoomTombstone() {
        return this.props.room.currentState.getStateEvents('m.room.tombstone', '');
    }

    private onTombstoneClick = (ev) => {
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
            _type: "tombstone", // instrumentation

            // Try to join via the server that sent the event. This converts @something:example.org
            // into a server domain by splitting on colons and ignoring the first entry ("@something").
            via_servers: viaServers,
            opts: {
                // These are passed down to the js-sdk's /join call
                viaServers: viaServers,
            },
        });
    };

    private renderPlaceholderText = () => {
        if (this.props.replyToEvent) {
            if (this.props.e2eStatus) {
                return _t('Send an encrypted reply…');
            } else {
                return _t('Send a reply…');
            }
        } else {
            if (this.props.e2eStatus) {
                return _t('Send an encrypted message…');
            } else {
                return _t('Send a message…');
            }
        }
    };

    addEmoji(emoji: string) {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            text: emoji,
        });
    }

    sendMessage = async () => {
        if (this.state.haveRecording && this.voiceRecordingButton) {
            // There shouldn't be any text message to send when a voice recording is active, so
            // just send out the voice recording.
            await this.voiceRecordingButton.send();
            return;
        }

        // XXX: Private function access
        this.messageComposerInput._sendMessage();
    };

    onChange = (model) => {
        this.setState({
            isComposerEmpty: model.isEmpty,
        });
    };

    private onVoiceStoreUpdate = () => {
        const recording = VoiceRecordingStore.instance.activeRecording;
        this.setState({ haveRecording: !!recording });
        if (recording) {
            // We show a little heads up that the recording is about to automatically end soon. The 3s
            // display time is completely arbitrary. Note that we don't need to deregister the listener
            // because the recording instance will clean that up for us.
            recording.on(RecordingState.EndingSoon, ({ secondsLeft }) => {
                this.setState({ recordingTimeLeftSeconds: secondsLeft });
                setTimeout(() => this.setState({ recordingTimeLeftSeconds: null }), 3000);
            });
        }
    };

    render() {
        const controls = [
            this.state.me ? <ComposerAvatar key="controls_avatar" me={this.state.me} /> : null,
            this.props.e2eStatus ?
                <E2EIcon key="e2eIcon" status={this.props.e2eStatus} className="mx_MessageComposer_e2eIcon" /> :
                null,
        ];

        if (!this.state.tombstone && this.state.canSendMessages) {
            const SendMessageComposer = sdk.getComponent("rooms.SendMessageComposer");

            controls.push(
                <SendMessageComposer
                    ref={(c) => this.messageComposerInput = c}
                    key="controls_input"
                    room={this.props.room}
                    placeholder={this.renderPlaceholderText()}
                    resizeNotifier={this.props.resizeNotifier}
                    permalinkCreator={this.props.permalinkCreator}
                    replyToEvent={this.props.replyToEvent}
                    onChange={this.onChange}
                    disabled={this.state.haveRecording}
                />,
            );

            if (!this.state.haveRecording) {
                controls.push(
                    <UploadButton key="controls_upload" roomId={this.props.room.roomId} />,
                    <EmojiButton key="emoji_button" addEmoji={this.addEmoji} />,
                );
            }

            if (SettingsStore.getValue(UIFeature.Widgets) &&
                SettingsStore.getValue("MessageComposerInput.showStickersButton") &&
                !this.state.haveRecording) {
                controls.push(<Stickerpicker key="stickerpicker_controls_button" room={this.props.room} />);
            }

            if (SettingsStore.getValue("feature_voice_messages")) {
                controls.push(<VoiceRecordComposerTile
                    key="controls_voice_record"
                    ref={c => this.voiceRecordingButton = c}
                    room={this.props.room} />);
            }

            if (!this.state.isComposerEmpty || this.state.haveRecording) {
                controls.push(
                    <SendButton key="controls_send" onClick={this.sendMessage} />,
                );
            }
        } else if (this.state.tombstone) {
            const replacementRoomId = this.state.tombstone.getContent()['replacement_room'];

            const continuesLink = replacementRoomId ? (
                <a href={makeRoomPermalink(replacementRoomId)}
                    className="mx_MessageComposer_roomReplaced_link"
                    onClick={this.onTombstoneClick}
                >
                    {_t("The conversation continues here.")}
                </a>
            ) : '';

            controls.push(<div className="mx_MessageComposer_replaced_wrapper" key="room_replaced">
                <div className="mx_MessageComposer_replaced_valign">
                    <img className="mx_MessageComposer_roomReplaced_icon"
                        src={require("../../../../res/img/room_replaced.svg")}
                    />
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

        let recordingTooltip;
        const secondsLeft = Math.round(this.state.recordingTimeLeftSeconds);
        if (secondsLeft) {
            recordingTooltip = <Tooltip
                label={_t("%(seconds)ss left", { seconds: secondsLeft })}
                alignment={Alignment.Top} yOffset={-50}
            />;
        }

        return (
            <div className="mx_MessageComposer mx_GroupLayout">
                {recordingTooltip}
                <div className="mx_MessageComposer_wrapper">
                    <ReplyPreview permalinkCreator={this.props.permalinkCreator} />
                    <div className="mx_MessageComposer_row">
                        { controls }
                    </div>
                </div>
            </div>
        );
    }
}
