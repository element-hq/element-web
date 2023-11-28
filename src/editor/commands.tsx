import { IContent, MatrixClient } from "matrix-js-sdk/src/matrix";
import { Command, getCommand } from "matrix-react-sdk/src/SlashCommands";
import EditorModel from "matrix-react-sdk/src/editor/model";
import { Type } from "matrix-react-sdk/src/editor/parts";

export function isSlashCommand(model: EditorModel): boolean {
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
    return [null, false];
}

export async function shouldSendAnyway(commandText: string): Promise<boolean> {
    return true;
}
