/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>

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

import { Room } from "matrix-js-sdk/src/matrix";
import { MatrixClientPeg } from "matrix-react-sdk/src/MatrixClientPeg";
import { Command, CommandCategories, CommandMap } from "matrix-react-sdk/src/SlashCommands";
import AutocompleteProvider from "matrix-react-sdk/src/autocomplete/AutocompleteProvider";
import { TextualCompletion } from "matrix-react-sdk/src/autocomplete/Components";
import QueryMatcher from "matrix-react-sdk/src/autocomplete/QueryMatcher";
import { TimelineRenderingType } from "matrix-react-sdk/src/contexts/RoomContext";
import { _t } from "matrix-react-sdk/src/languageHandler";
import React from "react";

import { ICompletion, ISelectionRange } from "./Autocompleter";

const COMMAND_RE = /(^\/\w*)(?: .*)?/g;

export type BotCommand = {
    name: string;
    arguments: {
        name: string;
        description: string;
    }[];
    description: string;
};

export default class CommandProvider extends AutocompleteProvider {
    public matcher: QueryMatcher<Command>;
    public room: Room;

    public constructor(room: Room, renderingType?: TimelineRenderingType) {
        super({ commandRegex: COMMAND_RE, renderingType });
        this.room = room;
        this.matcher = new QueryMatcher(this.getRoomCommands(), {
            keys: ["command", "args", "description"],
            funcs: [({ aliases }): string => aliases.join(" ")], // aliases
            context: renderingType,
        });
    }

    public getRoomCommands(): Command[] {
        const commandStorage = JSON.parse(localStorage.getItem("BOT_COMMANDS") || "{}");

        if (
            commandStorage[this.room.name] &&
            this.room.getMembers().some((member) => member.userId.includes(this.room.name))
        ) {
            return commandStorage[this.room.name].map(
                (cmd: BotCommand) =>
                    new Command({
                        command: cmd.name,
                        args: cmd.arguments.map((arg) => `<${arg.name}>`).join(" "),
                        description: cmd.description as any,
                        category: CommandCategories.messages,
                    }),
            );
        }

        return [];
    }

    public async getCompletions(
        query: string,
        selection: ISelectionRange,
        force?: boolean,
        limit = -1,
    ): Promise<ICompletion[]> {
        const { command, range } = this.getCurrentCommand(query, selection);
        if (!command) return [];

        const cli = MatrixClientPeg.get();

        let matches: Command[] = [];
        // check if the full match differs from the first word (i.e. returns false if the command has args)
        if (command[0] !== command[1]) {
            // The input looks like a command with arguments, perform exact match
            const name = command[1].slice(1); // strip leading `/`
            if (CommandMap.has(name) && CommandMap.get(name)!.isEnabled(cli)) {
                // some commands, namely `me` don't suit having the usage shown whilst typing their arguments
                if (CommandMap.get(name)!.hideCompletionAfterSpace) return [];
                matches = [CommandMap.get(name)!];
            }
        } else {
            if (query === "/") {
                // If they have just entered `/` show everything
                // We exclude the limit on purpose to have a comprehensive list
                matches = this.getRoomCommands();
            } else {
                // otherwise fuzzy match against all of the fields
                matches = this.matcher.match(command[1], limit);
            }
        }

        return matches
            .filter((cmd) => {
                const display = !cmd.renderingTypes || cmd.renderingTypes.includes(this.renderingType);
                return cmd.isEnabled(cli) && display;
            })
            .map((result) => {
                let completion = result.getCommand() + " ";
                const usedAlias = result.aliases.find((alias) => `/${alias}` === command[1]);
                // If the command (or an alias) is the same as the one they entered, we don't want to discard their arguments
                if (usedAlias || result.getCommand() === command[1]) {
                    completion = command[0];
                }

                return {
                    completion,
                    type: "command",
                    component: (
                        <TextualCompletion
                            title={`/${usedAlias || result.command}`}
                            subtitle={result.args}
                            description={result.description}
                            // description={_t(result.description)}
                        />
                    ),
                    range: range!,
                };
            });
    }

    public getName(): string {
        return "*️⃣ " + _t("composer|autocomplete|command_description");
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill"
                role="presentation"
                aria-label={_t("composer|autocomplete|command_a11y")}
            >
                {completions}
            </div>
        );
    }
}
