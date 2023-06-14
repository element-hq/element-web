/*
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { IContent } from "matrix-js-sdk/src/models/event";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import EditorModel from "./model";
import { Type } from "./parts";
import { Command, CommandCategories, getCommand } from "../SlashCommands";
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
): Promise<[content: IContent | null, success: boolean]> {
    const result = cmd.run(matrixClient, roomId, threadId, args);
    let messageContent: IContent | null = null;
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
        const title = isServerError ? _td("Server error") : _td("Command error");

        let errText;
        if (typeof error === "string") {
            errText = error;
        } else if (error instanceof UserFriendlyError) {
            errText = error.translatedMessage;
        } else if (error.message) {
            errText = error.message;
        } else {
            errText = _t("Server unavailable, overloaded, or something else went wrong.");
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
        title: _t("Unknown Command"),
        description: (
            <div>
                <p>{_t("Unrecognised command: %(commandText)s", { commandText })}</p>
                <p>
                    {_t(
                        "You can use <code>/help</code> to list available commands. " +
                            "Did you mean to send this as a message?",
                        {},
                        {
                            code: (t) => <code>{t}</code>,
                        },
                    )}
                </p>
                <p>
                    {_t(
                        "Hint: Begin your message with <code>//</code> to start it with a slash.",
                        {},
                        {
                            code: (t) => <code>{t}</code>,
                        },
                    )}
                </p>
            </div>
        ),
        button: _t("Send as message"),
    });
    const [sendAnyway] = await finished;
    return sendAnyway || false;
}
