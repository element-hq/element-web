// @flow
import BasePlatform from './BasePlatform';
import Favico from 'favico.js';

export default class WebPlatform extends BasePlatform {
    constructor() {
        super();
        // The 'animations' are really low framerate and look terrible.
        // Also it re-starts the animationb every time you set the badge,
        // and we set the state each time, even if the value hasn't changed,
        // so we'd need to fix that if enabling the animation.
        this.favicon = new Favico({animation: 'none'});
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
