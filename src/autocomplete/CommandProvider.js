import React from 'react';
import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import Fuse from 'fuse.js';
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
        description: 'Invites user with given id to current room'
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
];

let COMMAND_RE = /(^\/\w*)/g;

let instance = null;

export default class CommandProvider extends AutocompleteProvider {
    constructor() {
        super(COMMAND_RE);
        this.fuse = new Fuse(COMMANDS, {
           keys: ['command', 'args', 'description'],
        });
    }

    getCompletions(query: string, selection: {start: number, end: number}) {
        let completions = [];
        let {command, range} = this.getCurrentCommand(query, selection);
        if (command) {
            completions = this.fuse.search(command[0]).map(result => {
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
        return Q.when(completions);
    }

    getName() {
        return 'Commands';
    }

    static getInstance(): CommandProvider {
        if (instance == null)
            instance = new CommandProvider();

        return instance;
    }
}
