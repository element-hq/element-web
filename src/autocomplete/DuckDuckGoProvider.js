import React from 'react';
import AutocompleteProvider from './AutocompleteProvider';
import 'whatwg-fetch';

import {TextualCompletion} from './Components';

const DDG_REGEX = /\/ddg\s+(.+)$/g;
const REFERRER = 'vector';

let instance = null;

export default class DuckDuckGoProvider extends AutocompleteProvider {
    constructor() {
        super(DDG_REGEX);
    }

    static getQueryUri(query: String) {
        return `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}`
         + `&format=json&no_redirect=1&no_html=1&t=${encodeURIComponent(REFERRER)}`;
    }

    async getCompletions(query: string, selection: {start: number, end: number}) {
        let {command, range} = this.getCurrentCommand(query, selection);
        if (!query || !command) {
            return [];
        }

        const response = await fetch(DuckDuckGoProvider.getQueryUri(command[1]), {
            method: 'GET',
        });
        const json = await response.json();
        let results = json.Results.map(result => {
            return {
                completion: result.Text,
                component: (
                    <TextualCompletion
                        title={result.Text}
                        description={result.Result} />
                ),
                range,
            };
        });
        if (json.Answer) {
            results.unshift({
                completion: json.Answer,
                component: (
                    <TextualCompletion
                        title={json.Answer}
                        description={json.AnswerType} />
                ),
                range,
            });
        }
        if (json.RelatedTopics && json.RelatedTopics.length > 0) {
            results.unshift({
                completion: json.RelatedTopics[0].Text,
                component: (
                    <TextualCompletion
                        title={json.RelatedTopics[0].Text} />
                ),
                range,
            });
        }
        if (json.AbstractText) {
            results.unshift({
                completion: json.AbstractText,
                component: (
                    <TextualCompletion
                        title={json.AbstractText} />
                ),
                range,
            });
        }
        return results;
    }

    getName() {
        return '🔍 Results from DuckDuckGo';
    }

    static getInstance(): DuckDuckGoProvider {
        if (instance == null) {
            instance = new DuckDuckGoProvider();
        }
        return instance;
    }

    renderCompletions(completions: [React.Component]): ?React.Component {
        return <div className="mx_Autocomplete_Completion_container_block">
            {completions}
        </div>;
    }
}
