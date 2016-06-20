import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import 'whatwg-fetch';

const DDG_REGEX = /\/ddg\s+(.+)$/;
const REFERER = 'vector';

let instance = null;

export default class DuckDuckGoProvider extends AutocompleteProvider {
    static getQueryUri(query: String) {
        return `http://api.duckduckgo.com/?q=${encodeURIComponent(query)}`
         + `&format=json&no_redirect=1&no_html=1&t=${encodeURIComponent(REFERER)}`;
    }

    getCompletions(query: String) {
        let match = DDG_REGEX.exec(query);
        if(!query || !match)
            return Q.when([]);

        return fetch(DuckDuckGoProvider.getQueryUri(match[1]), {
            method: 'GET'
        })
            .then(response => response.json())
            .then(json => {
                let results = json.Results.map(result => {
                    return {
                        title: result.Text,
                        description: result.Result
                    };
                });
                if(json.Answer) {
                    results.unshift({
                        title: json.Answer,
                        description: json.AnswerType
                    });
                }
                if(json.RelatedTopics && json.RelatedTopics.length > 0) {
                    results.unshift({
                        title: json.RelatedTopics[0].Text
                    });
                }
                if(json.AbstractText) {
                    results.unshift({
                        title: json.AbstractText
                    });
                }
                // console.log(results);
                return results;
            });
    }

    getName() {
        return 'Results from DuckDuckGo';
    }

    static getInstance(): DuckDuckGoProvider {
        if(instance == null)
            instance = new DuckDuckGoProvider();

        return instance;
    }
}
