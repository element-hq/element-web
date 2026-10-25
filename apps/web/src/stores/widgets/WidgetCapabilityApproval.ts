/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type Capability, type Widget, type WidgetKind } from "matrix-widget-api";
import { logger } from "matrix-js-sdk/src/logger";

import Modal from "../../Modal";
import WidgetCapabilitiesPromptDialog from "../../components/views/dialogs/WidgetCapabilitiesPromptDialog";
import { ModuleApi } from "../../modules/Api";
import { toWidgetDescriptor } from "../../modules/WidgetLifecycleApi";
import { iterableDiff, iterableIntersection } from "../../utils/iterables";

/**
 * The capabilities the user chose to remember for a widget ("remember my selection" in the prompt).
 */
export function getRememberedCapabilitiesForWidget(widget: Pick<Widget, "id">): Capability[] {
    return JSON.parse(localStorage.getItem(`widget_${widget.id}_approved_caps`) || "[]");
}

function setRememberedCapabilitiesForWidget(widget: Pick<Widget, "id">, caps: Capability[]): void {
    localStorage.setItem(`widget_${widget.id}_approved_caps`, JSON.stringify(caps));
}

interface WidgetCapabilityApprovalOptions {
    /** The widget asking for capabilities. */
    widget: Widget;
    widgetKind: WidgetKind;
    /** The room the widget lives in, if it is a room widget. */
    roomId?: string;
    /** What the widget asked for. */
    requested: Set<Capability>;
    /** Capabilities the client grants to this widget without asking anyone. */
    preApproved: Set<Capability>;
}

/**
 * Decides which of the capabilities a widget requested it gets. Shared by every widget host
 * implementation so that the decision is the same regardless of the protocol spoken to the widget.
 *
 * The order is: the client's own pre-approved set, then what the user remembered for this widget,
 * then a module registered through the widget lifecycle API, and finally the capabilities prompt for
 * whatever is still undecided. The result only ever contains requested capabilities.
 */
export async function approveWidgetCapabilities(opts: WidgetCapabilityApprovalOptions): Promise<Set<Capability>> {
    const { widget, widgetKind, roomId, requested, preApproved } = opts;

    // Check to see if any capabilities aren't automatically accepted (such as sticker pickers
    // allowing stickers to be sent). If there are excess capabilities to be approved, the user
    // will be prompted to accept them.
    const diff = iterableDiff(requested, preApproved);
    const missing = new Set(diff.removed); // "removed" is "in A (requested) but not in B (allowed)"
    const allowedSoFar = new Set(preApproved);
    getRememberedCapabilitiesForWidget(widget).forEach((cap) => {
        allowedSoFar.add(cap);
        missing.delete(cap);
    });

    // Try the new module API first, then fall back to legacy paths
    const approved = await ModuleApi.instance.widgetLifecycle.preapproveCapabilities(
        toWidgetDescriptor(widget, roomId),
        requested,
    );
    if (approved) {
        approved.forEach((cap) => {
            allowedSoFar.add(cap);
            missing.delete(cap);
        });
    }

    // TODO: Do something when the widget requests new capabilities not yet asked for
    let rememberApproved = false;
    if (missing.size > 0) {
        try {
            const [result] = await Modal.createDialog(WidgetCapabilitiesPromptDialog, {
                requestedCapabilities: missing,
                widgetKind,
            }).finished;
            result?.approved?.forEach((cap) => allowedSoFar.add(cap));
            rememberApproved = !!result?.remember;
        } catch (e) {
            logger.error("Non-fatal error getting capabilities: ", e);
        }
    }

    // discard all previously allowed capabilities if they are not requested
    // TODO: this results in an unexpected behavior when this function is called during the capabilities renegotiation of MSC2974 that will be resolved later.
    const allAllowed = new Set(iterableIntersection(allowedSoFar, requested));

    if (rememberApproved) {
        setRememberedCapabilitiesForWidget(widget, Array.from(allAllowed));
    }

    return allAllowed;
}
