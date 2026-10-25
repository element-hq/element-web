/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type Widget, type WidgetKind } from "matrix-widget-api";

import Modal from "../../Modal";
import WidgetOpenIDPermissionsDialog from "../../components/views/dialogs/WidgetOpenIDPermissionsDialog";
import { SDKContextClass } from "../../contexts/SDKContextClass";
import { ModuleApi } from "../../modules/Api";
import { toWidgetDescriptor } from "../../modules/WidgetLifecycleApi";
import { OIDCState } from "./WidgetPermissionStore";

interface WidgetOpenIdApprovalOptions {
    /** The widget asking for an OpenID token. */
    widget: Widget;
    widgetKind: WidgetKind;
    /** The room the widget lives in, if it is a room widget. */
    roomId?: string;
    /** Called when the user is about to be asked, so the widget can be told to wait. */
    onPrompt?: () => void;
}

/**
 * Decides whether a widget may receive an OpenID token identifying the user. Shared by every
 * widget host implementation.
 *
 * The order is: a module registered through the widget lifecycle API, then the decision the user
 * remembered for this widget, and finally the OpenID prompt.
 */
export async function approveWidgetOpenId(opts: WidgetOpenIdApprovalOptions): Promise<boolean> {
    const { widget, widgetKind, roomId, onPrompt } = opts;

    // Try the new module API first, then fall back to legacy path
    const approved = await ModuleApi.instance.widgetLifecycle.preapproveIdentity(toWidgetDescriptor(widget, roomId));
    if (approved) return true;

    const oidcState = SDKContextClass.instance.widgetPermissionStore.getOIDCState(widget, widgetKind, roomId);
    if (oidcState === OIDCState.Denied) return false;
    if (oidcState === OIDCState.Allowed) return true;

    onPrompt?.();
    const { finished } = Modal.createDialog(WidgetOpenIDPermissionsDialog, {
        widget,
        widgetKind,
        inRoomId: roomId,
    });
    const [confirm] = await finished;
    return !!confirm;
}
