/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import { IEventRelation, Room, MatrixClient, THREAD_RELATION_TYPE, M_POLL_START } from "matrix-js-sdk/src/matrix";
import React, {createContext, ReactElement, ReactNode, useContext, useRef, useState, useEffect} from "react";
import ReactDOM from 'react-dom';

import { _t } from "../../../languageHandler";
import { CollapsibleButton } from "./CollapsibleButton";
import { MenuProps } from "../../structures/ContextMenu";
import dis from "../../../dispatcher/dispatcher";
import ErrorDialog from "../dialogs/ErrorDialog";
import { LocationButton } from "../location";
import Modal from "../../../Modal";
import PollCreateDialog from "../elements/PollCreateDialog";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import ContentMessages from "../../../ContentMessages";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useDispatcher } from "../../../hooks/useDispatcher";
import { chromeFileInputFix } from "../../../utils/BrowserWorkarounds";
import IconizedContextMenu, { IconizedContextMenuOptionList } from "../context_menus/IconizedContextMenu";
import { EmojiButton } from "./EmojiButton";
import { filterBoolean } from "../../../utils/arrays";
import { useSettingValue } from "../../../hooks/useSettings";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import { useScopedRoomContext } from "../../../contexts/ScopedRoomContext.tsx";

interface IProps {
    addEmoji: (emoji: string) => boolean;
    haveRecording: boolean;
    isMenuOpen: boolean;
    isStickerPickerOpen: boolean;
    menuPosition?: MenuProps;
    onRecordStartEndClick: () => void;
    relation?: IEventRelation;
    setStickerPickerOpen: (isStickerPickerOpen: boolean) => void;
    showLocationButton: boolean;
    showPollsButton: boolean;
    showStickersButton: boolean;
    toggleButtonMenu: () => void;
    isRichTextEnabled: boolean;
    onComposerModeClick: () => void;
}

type OverflowMenuCloser = () => void;
export const OverflowMenuContext = createContext<OverflowMenuCloser | null>(null);

const MessageComposerButtons: React.FC<IProps> = (props: IProps) => {
    const matrixClient = useContext(MatrixClientContext);
    const { room, narrow } = useScopedRoomContext("room", "narrow");

    const isWysiwygLabEnabled = useSettingValue("feature_wysiwyg_composer");

    if (!matrixClient || !room || props.haveRecording) {
        return null;
    }

    let mainButtons: ReactNode[];
    let moreButtons: ReactNode[];
    if (narrow) {
        mainButtons = [
            isWysiwygLabEnabled ? (
                <ComposerModeButton
                    key="composerModeButton"
                    isRichTextEnabled={props.isRichTextEnabled}
                    onClick={props.onComposerModeClick}
                />
            ) : (
                emojiButton(props)
            ),
        ];
        moreButtons = [
            uploadButton(), // props passed via UploadButtonContext
            nextcloudPickerButton(),
            showStickersButton(props),
            voiceRecordingButton(props, narrow),
            props.showPollsButton ? pollButton(room, props.relation) : null,
            showLocationButton(props, room, matrixClient),
        ];
    } else {
        mainButtons = [
            isWysiwygLabEnabled ? (
                <ComposerModeButton
                    key="composerModeButton"
                    isRichTextEnabled={props.isRichTextEnabled}
                    onClick={props.onComposerModeClick}
                />
            ) : (
                emojiButton(props)
            ),
            uploadButton(), // props passed via UploadButtonContext
            nextcloudPickerButton(),
        ];
        moreButtons = [
            showStickersButton(props),
            voiceRecordingButton(props, narrow),
            props.showPollsButton ? pollButton(room, props.relation) : null,
            showLocationButton(props, room, matrixClient),
        ];
    }

    mainButtons = filterBoolean(mainButtons);
    moreButtons = filterBoolean(moreButtons);

    const moreOptionsClasses = classNames({
        mx_MessageComposer_button: true,
        mx_MessageComposer_buttonMenu: true,
        mx_MessageComposer_closeButtonMenu: props.isMenuOpen,
    });

    return (
        <UploadButtonContextProvider roomId={room.roomId} relation={props.relation}>
            {mainButtons}
            {moreButtons.length > 0 && (
                <AccessibleButton
                    className={moreOptionsClasses}
                    onClick={props.toggleButtonMenu}
                    title={_t("quick_settings|sidebar_settings")}
                />
            )}
            {props.isMenuOpen && (
                <IconizedContextMenu
                    onFinished={props.toggleButtonMenu}
                    {...props.menuPosition}
                    wrapperClassName="mx_MessageComposer_Menu"
                    compact={true}
                >
                    <OverflowMenuContext.Provider value={props.toggleButtonMenu}>
                        <IconizedContextMenuOptionList>{moreButtons}</IconizedContextMenuOptionList>
                    </OverflowMenuContext.Provider>
                </IconizedContextMenu>
            )}
        </UploadButtonContextProvider>
    );
};

