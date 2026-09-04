/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * Element Call's component API for use across Element Web.
 *
 * The **types** come straight from `@element-hq/element-call-component`. The **enums** are string
 * mirrors of the package's: importing them as values from the package would pull the whole component
 * bundle into Element Web's main chunk (the call model needs `BackgroundStyle` on the widget path too),
 * and TypeScript treats enums with the same name and members as compatible, so the mirrors are
 * accepted wherever the package's enum types are expected. `configurationForIntent` is a copy of EC's
 * for the mock, which shows the effective configuration EC would derive.
 */

import type * as ElementCallComponent from "@element-hq/element-call-component";
import type { UrlConfiguration } from "@element-hq/element-call-component";

export type {
    ConfigOptions,
    DeviceMuteRequest,
    DeviceMuteState,
    ElementCallConfiguration,
    ElementCallProps,
    HostBridge,
    HostRequest,
    JoinCallData,
    UrlConfiguration,
} from "@element-hq/element-call-component";

/**
 * What `ElementCallAppTile` needs from a dynamically imported Element Call module — satisfied by the
 * package and by `ElementCallMock`.
 */
export type ElementCallComponentModule = Pick<typeof ElementCallComponent, "ElementCall" | "initializeElementCall">;

/** Mirror of EC's `UserIntent` (`src/UrlParams.ts`). Values match EW's `ElementCallIntent`. */
export enum UserIntent {
    StartNewCall = "start_call",
    JoinExistingCall = "join_existing",
    StartNewCallVoice = "start_call_voice",
    JoinExistingCallVoice = "join_existing_voice",
    StartNewCallDM = "start_call_dm",
    StartNewCallDMVoice = "start_call_dm_voice",
    JoinExistingCallDM = "join_existing_dm",
    JoinExistingCallDMVoice = "join_existing_dm_voice",
    Unknown = "unknown",
}

/** Mirror of EC's `HeaderStyle`. */
export enum HeaderStyle {
    None = "none",
    Standard = "standard",
    AppBar = "app_bar",
}

/** Mirror of EC's `BackgroundStyle`. */
export enum BackgroundStyle {
    Solid = "solid",
    /** @public mirrored from Element Call; EW always uses Solid */
    Gradient = "gradient",
}

/**
 * `configurationForIntent` from EC's `src/UrlParams.ts` (browser platform).
 * Kept equivalent so the mock shows the same effective configuration EC would
 * derive from EW's intent.
 */
export function configurationForIntent(intent: UserIntent): UrlConfiguration {
    let preset: UrlConfiguration = {
        confineToRoom: true,
        preload: false,
        header: HeaderStyle.AppBar,
        showControls: true,
        hideScreensharing: false,
        allowIceFallback: true,
        perParticipantE2EE: true,
        controlledAudioDevices: true,
        skipLobby: true,
        returnToLobby: false,
        sendNotificationType: "notification",
        autoLeaveWhenOthersLeft: false,
        waitForCallPickup: false,
    };
    switch (intent) {
        case UserIntent.StartNewCall:
        case UserIntent.JoinExistingCall:
            preset.skipLobby = false;
            preset.callIntent = "video";
            break;
        case UserIntent.StartNewCallVoice:
        case UserIntent.JoinExistingCallVoice:
            preset.skipLobby = false;
            preset.callIntent = "audio";
            break;
        case UserIntent.StartNewCallDM:
        case UserIntent.StartNewCallDMVoice:
            preset.skipLobby = true;
            preset.sendNotificationType = "ring";
            preset.autoLeaveWhenOthersLeft = true;
            preset.waitForCallPickup = true;
            preset.callIntent = intent === UserIntent.StartNewCallDMVoice ? "audio" : "video";
            break;
        case UserIntent.JoinExistingCallDM:
        case UserIntent.JoinExistingCallDMVoice:
            preset.skipLobby = true;
            preset.autoLeaveWhenOthersLeft = true;
            preset.callIntent = intent === UserIntent.JoinExistingCallDMVoice ? "audio" : "video";
            break;
        default:
            preset = {
                confineToRoom: false,
                preload: false,
                header: HeaderStyle.Standard,
                showControls: true,
                hideScreensharing: false,
                allowIceFallback: false,
                perParticipantE2EE: false,
                controlledAudioDevices: false,
                skipLobby: false,
                returnToLobby: false,
                autoLeaveWhenOthersLeft: false,
                waitForCallPickup: false,
            };
    }
    return preset;
}
