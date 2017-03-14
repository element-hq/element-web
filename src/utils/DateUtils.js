// Returns date as a string relative to current date (e.g. 'today', 'yesterday')
// if it is relatively close, or just as a string othervise
export function getDateAsLabel(ts) {
    var date = new Date(ts);
    var today = new Date();
    var yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    var label;
    if (date.toDateString() === today.toDateString()) {
        label = "Today";
    }
    else if (date.toDateString() === yesterday.toDateString()) {
        label = "Yesterday";
    }
    else if (today.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
        label = days[date.getDay()];
    }
    else {
        label = date.toDateString();
    }
    return label;
}
