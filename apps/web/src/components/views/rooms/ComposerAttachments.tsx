/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, {
    type CSSProperties,
    type JSX,
    type KeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { DeleteIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { useViewModel } from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { type ComposerAttachment } from "../../../models/ComposerAttachment";
import { useRoomUploadViewModel } from "../../../viewmodels/room/RoomUploadViewModel";
import AccessibleButton from "../elements/AccessibleButton";

/**
 * A reorder in progress. Cards are only translated while dragging, never re-ordered in the
 * DOM, so the browser animates the shuffle. The order is committed on release.
 */
interface DragState {
    pointerId: number;
    id: string;
    fromIndex: number;
    targetIndex: number;
    originX: number;
    originY: number;
    dx: number;
    dy: number;
    /** Distance between the left edges of adjacent cards. */
    step: number;
    count: number;
}

/**
 * The moment after release. The reorder is already committed, so the released card is left
 * offset by however far short of its new slot the pointer stopped, then eases in.
 */
interface DropState {
    id: string;
    dx: number;
    dy: number;
    /** False for the first frame, while the card is pinned where it was released. */
    animating: boolean;
}

// Keep in step with the transition duration in _ComposerAttachments.pcss.
const DROP_ANIMATION_MS = 180;

// Suppresses the transform transition while still letting the shadow fade.
const POSITION_UNANIMATED = `box-shadow ${DROP_ANIMATION_MS}ms ease`;

const VERTICAL_LIFT = 10;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}

function DocumentIcon(): JSX.Element {
    return (
        <svg
            className="mx_ComposerAttachments_fileIcon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path
                fill="currentColor"
                d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8.83c0-.53-.21-1.04-.59-1.41l-4.83-4.83c-.37-.38-.88-.59-1.41-.59zm7 6V3.5L18.5 9H14c-.55 0-1-.45-1-1"
            />
        </svg>
    );
}

/** How far a card must shift to make room for the one being dragged over it. */
function slotShift(index: number, drag: DragState): number {
    const { fromIndex, targetIndex, step } = drag;
    if (index === fromIndex) return 0;
    if (fromIndex < targetIndex && index > fromIndex && index <= targetIndex) return -step;
    if (targetIndex < fromIndex && index >= targetIndex && index < fromIndex) return step;
    return 0;
}

function cardStyle(
    attachmentId: string,
    index: number,
    drag: DragState | null,
    drop: DropState | null,
): CSSProperties | undefined {
    if (drop) {
        // Cards other than the released one are already in their final slot.
        if (drop.id !== attachmentId) return { transition: POSITION_UNANIMATED };
        return drop.animating
            ? { transform: "translate(0px, 0px)" }
            : { transform: `translate(${drop.dx}px, ${drop.dy}px)`, transition: POSITION_UNANIMATED };
    }

    if (!drag) return undefined;
    if (drag.id === attachmentId) {
        return { transform: `translate(${drag.dx}px, ${drag.dy}px)`, transition: POSITION_UNANIMATED };
    }
    return { transform: `translateX(${slotShift(index, drag)}px)` };
}

interface AttachmentCardProps {
    attachment: ComposerAttachment;
    index: number;
    total: number;
    drag: DragState | null;
    drop: DropState | null;
    onRemove: (id: string) => void;
    onPointerDown: (ev: ReactPointerEvent<HTMLLIElement>, index: number) => void;
    onPointerMove: (ev: ReactPointerEvent<HTMLLIElement>) => void;
    onPointerUp: (ev: ReactPointerEvent<HTMLLIElement>) => void;
    onPointerCancel: (ev: ReactPointerEvent<HTMLLIElement>) => void;
    onKeyDown: (ev: KeyboardEvent<HTMLLIElement>, index: number) => void;
    registerRef: (id: string, node: HTMLLIElement | null) => void;
}

function AttachmentCard({
    attachment,
    index,
    total,
    drag,
    drop,
    onRemove,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
    registerRef,
}: AttachmentCardProps): JSX.Element {
    let preview: JSX.Element;
    switch (attachment.kind) {
        case "image":
            preview = (
                <img className="mx_ComposerAttachments_image" src={attachment.previewUrl} alt="" draggable={false} />
            );
            break;
        case "video":
            // The video element paints its own first frame as a poster.
            preview = (
                <video className="mx_ComposerAttachments_image" src={attachment.previewUrl} muted preload="metadata" />
            );
            break;
        default:
            preview = <DocumentIcon />;
            break;
    }

    const isDragging = drag?.id === attachment.id;
    // Stays above its neighbours until it has finished easing into place.
    const isFloating = isDragging || drop?.id === attachment.id;

    const classes = [
        "mx_ComposerAttachments_item",
        isFloating && "mx_ComposerAttachments_item--floating",
        isDragging && "mx_ComposerAttachments_item--dragging",
    ].filter(Boolean);

    return (
        <li
            ref={(node) => registerRef(attachment.id, node)}
            className={classes.join(" ")}
            style={cardStyle(attachment.id, index, drag, drop)}
            tabIndex={0}
            aria-label={_t("composer|attachments_item_a11y", {
                fileName: attachment.name,
                position: index + 1,
                count: total,
            })}
            onPointerDown={(ev) => onPointerDown(ev, index)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onKeyDown={(ev) => onKeyDown(ev, index)}
        >
            <div className="mx_ComposerAttachments_preview">{preview}</div>
            <div className="mx_ComposerAttachments_meta">
                <span className="mx_ComposerAttachments_name" title={attachment.name}>
                    {attachment.name}
                </span>
                <span className="mx_ComposerAttachments_description" title={attachment.description}>
                    {attachment.description}
                </span>
            </div>
            <div className="mx_ComposerAttachments_actions">
                <AccessibleButton
                    className="mx_ComposerAttachments_action mx_ComposerAttachments_action--remove"
                    title={_t("composer|attachments_remove")}
                    onClick={() => onRemove(attachment.id)}
                >
                    <DeleteIcon />
                </AccessibleButton>
            </div>
        </li>
    );
}

/**
 * The row of files staged in the composer, shown above the input until they are sent.
 * Cards can be dragged within the row to change the order they are sent in.
 */
export function ComposerAttachments(): JSX.Element | null {
    const vm = useRoomUploadViewModel();
    const { attachments } = useViewModel(vm);
    const [drag, setDrag] = useState<DragState | null>(null);
    const [drop, setDrop] = useState<DropState | null>(null);
    // Mirrored so the pointer handlers can read the drag without a functional update.
    const dragRef = useRef<DragState | null>(null);

    const frame = useRef<number>(undefined);
    const timer = useRef<number>(undefined);
    const nodes = useRef(new Map<string, HTMLLIElement>());

    const setDragState = useCallback((next: DragState | null) => {
        dragRef.current = next;
        setDrag(next);
    }, []);

    const cancelDropAnimation = useCallback(() => {
        if (frame.current !== undefined) cancelAnimationFrame(frame.current);
        if (timer.current !== undefined) clearTimeout(timer.current);
        frame.current = undefined;
        timer.current = undefined;
    }, []);

    useEffect(() => cancelDropAnimation, [cancelDropAnimation]);

    const registerRef = useCallback((id: string, node: HTMLLIElement | null) => {
        if (node) {
            nodes.current.set(id, node);
        } else {
            nodes.current.delete(id);
        }
    }, []);

    const onPointerDown = useCallback(
        (ev: ReactPointerEvent<HTMLLIElement>, index: number) => {
            if (ev.button !== 0) return;
            if ((ev.target as Element).closest?.(".mx_ComposerAttachments_action")) return;
            if (attachments.length < 2) return;

            // offsetLeft ignores transforms, so a card still easing into place cannot skew this.
            const offsets = attachments
                .map((attachment) => nodes.current.get(attachment.id)?.offsetLeft)
                .filter((offset): offset is number => offset !== undefined);
            if (offsets.length < 2) return;
            const step = offsets[1] - offsets[0];
            if (step <= 0) return;

            cancelDropAnimation();
            setDrop(null);

            // Stops the browser starting a native drag or selecting the label text.
            ev.preventDefault();
            ev.currentTarget.setPointerCapture?.(ev.pointerId);
            setDragState({
                pointerId: ev.pointerId,
                id: attachments[index].id,
                fromIndex: index,
                targetIndex: index,
                originX: ev.clientX,
                originY: ev.clientY,
                dx: 0,
                dy: 0,
                step,
                count: attachments.length,
            });
        },
        [attachments, cancelDropAnimation, setDragState],
    );

    const onPointerMove = useCallback(
        (ev: ReactPointerEvent<HTMLLIElement>) => {
            const current = dragRef.current;
            if (!current || current.pointerId !== ev.pointerId) return;

            // Clamped so the card cannot leave the row, which would clip against its scroll container.
            const minDx = -current.fromIndex * current.step;
            const maxDx = (current.count - 1 - current.fromIndex) * current.step;
            const dx = clamp(ev.clientX - current.originX, minDx, maxDx);
            const dy = clamp(ev.clientY - current.originY, -VERTICAL_LIFT, VERTICAL_LIFT);

            const targetIndex = current.fromIndex + Math.round(dx / current.step);
            if (dx === current.dx && dy === current.dy && targetIndex === current.targetIndex) return;
            setDragState({ ...current, dx, dy, targetIndex });
        },
        [setDragState],
    );

    const onPointerUp = useCallback(
        (ev: ReactPointerEvent<HTMLLIElement>) => {
            const current = dragRef.current;
            if (!current || current.pointerId !== ev.pointerId) return;
            setDragState(null);

            const movedSlots = current.targetIndex - current.fromIndex;
            if (movedSlots !== 0) {
                vm.moveAttachment(current.id, current.targetIndex);
            }

            // The reorder moved the card's slot under it, leaving the gap between where the
            // pointer stopped and where it now belongs. Pin it there for a frame so the
            // stylesheet transition can ease it in rather than it jumping.
            setDrop({
                id: current.id,
                dx: current.dx - movedSlots * current.step,
                dy: current.dy,
                animating: false,
            });
            frame.current = requestAnimationFrame(() => {
                frame.current = requestAnimationFrame(() => {
                    setDrop((previous) => previous && { ...previous, animating: true });
                    timer.current = window.setTimeout(() => setDrop(null), DROP_ANIMATION_MS);
                });
            });
        },
        [setDragState, vm],
    );

    const onPointerCancel = useCallback(
        (ev: ReactPointerEvent<HTMLLIElement>) => {
            const current = dragRef.current;
            if (!current || current.pointerId !== ev.pointerId) return;
            // The browser took the gesture over, so the user never chose this order.
            setDragState(null);
            setDrop(null);
        },
        [setDragState],
    );

    const onKeyDown = useCallback(
        (ev: KeyboardEvent<HTMLLIElement>, index: number) => {
            // Only when the card itself has focus, not the delete button inside it.
            if (ev.target !== ev.currentTarget) return;
            const delta = ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : 0;
            if (delta === 0) return;
            ev.preventDefault();
            const attachment = attachments[index];
            vm.moveAttachment(attachment.id, index + delta);
            // Keep focus on the card the user is moving.
            window.requestAnimationFrame(() => nodes.current.get(attachment.id)?.focus());
        },
        [attachments, vm],
    );

    if (!attachments.length) return null;

    return (
        <ul className="mx_ComposerAttachments" aria-label={_t("composer|attachments_label")}>
            {attachments.map((attachment, index) => (
                <AttachmentCard
                    key={attachment.id}
                    attachment={attachment}
                    index={index}
                    total={attachments.length}
                    drag={drag}
                    drop={drop}
                    onRemove={vm.removeAttachment}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerCancel}
                    onKeyDown={onKeyDown}
                    registerRef={registerRef}
                />
            ))}
        </ul>
    );
}
