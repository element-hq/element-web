/**
 * Because we've been saving a lot of additional logger data in the localStorage for no particular reason
 * we need to, hopefully, unbrick user's devices by geting rid of unnecessary data.
 * */

if (window.localStorage) {
    Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith("loglevel:")) {
            window.localStorage.removeItem(key);
        }
    });
}