const NextcloudPickerButton: React.FC = () => {
    const [isOverlayVisible, setOverlayVisible] = useState(false);
    const [isIframeLoaded, setIframeLoaded] = useState(false);
    const overflowMenuCloser = useContext(OverflowMenuContext);

    const handleButtonOnClick = (event: React.MouseEvent<HTMLInputElement>): void => {
        overflowMenuCloser?.();
        setOverlayVisible(true);
        setIframeLoaded(false);
    };

    const closeOverlay = () => {
        setOverlayVisible(false);
    };

    const handleIframeLoad = () => {
        setIframeLoaded(true);
    };

    const frameUrl = () => {
        return window.location.origin + '/index.php/apps/picker/single-link?option=Clipboard';
    };

    useEffect(() => {
        // @ts-ignore
        window.closePickerIframe = () => {
            setTimeout(() => {
                setOverlayVisible(false);
            }, 500);
        };

        return () => {
            // @ts-ignore
            delete window.closePickerIframe;
        };
    }, []);

    return (
        <>
            <CollapsibleButton
                key="nextcloud_picker_button"
                className="mx_MessageComposer_button"
                iconClassName="mx_MessageComposer_nextcloudPickerButtonIcon"
                onClick={handleButtonOnClick}
                title={_t("Nextcloud Picker")}
            >
                <svg width="26" height="26" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 2.4 1.2 A 2.4 2.4 0 0 0 0 3.6 L 0 20.4 A 2.4 2.4 0 0 0 2.4 22.8 L 21.6 22.8 A 2.4 2.4 0 0 0 24 20.4 L 24 7.2 A 2.4 2.4 0 0 0 21.6 4.8 L 13.692012 4.8 L 10.8 1.9079883 A 2.4 2.4 0 0 0 9.1079883 1.2 L 2.4 1.2 z M 12.015293 9.1495898 C 14.128085 9.1487404 15.902746 10.587886 16.45834 12.528223 C 16.941727 11.501136 17.973094 10.772227 19.176035 10.772227 A 3.0319929 3.0319929 0 0 1 22.194434 13.790625 A 3.0311433 3.0311433 0 0 1 19.176035 16.809023 C 17.973944 16.809023 16.942602 16.080963 16.459219 15.053027 C 15.902774 16.993365 14.128085 18.43166 12.015293 18.43166 C 9.8914562 18.43166 8.1066027 16.97725 7.5620508 15.019922 C 7.0863114 16.066548 6.0396784 16.809023 4.8231445 16.809023 A 3.0319929 3.0319929 0 0 1 1.8055664 13.790625 A 3.0319929 3.0319929 0 0 1 4.8231445 10.772227 C 6.0396784 10.772227 7.0871316 11.51388 7.5628711 12.560508 C 8.107423 10.604028 9.8914562 9.1495898 12.015293 9.1495898 z M 12.015293 10.920879 C 10.420718 10.920879 9.1464258 12.195199 9.1464258 13.790625 A 2.856139 2.856139 0 0 0 12.015293 16.660371 C 13.610721 16.660371 14.885039 15.38605 14.885039 13.790625 C 14.885039 12.195199 13.610721 10.920879 12.015293 10.920879 z M 4.8231445 12.543516 L 4.8231445 12.544336 C 4.1239774 12.544336 3.5768555 13.091459 3.5768555 13.790625 A 1.2335258 1.2335258 0 0 0 4.8231445 15.037734 C 5.5223118 15.036884 6.069375 14.489792 6.069375 13.790625 C 6.069375 13.091459 5.5214622 12.543516 4.8231445 12.543516 z M 19.176035 12.543516 L 19.176035 12.544336 C 18.476868 12.544336 17.929746 13.091459 17.929746 13.790625 A 1.2335258 1.2335258 0 0 0 19.176035 15.037734 C 19.875202 15.037734 20.423145 14.489792 20.423145 13.790625 C 20.423145 13.091459 19.875202 12.543516 19.176035 12.543516 z" fill="currentColor" />
                </svg>
            </CollapsibleButton>

            {isOverlayVisible && ReactDOM.createPortal(
                <div
                    id="nextcloudPickerContainer"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        zIndex: 999999,
                    }}
                    onClick={closeOverlay}
                >
                    {!isIframeLoaded && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                color: '#fff',
                                fontSize: '20px',
                            }}
                        >
                            {_t("Loading...")}
                        </div>
                    )}
                    <iframe
                        id="nextcloudPickerFrame"
                        src={frameUrl()}
                        style={{
                            height: '700px',
                            width: '800px',
                            maxHeight: '80vh',
                            maxWidth: '100%',
                            border: 'none',
                            borderRadius: '15px',
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 999999999,
                            display: isIframeLoaded ? 'block' : 'none',
                        }}
                        onLoad={handleIframeLoad}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>,
                document.body
            )}
        </>
    );
};

