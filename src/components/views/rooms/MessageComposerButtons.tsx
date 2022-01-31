/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import classNames from 'classnames';
import { IEventRelation } from "matrix-js-sdk/src/models/event";
import { M_POLL_START } from "matrix-events-sdk";
import React, { ReactElement, useContext } from 'react';
import { Room } from 'matrix-js-sdk/src/models/room';
import { MatrixClient } from 'matrix-js-sdk/src/client';

import { _t } from '../../../languageHandler';
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { CollapsibleButton, ICollapsibleButtonProps } from './CollapsibleButton';
import ContextMenu, { aboveLeftOf, AboveLeftOf, MenuItem, useContextMenu } from '../../structures/ContextMenu';
import dis from '../../../dispatcher/dispatcher';
import EmojiPicker from '../emojipicker/EmojiPicker';
import ErrorDialog from "../dialogs/ErrorDialog";
import LocationButton from '../location/LocationButton';
import Modal from "../../../Modal";
import PollCreateDialog from "../elements/PollCreateDialog";
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { ActionPayload } from '../../../dispatcher/payloads';
import ContentMessages from '../../../ContentMessages';
import MatrixClientContext from '../../../contexts/MatrixClientContext';
import RoomContext from '../../../contexts/RoomContext';

interface IProps {
    addEmoji: (emoji: string) => boolean;
    haveRecording: boolean;
    isMenuOpen: boolean;
    isStickerPickerOpen: boolean;
    menuPosition: AboveLeftOf;
    narrowMode?: boolean;
    onRecordStartEndClick: () => void;
    relation?: IEventRelation;
    setStickerPickerOpen: (isStickerPickerOpen: boolean) => void;
    showLocationButton: boolean;
    showStickersButton: boolean;
    toggleButtonMenu: () => void;
}

const MessageComposerButtons: React.FC<IProps> = (props: IProps) => {
    const matrixClient: MatrixClient = useContext(MatrixClientContext);
    const { room, roomId } = useContext(RoomContext);

    return (
        props.haveRecording
            ? null
            : props.narrowMode
                ? narrowMode(props, room, roomId, matrixClient)
                : wideMode(props, room, roomId, matrixClient)
    );
};

function wideMode(
    props: IProps,
    room: Room,
    roomId: string,
    matrixClient: MatrixClient,
): ReactElement {
    return <>
        { pollButton(props, room) }
        { uploadButton(props, roomId) }
        { showLocationButton(props, room, roomId, matrixClient) }
        { emojiButton(props) }
        { showStickersButton(props) }
        { voiceRecordingButton(props) }
    </>;
}

function narrowMode(
    props: IProps,
    room: Room,
    roomId: string,
    matrixClient: MatrixClient,
): ReactElement {
    const moreOptionsClasses = classNames({
        mx_MessageComposer_button: true,
        mx_MessageComposer_buttonMenu: true,
        mx_MessageComposer_closeButtonMenu: props.isMenuOpen,
    });

    const moreButtons = [
        pollButton(props, room),
        showLocationButton(props, room, roomId, matrixClient),
        emojiButton(props),
        showStickersButton(props),
        voiceRecordingButton(props),
    ].filter(x => x);

    return <>
        { uploadButton(props, roomId) }
        <AccessibleTooltipButton
            className={moreOptionsClasses}
            onClick={props.toggleButtonMenu}
            title={_t("More options")}
            tooltip={false}
        />
        { props.isMenuOpen && (
            <ContextMenu
                onFinished={props.toggleButtonMenu}
                {...props.menuPosition}
                wrapperClassName="mx_MessageComposer_Menu"
            >
                { moreButtons.map((button, index) => (
                    <MenuItem
                        className="mx_CallContextMenu_item"
                        key={index}
                        onClick={props.toggleButtonMenu}
                    >
                        { button }
                    </MenuItem>
                )) }
            </ContextMenu>
        ) }
    </>;
}

function emojiButton(props: IProps): ReactElement {
    return <EmojiButton
        key="emoji_button"
        addEmoji={props.addEmoji}
        menuPosition={props.menuPosition}
        narrowMode={props.narrowMode}
    />;
}

