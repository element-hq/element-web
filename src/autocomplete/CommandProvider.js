import React from 'react';
import AutocompleteProvider from './AutocompleteProvider';
import FuzzyMatcher from './FuzzyMatcher';
import {TextualCompletion} from './Components';

const COMMANDS = [
    {
        command: '/me',
        args: '<message>',
        description: 'Displays action',
    },
    {
        command: '/ban',
        args: '<user-id> [reason]',
        description: 'Bans user with given id',
    },
    {
        command: '/deop',
        args: '<user-id>',
        description: 'Deops user with given id',
    },
    {
        command: '/invite',
        args: '<user-id>',
        description: 'Invites user with given id to current room',
    },
    {
        command: '/join',
        args: '<room-alias>',
        description: 'Joins room with given alias',
    },
    {
        command: '/kick',
        args: '<user-id> [reason]',
        description: 'Kicks user with given id',
    },
    {
        command: '/nick',
        args: '<display-name>',
        description: 'Changes your display nickname',
    },
    {
        command: '/ddg',
        args: '<query>',
        description: 'Searches DuckDuckGo for results',
    }
];

let COMMAND_RE = /(^\/\w*)/g;

let instance = null;

export default class CommandProvider extends AutocompleteProvider {
    constructor() {
        super(COMMAND_RE);
        this.matcher = new FuzzyMatcher(COMMANDS, {
           keys: ['command', 'args', 'description'],
        });
    }

    async getCompletions(query: string, selection: {start: number, end: number}) {
        let completions = [];
        let {command, range} = this.getCurrentCommand(query, selection);
        if (command) {
            completions = this.matcher.match(command[0]).map(result => {
                return {
                    completion: result.command + ' ',
                    component: (<TextualCompletion
                        title={result.command}
                        subtitle={result.args}
                        description={result.description}
                        />),
                    range,
                };
            });
        }
        return completions;
    }

    getName() {
        return '*️⃣ Commands';
    }

    static getInstance(): CommandProvider {
        if (instance == null)
            {instance = new CommandProvider();}

        return instance;
    }

    renderCompletions(completions: [React.Component]): ?React.Component {
        return <div className="mx_Autocomplete_Completion_container_block">
            {completions}
        </div>;
    }
}
