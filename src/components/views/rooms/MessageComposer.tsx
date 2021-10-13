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
import React, { createRef } from 'react';
import classNames from 'classnames';
import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
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
import {
    aboveLeftOf,
    ContextMenu,
    useContextMenu,
    MenuItem,
    AboveLeftOf,
} from "../../structures/ContextMenu";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import ReplyPreview from "./ReplyPreview";
import { UIFeature } from "../../../settings/UIFeature";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import VoiceRecordComposerTile from "./VoiceRecordComposerTile";
import { VoiceRecordingStore } from "../../../stores/VoiceRecordingStore";
import { RecordingState } from "../../../audio/VoiceRecording";
import Tooltip, { Alignment } from "../elements/Tooltip";
import ResizeNotifier from "../../../utils/ResizeNotifier";
import { E2EStatus } from '../../../utils/ShieldUtils';
import SendMessageComposer, { SendMessageComposer as SendMessageComposerClass } from "./SendMessageComposer";
import { ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../dispatcher/actions";
import EditorModel from "../../../editor/model";
import EmojiPicker from '../emojipicker/EmojiPicker';
import MemberStatusMessageAvatar from "../avatars/MemberStatusMessageAvatar";
import UIStore, { UI_EVENTS } from '../../../stores/UIStore';
import Modal from "../../../Modal";
import InfoDialog from "../dialogs/InfoDialog";

let instanceCount = 0;
const NARROW_MODE_BREAKPOINT = 500;

interface IComposerAvatarProps {
    me: RoomMember;
}

function ComposerAvatar(props: IComposerAvatarProps) {
    return <div className="mx_MessageComposer_avatar">
        <MemberStatusMessageAvatar member={props.me} width={24} height={24} />
    </div>;
}

interface ISendButtonProps {
    onClick: () => void;
    title?: string; // defaults to something generic
}

function SendButton(props: ISendButtonProps) {
    return (
        <AccessibleTooltipButton
            className="mx_MessageComposer_sendMessage"
            onClick={props.onClick}
            title={props.title ?? _t('Send message')}
        />
    );
}

interface IEmojiButtonProps {
    addEmoji: (unicode: string) => boolean;
    menuPosition: any; // TODO: Types
    narrowMode: boolean;
}

const EmojiButton: React.FC<IEmojiButtonProps> = ({ addEmoji, menuPosition, narrowMode }) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    let contextMenu;
    if (menuDisplayed) {
        const position = menuPosition ?? aboveLeftOf(button.current.getBoundingClientRect());
        contextMenu = <ContextMenu {...position} onFinished={closeMenu} managed={false}>
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
        <AccessibleTooltipButton
            className={className}
            onClick={openMenu}
            title={!narrowMode && _t('Emoji picker')}
            label={narrowMode && _t("Add emoji")}
        />

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

// TODO: [polls] Make this component actually do something
class PollButton extends React.PureComponent {
    private onCreateClick = () => {
        Modal.createTrackedDialog('Polls', 'Not Yet Implemented', InfoDialog, {
            // XXX: Deliberately not translated given this dialog is meant to be replaced and we don't
            // want to clutter the language files with short-lived strings.
            title: "Polls are currently in development",
            description: "" +
                "Thanks for testing polls! We haven't quite gotten a chance to write the feature yet " +
                "though. Check back later for updates.",
            hasCloseButton: true,
        });
    };

    render() {
        return (
            <AccessibleTooltipButton
                className="mx_MessageComposer_button mx_MessageComposer_poll"
                onClick={this.onCreateClick}
                title={_t('Create poll')}
            />
        );
    }
}

interface IProps {
    room: Room;
    resizeNotifier: ResizeNotifier;
    permalinkCreator: RoomPermalinkCreator;
    replyToEvent?: MatrixEvent;
    replyInThread?: boolean;
    showReplyPreview?: boolean;
    e2eStatus?: E2EStatus;
    compact?: boolean;
}

interface IState {
    tombstone: MatrixEvent;
    canSendMessages: boolean;
    isComposerEmpty: boolean;
    haveRecording: boolean;
    recordingTimeLeftSeconds?: number;
    me?: RoomMember;
    narrowMode?: boolean;
    isMenuOpen: boolean;
    showStickers: boolean;
}

@replaceableComponent("views.rooms.MessageComposer")
export default class MessageComposer extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private messageComposerInput = createRef<SendMessageComposerClass>();
    private voiceRecordingButton = createRef<VoiceRecordComposerTile>();
    private ref: React.RefObject<HTMLDivElement> = createRef();
    private instanceId: number;

    static defaultProps = {
        replyInThread: false,
        showReplyPreview: true,
        compact: false,
    };

    constructor(props) {
        super(props);
        VoiceRecordingStore.instance.on(UPDATE_EVENT, this.onVoiceStoreUpdate);

        this.state = {
            tombstone: this.getRoomTombstone(),
            canSendMessages: this.props.room.maySendMessage(),
            isComposerEmpty: true,
            haveRecording: false,
            recordingTimeLeftSeconds: null, // when set to a number, shows a toast
            isMenuOpen: false,
            showStickers: false,
        };

        this.instanceId = instanceCount++;
    }

    componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
        MatrixClientPeg.get().on("RoomState.events", this.onRoomStateEvents);
        this.waitForOwnMember();
        UIStore.instance.trackElementDimensions(`MessageComposer${this.instanceId}`, this.ref.current);
        UIStore.instance.on(`MessageComposer${this.instanceId}`, this.onResize);
    }

    private onResize = (type: UI_EVENTS, entry: ResizeObserverEntry) => {
        if (type === UI_EVENTS.Resize) {
            const narrowMode = entry.contentRect.width <= NARROW_MODE_BREAKPOINT;
            this.setState({
                narrowMode,
                isMenuOpen: !narrowMode ? false : this.state.isMenuOpen,
                showStickers: false,
            });
        }
    };

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
        UIStore.instance.stopTrackingElementDimensions(`MessageComposer${this.instanceId}`);
        UIStore.instance.removeListener(`MessageComposer${this.instanceId}`, this.onResize);
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
            if (this.props.replyInThread && this.props.e2eStatus) {
                return _t('Reply to encrypted thread…');
            } else if (this.props.replyInThread) {
                return _t('Reply to thread…');
            } else if (this.props.e2eStatus) {
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

    private addEmoji(emoji: string): boolean {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            text: emoji,
        });
        return true;
    }

    private sendMessage = async () => {
        if (this.state.haveRecording && this.voiceRecordingButton.current) {
            // There shouldn't be any text message to send when a voice recording is active, so
            // just send out the voice recording.
            await this.voiceRecordingButton.current?.send();
            return;
        }

        this.messageComposerInput.current?.sendMessage();
    };

    private onChange = (model: EditorModel) => {
        this.setState({
            isComposerEmpty: model.isEmpty,
        });
    };

    private onVoiceStoreUpdate = () => {
        const recording = VoiceRecordingStore.instance.activeRecording;
        if (recording) {
            // Delay saying we have a recording until it is started, as we might not yet have A/V permissions
            recording.on(RecordingState.Started, () => {
                this.setState({ haveRecording: !!VoiceRecordingStore.instance.activeRecording });
            });
            // We show a little heads up that the recording is about to automatically end soon. The 3s
            // display time is completely arbitrary. Note that we don't need to deregister the listener
            // because the recording instance will clean that up for us.
            recording.on(RecordingState.EndingSoon, ({ secondsLeft }) => {
                this.setState({ recordingTimeLeftSeconds: secondsLeft });
                setTimeout(() => this.setState({ recordingTimeLeftSeconds: null }), 3000);
            });
        } else {
            this.setState({ haveRecording: false });
        }
    };

    private shouldShowStickerPicker = (): boolean => {
        return SettingsStore.getValue(UIFeature.Widgets)
        && SettingsStore.getValue("MessageComposerInput.showStickersButton")
        && !this.state.haveRecording;
    };

    private showStickers = (showStickers: boolean) => {
        this.setState({ showStickers });
    };

    private toggleButtonMenu = (): void => {
        this.setState({
            isMenuOpen: !this.state.isMenuOpen,
        });
    };

    private renderButtons(menuPosition): JSX.Element | JSX.Element[] {
        const buttons: JSX.Element[] = [];
        if (!this.state.haveRecording) {
            if (SettingsStore.getValue("feature_polls")) {
                buttons.push(
                    <PollButton key="polls" />,
                );
            }
            buttons.push(
                <UploadButton key="controls_upload" roomId={this.props.room.roomId} />,
            );
            buttons.push(
                <EmojiButton key="emoji_button" addEmoji={this.addEmoji} menuPosition={menuPosition} narrowMode={this.state.narrowMode} />,
            );
        }
        if (this.shouldShowStickerPicker()) {
            let title;
            if (!this.state.narrowMode) {
                title = this.state.showStickers ? _t("Hide Stickers") : _t("Show Stickers");
            }

            buttons.push(
                <AccessibleTooltipButton
                    id='stickersButton'
                    key="controls_stickers"
                    className="mx_MessageComposer_button mx_MessageComposer_stickers"
                    onClick={() => this.showStickers(!this.state.showStickers)}
                    title={title}
                    label={this.state.narrowMode && _t("Send a sticker")}
                />,
            );
        }
        if (!this.state.haveRecording && !this.state.narrowMode) {
            buttons.push(
                <AccessibleTooltipButton
                    className="mx_MessageComposer_button mx_MessageComposer_voiceMessage"
                    onClick={() => this.voiceRecordingButton.current?.onRecordStartEndClick()}
                    title={_t("Send voice message")}
                />,
            );
        }

        if (!this.state.narrowMode) {
            return buttons;
        } else {
            const classnames = classNames({
                mx_MessageComposer_button: true,
                mx_MessageComposer_buttonMenu: true,
                mx_MessageComposer_closeButtonMenu: this.state.isMenuOpen,
            });

            return <>
                { buttons[0] }
                <AccessibleTooltipButton
                    className={classnames}
                    onClick={this.toggleButtonMenu}
                    title={_t("More options")}
                    tooltip={false}
                />
                { this.state.isMenuOpen && (
                    <ContextMenu
                        onFinished={this.toggleButtonMenu}
                        {...menuPosition}
                        menuPaddingRight={10}
                        menuPaddingTop={5}
                        menuPaddingBottom={5}
                        menuWidth={150}
                        wrapperClassName="mx_MessageComposer_Menu"
                    >
                        { buttons.slice(1).map((button, index) => (
                            <MenuItem className="mx_CallContextMenu_item" key={index} onClick={this.toggleButtonMenu}>
                                { button }
                            </MenuItem>
                        )) }
                    </ContextMenu>
                ) }
            </>;
        }
    }

    render() {
        const controls = [
            this.state.me && !this.props.compact ? <ComposerAvatar key="controls_avatar" me={this.state.me} /> : null,
            this.props.e2eStatus ?
                <E2EIcon key="e2eIcon" status={this.props.e2eStatus} className="mx_MessageComposer_e2eIcon" /> :
                null,
        ];

        let menuPosition: AboveLeftOf | undefined;
        if (this.ref.current) {
            const contentRect = this.ref.current.getBoundingClientRect();
            menuPosition = aboveLeftOf(contentRect);
        }

        if (!this.state.tombstone && this.state.canSendMessages) {
            controls.push(
                <SendMessageComposer
                    ref={this.messageComposerInput}
                    key="controls_input"
                    room={this.props.room}
                    placeholder={this.renderPlaceholderText()}
                    permalinkCreator={this.props.permalinkCreator}
                    replyInThread={this.props.replyInThread}
                    replyToEvent={this.props.replyToEvent}
                    onChange={this.onChange}
                    disabled={this.state.haveRecording}
                />,
            );

            controls.push(<VoiceRecordComposerTile
                key="controls_voice_record"
                ref={this.voiceRecordingButton}
                room={this.props.room} />);
        } else if (this.state.tombstone) {
            const replacementRoomId = this.state.tombstone.getContent()['replacement_room'];

            const continuesLink = replacementRoomId ? (
                <a href={makeRoomPermalink(replacementRoomId)}
                    className="mx_MessageComposer_roomReplaced_link"
                    onClick={this.onTombstoneClick}
                >
                    { _t("The conversation continues here.") }
                </a>
            ) : '';

            controls.push(<div className="mx_MessageComposer_replaced_wrapper" key="room_replaced">
                <div className="mx_MessageComposer_replaced_valign">
                    <img className="mx_MessageComposer_roomReplaced_icon"
                        src={require("../../../../res/img/room_replaced.svg")}
                    />
                    <span className="mx_MessageComposer_roomReplaced_header">
                        { _t("This room has been replaced and is no longer active.") }
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
                alignment={Alignment.Top}
                yOffset={-50}
            />;
        }
        controls.push(
            <Stickerpicker
                room={this.props.room}
                showStickers={this.state.showStickers}
                setShowStickers={this.showStickers}
                menuPosition={menuPosition} />,
        );

        const showSendButton = !this.state.isComposerEmpty || this.state.haveRecording;

        const classes = classNames({
            "mx_MessageComposer": true,
            "mx_GroupLayout": true,
            "mx_MessageComposer--compact": this.props.compact,
        });

        return (
            <div className={classes} ref={this.ref}>
                { recordingTooltip }
                <div className="mx_MessageComposer_wrapper">
                    { this.props.showReplyPreview && (
                        <ReplyPreview permalinkCreator={this.props.permalinkCreator} />
                    ) }
                    <div className="mx_MessageComposer_row">
                        { controls }
                        { this.renderButtons(menuPosition) }
                        { showSendButton && (
                            <SendButton
                                key="controls_send"
                                onClick={this.sendMessage}
                                title={this.state.haveRecording ? _t("Send voice message") : undefined}
                            />
                        ) }
                    </div>
                </div>
            </div>
        );
    }
}
