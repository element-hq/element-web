/*
Copyright 2026 New Vector Ltd.
Copyright 2020, 2021 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type HTMLAttributes,
    type JSX,
    type ReactNode,
    type RefObject,
    useEffect,
    useRef,
    useState,
} from "react";
import FocusLock from "react-focus-lock";
import classNames from "classnames";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    ChatIcon,
    CloseIcon,
    DownloadIcon,
    OverflowHorizontalIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import { useCreateAutoDisposedViewModel, MessageTimestampView } from "@element-hq/web-shared-components";

import { _t } from "../../../../languageHandler";
import MemberAvatar from "../../avatars/MemberAvatar";
import AccessibleButton from "../AccessibleButton";
import MessageContextMenu from "../../context_menus/MessageContextMenu";
import { ContextMenuTooltipButton } from "../../../../accessibility/context_menu/ContextMenuTooltipButton";
import { aboveLeftOf } from "../../../structures/ContextMenu";
import SettingsStore from "../../../../settings/SettingsStore";
import dis from "../../../../dispatcher/dispatcher";
import { Action } from "../../../../dispatcher/actions";
import { type ViewRoomPayload } from "../../../../dispatcher/payloads/ViewRoomPayload";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import { KeyBindingAction } from "../../../../accessibility/KeyboardShortcuts";
import { getKeyBindingsManager } from "../../../../KeyBindingsManager";
import { useDownloadMedia } from "../../../../hooks/useDownloadMedia";
import { type PreviewChat } from "./usePreviewChat";
import {
    MessageTimestampViewModel,
    type MessageTimestampViewModelProps,
} from "../../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";

export interface MediaPreviewShellProps {
    /** Accessible name for the dialog, describing what kind of preview this is. */
    label: string;

    /**
     * The event being previewed. Absent when the dialog was opened on something that is not a
     * message — an avatar, or the image from a URL preview — in which case there is no sender,
     * timestamp or message context menu to show.
     */
    mxEvent?: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;

    /** Shown in the centre of the panel; normally the filename. */
    title?: string;

    /** Source for the download button when there is no event to decrypt the media from. */
    downloadUrl?: string;
    downloadName?: string;

    /** Previewer-specific controls, rendered ahead of the shared download/menu/close buttons. */
    toolbar?: ReactNode;

    /**
     * Chat controls from {@link usePreviewChat}. When given, a toggle for the room's chat panel
     * is added to the toolbar; when omitted, there is no chat button at all.
     */
    chat?: PreviewChat;

    /**
     * Assigned to the focus lock's DOM node, for previewers that need to attach native listeners
     * (the image viewer registers a non-passive wheel handler for zooming).
     */
    lockRef?: RefObject<HTMLElement | null>;

    /** Extra class on the content area, so each previewer can control scrolling and alignment. */
    contentClassName?: string;
    contentRef?: RefObject<HTMLDivElement | null>;
    contentProps?: HTMLAttributes<HTMLDivElement>;

    /**
     * Offered each keybinding before the shell acts on it. Return `true` to claim the key, which
     * suppresses the shell's own handling.
     */
    onAction?: (action: KeyBindingAction) => boolean;

    onFinished: () => void;

    children: ReactNode;
}

/**
 * The chrome shared by every full-screen media preview.
 *
 * This owns everything that should look and behave the same no matter what is being previewed:
 * the focus trap, the sender/timestamp block, the filename, the download, message-options and
 * close buttons, and the Escape/save keybindings. Previewers supply their own toolbar controls
 * and their own content, and keep their own state — the image viewer's pan and zoom never leaves
 * the image viewer.
 */
