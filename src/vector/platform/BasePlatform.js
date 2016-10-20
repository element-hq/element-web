// @flow

export default class BasePlatform {
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
