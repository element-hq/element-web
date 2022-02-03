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
import React, { createContext, ReactElement, useContext } from 'react';
import { Room } from 'matrix-js-sdk/src/models/room';
import { MatrixClient } from 'matrix-js-sdk/src/client';
import { RelationType } from 'matrix-js-sdk/src/@types/event';

import { _t } from '../../../languageHandler';
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { CollapsibleButton } from './CollapsibleButton';
import ContextMenu, { aboveLeftOf, AboveLeftOf, useContextMenu } from '../../structures/ContextMenu';
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

type OverflowMenuCloser = () => void;
export const OverflowMenuContext = createContext<OverflowMenuCloser | null>(null);

const MessageComposerButtons: React.FC<IProps> = (props: IProps) => {
    const matrixClient: MatrixClient = useContext(MatrixClientContext);
    const { room, roomId } = useContext(RoomContext);

    if (props.haveRecording) {
        return null;
    }

    let mainButtons: ReactElement[];
    let moreButtons: ReactElement[];
    if (props.narrowMode) {
        mainButtons = [
            emojiButton(props),
        ];
        moreButtons = [
            uploadButton(props, roomId),
            showStickersButton(props),
            voiceRecordingButton(props),
            pollButton(room, props.relation),
            showLocationButton(props, room, roomId, matrixClient),
        ];
    } else {
        mainButtons = [
            emojiButton(props),
            uploadButton(props, roomId),
        ];
        moreButtons = [
            showStickersButton(props),
            voiceRecordingButton(props),
            pollButton(room, props.relation),
            showLocationButton(props, room, roomId, matrixClient),
        ];
    }

    mainButtons = mainButtons.filter((x: ReactElement) => x);
    moreButtons = moreButtons.filter((x: ReactElement) => x);

    const moreOptionsClasses = classNames({
        mx_MessageComposer_button: true,
        mx_MessageComposer_buttonMenu: true,
        mx_MessageComposer_closeButtonMenu: props.isMenuOpen,
    });

    return <>
        { mainButtons }
        <AccessibleTooltipButton
            className={moreOptionsClasses}
            onClick={props.toggleButtonMenu}
            title={_t("More options")}
        />
        { props.isMenuOpen && (
            <ContextMenu
                onFinished={props.toggleButtonMenu}
                {...props.menuPosition}
                wrapperClassName="mx_MessageComposer_Menu"
            >
                <OverflowMenuContext.Provider value={props.toggleButtonMenu}>
                    { moreButtons }
                </OverflowMenuContext.Provider>
            </ContextMenu>
        ) }
    </>;
};

function emojiButton(props: IProps): ReactElement {
    return <EmojiButton
        key="emoji_button"
        addEmoji={props.addEmoji}
        menuPosition={props.menuPosition}
    />;
}

interface IEmojiButtonProps {
    addEmoji: (unicode: string) => boolean;
    menuPosition: AboveLeftOf;
}

const EmojiButton: React.FC<IEmojiButtonProps> = ({ addEmoji, menuPosition }) => {
    const overflowMenuCloser = useContext(OverflowMenuContext);
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();

    let contextMenu: React.ReactElement | null = null;
    if (menuDisplayed) {
        const position = (
            menuPosition ?? aboveLeftOf(button.current.getBoundingClientRect())
        );

        contextMenu = <ContextMenu
            {...position}
            onFinished={() => {
                closeMenu();
                overflowMenuCloser?.();
            }}
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
            title={_t("Emoji")}
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
        this.uploadInput.current?.click();
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
        return <>
            <CollapsibleButton
                className="mx_MessageComposer_button mx_MessageComposer_upload"
                onClick={this.onUploadClick}
                title={_t('Attachment')}
            />
            <input
                ref={this.uploadInput}
                type="file"
                style={uploadInputStyle}
                multiple
                onChange={this.onUploadFileInputChange}
            />
        </>;
    }
}

function showStickersButton(props: IProps): ReactElement {
    return (
        props.showStickersButton
            ? <CollapsibleButton
                id='stickersButton'
                key="controls_stickers"
                className="mx_MessageComposer_button mx_MessageComposer_stickers"
                onClick={() => props.setStickerPickerOpen(!props.isStickerPickerOpen)}
                title={props.isStickerPickerOpen ? _t("Hide stickers") : _t("Sticker")}
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
                title={_t("Voice Message")}
            />
    );
}

function pollButton(room: Room, relation?: IEventRelation): ReactElement {
    return <PollButton key="polls" room={room} relation={relation} />;
}

interface IPollButtonProps {
    room: Room;
    relation?: IEventRelation;
}

class PollButton extends React.PureComponent<IPollButtonProps> {
    static contextType = OverflowMenuContext;
    public context!: React.ContextType<typeof OverflowMenuContext>;

    private onCreateClick = () => {
        this.context?.(); // close overflow menu
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
            const threadId = this.props.relation?.rel_type === RelationType.Thread
                ? this.props.relation.event_id
                : null;

            Modal.createTrackedDialog(
                'Polls',
                'create',
                PollCreateDialog,
                {
                    room: this.props.room,
                    threadId,
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
                title={_t("Poll")}
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
            />
            : null
    );
}

export default MessageComposerButtons;
