/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * A description of a widget passed to approver callbacks.
 * Contains the information needed to make approval decisions.
 * @alpha Subject to change.
 */
export type WidgetDescriptor = {
    /** The unique identifier of the widget. */
    id: string;
    /** The template URL of the widget, which may contain `$matrix_*` placeholder variables. */
    templateUrl: string;
    /** The Matrix user ID of the user who created the widget. */
    creatorUserId: string;
    /** The widget type, e.g. `m.custom`, `m.jitsi`, `m.stickerpicker`. */
    type: string;
    /** The origin of the widget URL. */
    origin: string;
    /** The room ID the widget belongs to, if it is a room widget. */
    roomId?: string;
};

/**
 * Callback that decides whether a widget should be auto-approved for preloading
 * (i.e. loaded without the user clicking "Continue").
 * Return `true` to auto-approve, or any other value to defer to the default consent flow.
 * @alpha Subject to change.
 */
export type PreloadApprover = (widget: WidgetDescriptor) => boolean | Promise<boolean> | undefined;
/**
 * Callback that decides whether a widget should be auto-approved to receive
 * the user's OpenID identity token.
 * Return `true` to auto-approve, or any other value to defer to the default consent flow.
 * @alpha Subject to change.
 */
export type IdentityApprover = (widget: WidgetDescriptor) => boolean | Promise<boolean> | undefined;
/**
 * Callback that decides which of a widget's requested capabilities should be auto-approved.
 * Return a `Set` of approved capability strings, or `undefined` to defer to the default consent flow.
 * @alpha Subject to change.
 */
export type CapabilitiesApprover = (
    widget: WidgetDescriptor,
    requestedCapabilities: Set<string>,
) => Set<string> | Promise<Set<string> | undefined> | undefined;

/**
 * API for modules to auto-approve widget preloading, identity token requests, and capability requests.
 * @alpha Subject to change.
 */
export interface WidgetLifecycleApi {
    /**
     * Register a handler that can auto-approve widget preloading.
     * Returning true auto-approves; any other value results in no auto-approval.
     */
    registerPreloadApprover(approver: PreloadApprover): void;

    /**
     * Register a handler that can auto-approve identity token requests.
     * Returning true auto-approves; any other value results in no auto-approval.
     */
    registerIdentityApprover(approver: IdentityApprover): void;

    /**
     * Register a handler that can auto-approve widget capabilities.
     * Return a set containing the capabilities to approve.
     */
    registerCapabilitiesApprover(approver: CapabilitiesApprover): void;
}