function nextcloudPickerButton(): ReactElement | null {
    const isPickerEnabled = (() => {
        if (window.parent && typeof window.parent._oc_appswebroots !== "undefined" && window.parent._oc_appswebroots) {
            // @ts-ignore
            const appsWebRoots = window.parent._oc_appswebroots;
            return Object.values(appsWebRoots).includes("/apps/picker");
        }
        return false;
    })();

    if (!isPickerEnabled) {
        return null;
    }

    return (<NextcloudPickerButton/>)
}

function emojiButton(props: IProps): ReactElement {
    return (
        <EmojiButton
            key="emoji_button"
            addEmoji={props.addEmoji}
            menuPosition={props.menuPosition}
            className="mx_MessageComposer_button"
        />
    );
}

function uploadButton(): ReactElement {
    return <UploadButton key="controls_upload" />;
}

type UploadButtonFn = () => void;
export const UploadButtonContext = createContext<UploadButtonFn | null>(null);

interface IUploadButtonProps {
    roomId: string;
    relation?: IEventRelation;
    children: ReactNode;
}

// We put the file input outside the UploadButton component so that it doesn't get killed when the context menu closes.
const UploadButtonContextProvider: React.FC<IUploadButtonProps> = ({ roomId, relation, children }) => {
    const cli = useContext(MatrixClientContext);
    const roomContext = useScopedRoomContext("timelineRenderingType");
    const uploadInput = useRef<HTMLInputElement>(null);

    const onUploadClick = (): void => {
        if (cli?.isGuest()) {
            dis.dispatch({ action: "require_registration" });
            return;
        }
        uploadInput.current?.click();
    };

    useDispatcher(dis, (payload) => {
        if (roomContext.timelineRenderingType === payload.context && payload.action === "upload_file") {
            onUploadClick();
        }
    });

    const onUploadFileInputChange = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        if (ev.target.files?.length === 0) return;

        // Take a copy, so we can safely reset the value of the form control
        ContentMessages.sharedInstance().sendContentListToRoom(
            Array.from(ev.target.files!),
            roomId,
            relation,
            cli,
            roomContext.timelineRenderingType,
        );

        // This is the onChange handler for a file form control, but we're
        // not keeping any state, so reset the value of the form control
        // to empty.
        // NB. we need to set 'value': the 'files' property is immutable.
        ev.target.value = "";
    };

    const uploadInputStyle = { display: "none" };
    return (
        <UploadButtonContext.Provider value={onUploadClick}>
            {children}

            <input
                ref={uploadInput}
                type="file"
                style={uploadInputStyle}
                multiple
                onClick={chromeFileInputFix}
                onChange={onUploadFileInputChange}
            />
        </UploadButtonContext.Provider>
    );
};