export default function MediaPreviewShell({
    label,
    mxEvent,
    permalinkCreator,
    title,
    downloadUrl,
    downloadName,
    toolbar,
    chat,
    lockRef,
    contentClassName,
    contentRef,
    contentProps,
    onAction,
    onFinished,
    children,
}: MediaPreviewShellProps): JSX.Element {
    const [contextMenuDisplayed, setContextMenuDisplayed] = useState(false);
    const contextMenuButton = useRef<any>(null);

    const { download, loading: downloading, canDownload } = useDownloadMedia(downloadUrl ?? "", downloadName, mxEvent);

    const onKeyDown = (ev: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        if (!action) return;

        if (onAction?.(action)) {
            ev.stopPropagation();
            ev.preventDefault();
            return;
        }

        switch (action) {
            case KeyBindingAction.Escape:
                ev.stopPropagation();
                ev.preventDefault();
                onFinished();
                break;
            case KeyBindingAction.Save:
                ev.stopPropagation();
                ev.preventDefault();
                if (canDownload) void download();
                break;
        }
    };

    const onPermalinkClicked = (ev: React.MouseEvent): void => {
        // This allows the permalink to be opened in a new tab/window or copied as matrix.to, but
        // also for it to enable routing within Element when clicked.
        ev.preventDefault();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: mxEvent?.getId(),
            highlighted: true,
            room_id: mxEvent?.getRoomId(),
            metricsTrigger: undefined, // room doesn't change
        });
        onFinished();
    };

    let info: JSX.Element;
    if (mxEvent) {
        const permalink = permalinkCreator ? permalinkCreator.forEvent(mxEvent.getId()!) : "#";
        info = (
            <div className="mx_MediaPreview_info_wrapper">
                <MemberAvatar
                    member={mxEvent.sender}
                    fallbackUserId={mxEvent.getSender()}
                    size="32px"
                    viewUserOnClick={true}
                    className="mx_Dialog_nonDialogButton"
                />
                <div className="mx_MediaPreview_info">
                    <div className="mx_MediaPreview_info_sender">{mxEvent.sender?.name ?? mxEvent.getSender()}</div>
                    <MessageTimestampWrapper
                        href={permalink}
                        onClick={onPermalinkClicked}
                        showFullDate={true}
                        showTwelveHour={SettingsStore.getValue("showTwelveHourTimestamps")}
                        ts={mxEvent.getTs()}
                        showSeconds={false}
                        inhibitTooltip
                    />
                </div>
            </div>
        );
    } else {
        // No event means we're viewing an avatar or a URL preview. We still render an empty
        // element here because the panel is laid out with space-between and we want the title
        // and toolbar to stay put.
        info = <div />;
    }

    return (
        <FocusLock
            returnFocus={true}
            // The side panel lives outside this dialog, in the app's right panel. While it is
            // open the trap has to let go, or focus is yanked back out of the composer.
            disabled={chat?.panelOpen}
            lockProps={{
                "onKeyDown": onKeyDown,
                "role": "dialog",
                "aria-label": label,
            }}
            className="mx_MediaPreview"
            ref={lockRef}
        >
            <div className="mx_MediaPreview_panel">
                {info}
                {title ? <div className="mx_MediaPreview_title">{title}</div> : <div />}
                <div className="mx_MediaPreview_toolbar">
                    {toolbar}
                    {chat && (
                        <AccessibleButton
                            className={classNames("mx_MediaPreview_button", {
                                mx_MediaPreview_button_active: chat.open,
                            })}
                            title={_t("media_preview|chat")}
                            aria-pressed={chat.open}
                            onClick={chat.toggle}
                        >
                            <ChatIcon />
                        </AccessibleButton>
                    )}
                    {canDownload && (
                        <AccessibleButton
                            className="mx_MediaPreview_button"
                            title={downloading ? _t("timeline|download_action_downloading") : _t("action|download")}
                            onClick={download}
                            disabled={downloading}
                        >
                            <DownloadIcon />
                        </AccessibleButton>
                    )}
                    {mxEvent && (
                        <ContextMenuTooltipButton
                            className="mx_MediaPreview_button mx_MediaPreview_button_more"
                            title={_t("common|options")}
                            onClick={() => setContextMenuDisplayed(true)}
                            ref={contextMenuButton}
                            isExpanded={contextMenuDisplayed}
                        >
                            <OverflowHorizontalIcon />
                        </ContextMenuTooltipButton>
                    )}
                    <AccessibleButton
                        className="mx_MediaPreview_button mx_MediaPreview_button_close"
                        title={_t("action|close")}
                        onClick={onFinished}
                    >
                        <CloseIcon />
                    </AccessibleButton>
                    {contextMenuDisplayed && mxEvent && contextMenuButton.current && (
                        <MessageContextMenu
                            {...aboveLeftOf(contextMenuButton.current.getBoundingClientRect())}
                            mxEvent={mxEvent}
                            permalinkCreator={permalinkCreator}
                            onFinished={() => setContextMenuDisplayed(false)}
                            onCloseDialog={onFinished}
                        />
                    )}
                </div>
            </div>
            <div className={classNames("mx_MediaPreview_content", contentClassName)} ref={contentRef} {...contentProps}>
                {children}
            </div>
        </FocusLock>
    );
}

/**
 * Wraps MessageTimestampView with a view model synced to the provided props.
 */
function MessageTimestampWrapper(props: MessageTimestampViewModelProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new MessageTimestampViewModel(props));
    useEffect(() => {
        vm.setProps(props);
    }, [vm, props]);
    return <MessageTimestampView vm={vm} className="mx_MessageTimestamp" />;
}
