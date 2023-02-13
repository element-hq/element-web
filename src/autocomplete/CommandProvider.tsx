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

import React from "react";
import { Room } from "matrix-js-sdk/src/models/room";

import { _t } from "../languageHandler";
import AutocompleteProvider from "./AutocompleteProvider";
import QueryMatcher from "./QueryMatcher";
import { TextualCompletion } from "./Components";
import { ICompletion, ISelectionRange } from "./Autocompleter";
import { Command, Commands, CommandMap } from "../SlashCommands";
import { TimelineRenderingType } from "../contexts/RoomContext";

const COMMAND_RE = /(^\/\w*)(?: .*)?/g;

export default class CommandProvider extends AutocompleteProvider {
    public matcher: QueryMatcher<Command>;

    public constructor(room: Room, renderingType?: TimelineRenderingType) {
        super({ commandRegex: COMMAND_RE, renderingType });
        this.matcher = new QueryMatcher(Commands, {
            keys: ["command", "args", "description"],
            funcs: [({ aliases }) => aliases.join(" ")], // aliases
            context: renderingType,
        });
    }

    public async getCompletions(
        query: string,
        selection: ISelectionRange,
        force?: boolean,
        limit = -1,
    ): Promise<ICompletion[]> {
        const { command, range } = this.getCurrentCommand(query, selection);
        if (!command) return [];

        let matches: Command[] = [];
        // check if the full match differs from the first word (i.e. returns false if the command has args)
        if (command[0] !== command[1]) {
            // The input looks like a command with arguments, perform exact match
            const name = command[1].slice(1); // strip leading `/`
            if (CommandMap.has(name) && CommandMap.get(name)!.isEnabled()) {
                // some commands, namely `me` don't suit having the usage shown whilst typing their arguments
                if (CommandMap.get(name)!.hideCompletionAfterSpace) return [];
                matches = [CommandMap.get(name)!];
            }
        } else {
            if (query === "/") {
                // If they have just entered `/` show everything
                // We exclude the limit on purpose to have a comprehensive list
                matches = Commands;
            } else {
                // otherwise fuzzy match against all of the fields
                matches = this.matcher.match(command[1], limit);
            }
        }

        return matches
            .filter((cmd) => {
                const display = !cmd.renderingTypes || cmd.renderingTypes.includes(this.renderingType);
                return cmd.isEnabled() && display;
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
                            description={_t(result.description)}
                        />
                    ),
                    range: range!,
                };
            });
    }

    public getName(): string {
        return "*️⃣ " + _t("Commands");
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill"
                role="presentation"
                aria-label={_t("Command Autocomplete")}
            >
                {completions}
            </div>
        );
    }
}
