const q = require('q');
const request = q.nfbind(require('browser-request'));

export default class RtsClient {
    constructor(url) {
        this._url = url;
    }

    getTeamsConfig() {
        return request({
            url: this._url + '/teams',
            json: true,
        });
    }
}