// Must be rendered within an UploadButtonContextProvider
const UploadButton: React.FC = () => {
    const overflowMenuCloser = useContext(OverflowMenuContext);
    const uploadButtonFn = useContext(UploadButtonContext);

    const onClick = (): void => {
        uploadButtonFn?.();
        overflowMenuCloser?.(); // close overflow menu
    };

    return (
        <CollapsibleButton
            className="mx_MessageComposer_button"
            iconClassName="mx_MessageComposer_upload"
            onClick={onClick}
            title={_t("common|attachment")}
        />
    );
};

function showStickersButton(props: IProps): ReactElement | null {
    return props.showStickersButton ? (
        <CollapsibleButton
            id="stickersButton"
            key="controls_stickers"
            className="mx_MessageComposer_button"
            iconClassName="mx_MessageComposer_stickers"
            onClick={() => props.setStickerPickerOpen(!props.isStickerPickerOpen)}
            title={props.isStickerPickerOpen ? _t("composer|close_sticker_picker") : _t("common|sticker")}
        />
    ) : null;
}

function voiceRecordingButton(props: IProps, narrow: boolean): ReactElement | null {
    // XXX: recording UI does not work well in narrow mode, so hide for now
    return narrow ? null : (
        <CollapsibleButton
            key="voice_message_send"
            className="mx_MessageComposer_button"
            iconClassName="mx_MessageComposer_voiceMessage"
            onClick={props.onRecordStartEndClick}
            title={_t("composer|voice_message_button")}
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
    public static contextType = OverflowMenuContext;
    declare public context: React.ContextType<typeof OverflowMenuContext>;

    private onCreateClick = (): void => {
        this.context?.(); // close overflow menu
        const canSend = this.props.room.currentState.maySendEvent(
            M_POLL_START.name,
            MatrixClientPeg.safeGet().getSafeUserId(),
        );
        if (!canSend) {
            Modal.createDialog(ErrorDialog, {
                title: _t("composer|poll_button_no_perms_title"),
                description: _t("composer|poll_button_no_perms_description"),
            });
        } else {
            const threadId =
                this.props.relation?.rel_type === THREAD_RELATION_TYPE.name ? this.props.relation.event_id : undefined;

            Modal.createDialog(
                PollCreateDialog,
                {
                    room: this.props.room,
                    threadId,
                },
                "mx_CompoundDialog",
                false, // isPriorityModal
                true, // isStaticModal
            );
        }
    };

    public render(): React.ReactNode {
        // do not allow sending polls within threads at this time
        if (this.props.relation?.rel_type === THREAD_RELATION_TYPE.name) return null;

        return (
            <CollapsibleButton
                className="mx_MessageComposer_button"
                iconClassName="mx_MessageComposer_poll"
                onClick={this.onCreateClick}
                title={_t("composer|poll_button")}
            />
        );
    }
}

function showLocationButton(props: IProps, room: Room, matrixClient: MatrixClient): ReactElement | null {
    const sender = room.getMember(matrixClient.getSafeUserId());

    return props.showLocationButton && sender ? (
        <LocationButton
            key="location"
            roomId={room.roomId}
            relation={props.relation}
            sender={sender}
            menuPosition={props.menuPosition}
        />
    ) : null;
}

interface WysiwygToggleButtonProps {
    isRichTextEnabled: boolean;
    onClick: (ev: ButtonEvent) => void;
}

function ComposerModeButton({ isRichTextEnabled, onClick }: WysiwygToggleButtonProps): JSX.Element {
    const title = isRichTextEnabled ? _t("composer|mode_plain") : _t("composer|mode_rich_text");

    return (
        <CollapsibleButton
            className="mx_MessageComposer_button"
            iconClassName={classNames({
                mx_MessageComposer_plain_text: !isRichTextEnabled,
                mx_MessageComposer_rich_text: isRichTextEnabled,
            })}
            onClick={onClick}
            title={title}
        />
    );
}

export default MessageComposerButtons;
