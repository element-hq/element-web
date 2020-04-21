/*
Copyright 2016 Aviral Dasgupta
Copyright 2017 Vector Creations Ltd
Copyright 2017, 2018 New Vector Ltd

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

import React from 'react';
import { _t } from '../languageHandler';
import AutocompleteProvider from './AutocompleteProvider';

import {TextualCompletion} from './Components';
import {ICompletion, ISelectionRange} from "./Autocompleter";

const DDG_REGEX = /\/ddg\s+(.+)$/g;
const REFERRER = 'vector';

export default class DuckDuckGoProvider extends AutocompleteProvider {
    constructor() {
        super(DDG_REGEX);
    }

    static getQueryUri(query: string) {
        return `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}`
         + `&format=json&no_redirect=1&no_html=1&t=${encodeURIComponent(REFERRER)}`;
    }

    async getCompletions(query: string, selection: ISelectionRange, force= false): Promise<ICompletion[]> {
        const {command, range} = this.getCurrentCommand(query, selection);
        if (!query || !command) {
            return [];
        }

        const response = await fetch(DuckDuckGoProvider.getQueryUri(command[1]), {
            method: 'GET',
        });
        const json = await response.json();
        const results = json.Results.map((result) => {
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
        return '🔍 ' + _t('Results from DuckDuckGo');
    }

    renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_block"
                role="listbox"
                aria-label={_t("DuckDuckGo Results")}
            >
                { completions }
            </div>
        );
    }
}