interface IEmojiButtonProps extends Pick<ICollapsibleButtonProps, "narrowMode"> {
    addEmoji: (unicode: string) => boolean;
    menuPosition: AboveLeftOf;
}

const EmojiButton: React.FC<IEmojiButtonProps> = (
    { addEmoji, menuPosition, narrowMode },
) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    let contextMenu: React.ReactElement | null = null;
    if (menuDisplayed) {
        const position = (
            menuPosition ?? aboveLeftOf(button.current.getBoundingClientRect())
        );

        contextMenu = <ContextMenu
            {...position}
            onFinished={closeMenu}
            managed={false}
        >
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
        <CollapsibleButton
            className={className}
            onClick={openMenu}
            narrowMode={narrowMode}
            title={_t("Add emoji")}
        />

        { contextMenu }
    </React.Fragment>;
};

function uploadButton(props: IProps, roomId: string): ReactElement {
    return <UploadButton
        key="controls_upload"
        roomId={roomId}
        relation={props.relation}
    />;
}

interface IUploadButtonProps {
    roomId: string;
    relation?: IEventRelation | null;
}

class UploadButton extends React.Component<IUploadButtonProps> {
    private uploadInput = React.createRef<HTMLInputElement>();
    private dispatcherRef: string;

    constructor(props: IUploadButtonProps) {
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
            tfiles,
            this.props.roomId,
            this.props.relation,
            MatrixClientPeg.get(),
            this.context.timelineRenderingType,
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

function showStickersButton(props: IProps): ReactElement {
    return (
        props.showStickersButton
            ? <AccessibleTooltipButton
                id='stickersButton'
                key="controls_stickers"
                className="mx_MessageComposer_button mx_MessageComposer_stickers"
                onClick={() => props.setStickerPickerOpen(!props.isStickerPickerOpen)}
                title={
                    props.narrowMode
                        ? null
                        : props.isStickerPickerOpen
                            ? _t("Hide Stickers")
                            : _t("Show Stickers")
                }
                label={props.narrowMode ? _t("Send a sticker") : null}
            />
            : null
    );
}

function voiceRecordingButton(props: IProps): ReactElement {
    // XXX: recording UI does not work well in narrow mode, so hide for now
    return (
        props.narrowMode
            ? null
            : <CollapsibleButton
                key="voice_message_send"
                className="mx_MessageComposer_button mx_MessageComposer_voiceMessage"
                onClick={props.onRecordStartEndClick}
                title={_t("Send voice message")}
                narrowMode={props.narrowMode}
            />
    );
}

function pollButton(props: IProps, room: Room): ReactElement {
    return <PollButton
        key="polls"
        room={room}
        narrowMode={props.narrowMode}
    />;
}

interface IPollButtonProps extends Pick<ICollapsibleButtonProps, "narrowMode"> {
    room: Room;
}

class PollButton extends React.PureComponent<IPollButtonProps> {
    private onCreateClick = () => {
        const canSend = this.props.room.currentState.maySendEvent(
            M_POLL_START.name,
            MatrixClientPeg.get().getUserId(),
        );
        if (!canSend) {
            Modal.createTrackedDialog(
                'Polls',
                'permissions error: cannot start',
                ErrorDialog,
                {
                    title: _t("Permission Required"),
                    description: _t(
                        "You do not have permission to start polls in this room.",
                    ),
                },
            );
        } else {
            Modal.createTrackedDialog(
                'Polls',
                'create',
                PollCreateDialog,
                {
                    room: this.props.room,
                },
                'mx_CompoundDialog',
                false, // isPriorityModal
                true,  // isStaticModal
            );
        }
    };

    render() {
        return (
            <CollapsibleButton
                className="mx_MessageComposer_button mx_MessageComposer_poll"
                onClick={this.onCreateClick}
                narrowMode={this.props.narrowMode}
                title={_t("Create poll")}
            />
        );
    }
}

function showLocationButton(
    props: IProps,
    room: Room,
    roomId: string,
    matrixClient: MatrixClient,
): ReactElement {
    return (
        props.showLocationButton
            ? <LocationButton
                key="location"
                roomId={roomId}
                sender={room.getMember(matrixClient.getUserId())}
                menuPosition={props.menuPosition}
                narrowMode={props.narrowMode}
            />
            : null
    );
}

export default MessageComposerButtons;
