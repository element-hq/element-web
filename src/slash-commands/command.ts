/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type SlashCommand as SlashCommandEvent } from "@matrix-org/analytics-events/types/typescript/SlashCommand";

import { TimelineRenderingType } from "../contexts/RoomContext";
import { reject } from "./utils";
import { _t, type TranslationKey, UserFriendlyError } from "../languageHandler";
import { PosthogAnalytics } from "../PosthogAnalytics";
import { CommandCategories, type RunResult } from "./interface";

type RunFn = (
    this: Command,
    matrixClient: MatrixClient,
    roomId: string,
    threadId: string | null,
    args?: string,
) => RunResult;

interface ICommandOpts {
    command: string;
    aliases?: string[];
    args?: string;
    description: TranslationKey;
    analyticsName?: SlashCommandEvent["command"];
    runFn?: RunFn;
    category: string;
    hideCompletionAfterSpace?: boolean;
    isEnabled?(matrixClient: MatrixClient | null): boolean;
    renderingTypes?: TimelineRenderingType[];
}

export class Command {
    public readonly command: string;
    public readonly aliases: string[];
    public readonly args?: string;
    public readonly description: TranslationKey;
    public readonly runFn?: RunFn;
    public readonly category: string;
    public readonly hideCompletionAfterSpace: boolean;
    public readonly renderingTypes?: TimelineRenderingType[];
    public readonly analyticsName?: SlashCommandEvent["command"];
    private readonly _isEnabled?: (matrixClient: MatrixClient | null) => boolean;

    public constructor(opts: ICommandOpts) {
        this.command = opts.command;
        this.aliases = opts.aliases || [];
        this.args = opts.args || "";
        this.description = opts.description;
        this.runFn = opts.runFn?.bind(this);
        this.category = opts.category || CommandCategories.other;
        this.hideCompletionAfterSpace = opts.hideCompletionAfterSpace || false;
        this._isEnabled = opts.isEnabled;
        this.renderingTypes = opts.renderingTypes;
        this.analyticsName = opts.analyticsName;
    }

    public getCommand(): string {
        return `/${this.command}`;
    }

    public getCommandWithArgs(): string {
        return this.getCommand() + " " + this.args;
    }

    public run(matrixClient: MatrixClient, roomId: string, threadId: string | null, args?: string): RunResult {
        // if it has no runFn then its an ignored/nop command (autocomplete only) e.g `/me`
        if (!this.runFn) {
            return reject(new UserFriendlyError("slash_command|error_invalid_runfn"));
        }

        const renderingType = threadId ? TimelineRenderingType.Thread : TimelineRenderingType.Room;
        if (this.renderingTypes && !this.renderingTypes?.includes(renderingType)) {
            return reject(
                new UserFriendlyError("slash_command|error_invalid_rendering_type", {
                    renderingType,
                    cause: undefined,
                }),
            );
        }

        if (this.analyticsName) {
            PosthogAnalytics.instance.trackEvent<SlashCommandEvent>({
                eventName: "SlashCommand",
                command: this.analyticsName,
            });
        }

        return this.runFn(matrixClient, roomId, threadId, args);
    }

    public getUsage(): string {
        return _t("slash_command|usage") + ": " + this.getCommandWithArgs();
    }

    public isEnabled(cli: MatrixClient | null): boolean {
        return this._isEnabled?.(cli) ?? true;
    }
}
