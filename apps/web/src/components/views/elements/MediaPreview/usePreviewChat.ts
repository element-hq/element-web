/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useContext, useEffect } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { SDKContext } from "../../../../contexts/SDKContext";
import { useEventEmitterState } from "../../../../hooks/useEventEmitter";
import { UPDATE_EVENT } from "../../../../stores/AsyncStore";
import { RightPanelPhases } from "../../../../stores/right-panel/RightPanelStorePhases";

/** Set on <body> while the preview should make room for the chat panel. */
const INSET_CLASS = "mx_MediaPreview_withChat";
/** Kept in sync with the live width of the right panel. */
const INSET_PROPERTY = "--media-preview-chat-inset";
/** Matches MainSplit's own fallback, for the case where we cannot measure the panel. */
const DEFAULT_PANEL_WIDTH = 320;

export interface PreviewChat {
    /** Whether the chat tab specifically is showing; drives the toolbar button's pressed state. */
    open: boolean;
    /**
     * Whether any of the side panels is showing beside the preview. The file browser is a sibling
     * tab of the chat, so switching to it must keep the overlay stepped aside and the focus trap
     * released, even though the chat button is no longer active.
     */
    panelOpen: boolean;
    /** Show the chat panel, or hide it if it is already showing. */
    toggle: () => void;
}

/**
 * Wires the preview's chat button up to the room's real right panel.
 *
 * Rather than embedding a second timeline inside the dialog, this toggles the same
 * {@link RightPanelPhases.Timeline} panel the video room chat button uses, and shrinks the
 * preview overlay so it stops covering it — the same relationship a video call has with the chat.
 * That keeps one timeline, with the room's real permissions and read receipts, instead of a copy
 * driven by fabricated room state.
 *
 * @param mxEvent - the event being previewed
 * @returns the chat controls, or `undefined` when there is no panel we can sensibly toggle
 */
export function usePreviewChat(mxEvent: MatrixEvent): PreviewChat | undefined {
    const sdkContext = useContext(SDKContext);
    const roomId = mxEvent.getRoomId();

    // The right panel belongs to the room the user is looking at. If the preview was opened from
    // somewhere else there is nothing behind the overlay to reveal, so we offer no button.
    const available = !!roomId && sdkContext.roomViewStore.getRoomId() === roomId;

    const phase = useEventEmitterState(sdkContext.rightPanelStore, UPDATE_EVENT, () =>
        !!roomId && sdkContext.rightPanelStore.isOpenForRoom(roomId)
            ? sdkContext.rightPanelStore.currentCardForRoom(roomId).phase
            : null,
    );

    const open = phase === RightPanelPhases.Timeline;
    const panelOpen = open || phase === RightPanelPhases.FileBrowser;

    const toggle = useCallback(
        () => sdkContext.rightPanelStore.showOrHidePhase(RightPanelPhases.Timeline),
        [sdkContext],
    );

    const inset = available && panelOpen;

    useEffect(() => {
        if (!inset) return;

        // The panel is user-resizable, so track its real width rather than assuming the default.
        const panel = document.querySelector<HTMLElement>(".mx_RightPanel_ResizeWrapper");
        const apply = (): void => {
            const width = panel?.getBoundingClientRect().width || DEFAULT_PANEL_WIDTH;
            document.documentElement.style.setProperty(INSET_PROPERTY, `${width}px`);
        };

        apply();
        document.body.classList.add(INSET_CLASS);

        const observer = panel ? new ResizeObserver(apply) : undefined;
        if (panel) observer?.observe(panel);

        return () => {
            observer?.disconnect();
            document.body.classList.remove(INSET_CLASS);
            document.documentElement.style.removeProperty(INSET_PROPERTY);
        };
    }, [inset]);

    if (!available) return undefined;
    return { open, panelOpen, toggle };
}
