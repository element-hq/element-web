import AutocompleteProvider from './AutocompleteProvider';
import Q from 'q';
import 'whatwg-fetch';

const DDG_REGEX = /\/ddg\w+(.+)$/;
const REFERER = 'vector';

export default class DuckDuckGoProvider extends AutocompleteProvider {
    static getQueryUri(query: String) {
        return `http://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&t=${encodeURIComponent(REFERER)}`;
    }

    getCompletions(query: String) {
        if(!query)
            return Q.when([]);

        let promise = Q.defer();
        fetch(DuckDuckGoProvider.getQueryUri(query), {
            method: 'GET'
        }).then(response => {
            let results = response.Results.map(result => {
                return {
                    title: result.Text,
                    description: result.Result
                };
            });
            promise.resolve(results);
        });
        return promise;
    }

    getName() {
        return 'Results from DuckDuckGo';
    }
}
