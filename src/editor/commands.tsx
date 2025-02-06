/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type RoomMessageEventContent } from "matrix-js-sdk/src/types";

import type EditorModel from "./model";
import { Type } from "./parts";
import { type Command, CommandCategories, getCommand } from "../SlashCommands";
import { UserFriendlyError, _t, _td } from "../languageHandler";
import Modal from "../Modal";
import ErrorDialog from "../components/views/dialogs/ErrorDialog";
import QuestionDialog from "../components/views/dialogs/QuestionDialog";

export function isSlashCommand(model: EditorModel): boolean {
    const parts = model.parts;
    const firstPart = parts[0];
    if (firstPart) {
        if (firstPart.type === Type.Command && firstPart.text.startsWith("/") && !firstPart.text.startsWith("//")) {
            return true;
        }

        if (
            firstPart.text.startsWith("/") &&
            !firstPart.text.startsWith("//") &&
            (firstPart.type === Type.Plain || firstPart.type === Type.PillCandidate)
        ) {
            return true;
        }
    }
    return false;
}

export function getSlashCommand(model: EditorModel): [Command | undefined, string | undefined, string] {
    const commandText = model.parts.reduce((text, part) => {
        // use mxid to textify user pills in a command and room alias/id for room pills
        if (part.type === Type.UserPill || part.type === Type.RoomPill) {
            return text + part.resourceId;
        }
        return text + part.text;
    }, "");
    const { cmd, args } = getCommand(commandText);
    return [cmd, args, commandText];
}

export async function runSlashCommand(
    matrixClient: MatrixClient,
    cmd: Command,
    args: string | undefined,
    roomId: string,
    threadId: string | null,
): Promise<[content: RoomMessageEventContent | null, success: boolean]> {
    const result = cmd.run(matrixClient, roomId, threadId, args);
    let messageContent: RoomMessageEventContent | null = null;
    let error: any = result.error;
    if (result.promise) {
        try {
            if (cmd.category === CommandCategories.messages || cmd.category === CommandCategories.effects) {
                messageContent = (await result.promise) ?? null;
            } else {
                await result.promise;
            }
        } catch (err) {
            error = err;
        }
    }
    if (error) {
        logger.error(`Command failure: ${error}`);
        // assume the error is a server error when the command is async
        const isServerError = !!result.promise;
        const title = isServerError ? _td("slash_command|server_error") : _td("slash_command|command_error");

        let errText;
        if (typeof error === "string") {
            errText = error;
        } else if (error instanceof UserFriendlyError) {
            errText = error.translatedMessage;
        } else if (error.message) {
            errText = error.message;
        } else {
            errText = _t("slash_command|server_error_detail");
        }

        Modal.createDialog(ErrorDialog, {
            title: _t(title),
            description: errText,
        });
        return [null, false];
    } else {
        logger.log("Command success.");
        return [messageContent, true];
    }
}

export async function shouldSendAnyway(commandText: string): Promise<boolean> {
    // ask the user if their unknown command should be sent as a message
    const { finished } = Modal.createDialog(QuestionDialog, {
        title: _t("slash_command|unknown_command"),
        description: (
            <div>
                <p>{_t("slash_command|unknown_command_detail", { commandText })}</p>
                <p>
                    {_t(
                        "slash_command|unknown_command_help",
                        {},
                        {
                            code: (t) => <code>{t}</code>,
                        },
                    )}
                </p>
                <p>
                    {_t(
                        "slash_command|unknown_command_hint",
                        {},
                        {
                            code: (t) => <code>{t}</code>,
                        },
                    )}
                </p>
            </div>
        ),
        button: _t("slash_command|unknown_command_button"),
    });
    const [sendAnyway] = await finished;
    return sendAnyway || false;
}
