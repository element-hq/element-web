const q = require('q');
const request = (opts) => {
    const expectingJSONOnSucess = opts.json;
    if (opts.json) {
        opts.json = false;
    }
    return q.nfbind(require('browser-request'))(opts).then((args) => {
        const response = args[0];
        let body = args[1];

        // Do not expect JSON on error status code, throw error instead
        if (response.statusCode !== 200) {
            throw new Error(body);
        }

        if (expectingJSONOnSucess) {
            body = JSON.parse(body);
        }

        return [response, body];
    });
};

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

    /**
     * Track a referral with the Riot Team Server. This should be called once a referred
     * user has been successfully registered.
     * @param {string} referrer the user ID of one who referred the user to Riot.
     * @param {string} user_id the user ID of the user being referred.
     * @param {string} user_email the email address linked to `user_id`.
     * @returns {Promise} a promise that resolves to [$response, $body], where $response
     * is the response object created by the request lib and $body is the object parsed
     * from the JSON response body. $body should be { team_token: 'sometoken' } upon
     * success.
     */
    trackReferral(referrer, user_id, user_email) {
        return request({
            url: this._url + '/register',
            json: true,
            body: {referrer, user_id, user_email},
            method: 'POST',
        });
    }

    getTeam(team_token) {
        return request({
            url: this._url + '/teamConfiguration',
            json: true,
            qs: {team_token},
        });
    }
}
