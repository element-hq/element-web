// @flow

export default class BaseIntegrationManager {
    constructor() {
        this.notificationCount = 0;
        this.errorDidOccur = false;
    }

    setNotificationCount(count: number) {
        this.notificationCount = count;
    }

    setErrorStatus(errorDidOccur: boolean) {
        this.errorDidOccur = errorDidOccur;
    }
}
