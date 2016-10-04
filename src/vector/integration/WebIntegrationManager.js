// @flow
import BaseIntegrationManager from './BaseIntegrationManager';
import Favico from 'favico.js';

export default class WebIntegrationManager extends BaseIntegrationManager {
    constructor() {
        super();
        this.favicon = new Favico({animation: 'popFade'});
        this.updateFavicon();
    }

    updateFavicon() {
        try {
            // This needs to be in in a try block as it will throw
            // if there are more than 100 badge count changes in
            // its internal queue
            let bgColor = "#d00",
                notif = this.notificationCount;

            if (this.errorDidOccur) {
                notif = notif || "×";
                bgColor = "#f00";
            }

            this.favicon.badge(notif, {
                bgColor: bgColor
            });
        } catch (e) {
            console.warn(`Failed to set badge count: ${e.message}`);
        }
    }

    setNotificationCount(count: number) {
        super.setNotificationCount(count);
        this.updateFavicon();
    }

    setErrorStatus(errorDidOccur: boolean) {
        super.setErrorStatus(errorDidOccur);
        this.updateFavicon();
    }
}
