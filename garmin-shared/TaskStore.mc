import Toybox.Application;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;

//! Today's routine tasks as last received from /api/watch/tasks, kept in
//! Application.Storage so the app, its glance and the watch face can read
//! them without a network call. Row layout (see SyncServiceDelegate):
//!   [id, title, due "HH:MM" or null, status, snoozedUntil epoch or null]
//! status is "pending" | "done" | "snoozed" | "skipped".
(:background :glance)
module TaskStore {

    const ID = 0;
    const TITLE = 1;
    const DUE = 2;
    const STATUS = 3;
    const SNOOZED = 4;

    //! Compact rows from a /api/watch/tasks JSON response (max 20)
    function rows(data as Dictionary) as Array<Application.PropertyValueType> {
        var rows = [] as Array<Application.PropertyValueType>;
        var list = data["tasks"];
        if (list instanceof Array) {
            for (var i = 0; i < list.size() && i < 20; i += 1) {
                var t = list[i];
                if (t instanceof Dictionary) {
                    rows.add([t["id"], t["title"], t["due"], t["status"], t["snoozedUntil"]] as Array<Application.PropertyValueType>);
                }
            }
        }
        return rows;
    }

    //! Store the dictionary passed to AppBase.onBackgroundData
    function save(data as Application.PersistableType) as Void {
        var now = Time.now().value();
        if (data instanceof Number) {
            // Older format: just the ingest HTTP code
            Application.Storage.setValue("lastResult", data);
            Application.Storage.setValue("lastTime", now);
            return;
        }
        if (!(data instanceof Dictionary)) {
            return;
        }
        Application.Storage.setValue("lastResult", data["code"] as Number or Null);
        Application.Storage.setValue("lastTime", now);
        var tcode = data["tcode"];
        if (tcode instanceof Number && tcode == 200 && data["tasks"] instanceof Array) {
            saveTasks(data["tasks"] as Array, data["readiness"], data["due"]);
        }
    }

    function saveTasks(tasks as Array, readiness as Application.PersistableType, due as Application.PersistableType) as Void {
        Application.Storage.setValue("tasks", tasks as Array<Application.PropertyValueType>);
        Application.Storage.setValue("readiness", readiness instanceof Number ? readiness : null);
        Application.Storage.setValue("due", due instanceof Array ? due as Array<Application.PropertyValueType> : []);
        Application.Storage.setValue("tasksAt", Time.now().value());
    }

    function tasks() as Array {
        var t = Application.Storage.getValue("tasks");
        return t instanceof Array ? t : [];
    }

    function readiness() as Number or Null {
        var r = Application.Storage.getValue("readiness");
        return r instanceof Number ? r : null;
    }

    function dueIds() as Array {
        var d = Application.Storage.getValue("due");
        return d instanceof Array ? d : [];
    }

    //! Task list is from today and not older than 3 hours
    function fresh() as Boolean {
        var at = Application.Storage.getValue("tasksAt");
        return at instanceof Number && Time.now().value() - at < 3 * 60 * 60;
    }

    function isDue(id as String) as Boolean {
        var d = dueIds();
        for (var i = 0; i < d.size(); i += 1) {
            if (id.equals(d[i])) {
                return !isClosed(find(id));
            }
        }
        return false;
    }

    function find(id as String) as Array or Null {
        var t = tasks();
        for (var i = 0; i < t.size(); i += 1) {
            var row = t[i];
            if (row instanceof Array && id.equals(row[ID])) {
                return row;
            }
        }
        return null;
    }

    function isClosed(row as Array or Null) as Boolean {
        if (row == null) {
            return false;
        }
        var s = row[STATUS];
        return "done".equals(s) || "skipped".equals(s);
    }

    //! Optimistic local update after an action from the watch
    function setStatus(id as String, status as String, snoozedUntil as Number or Null) as Void {
        var t = tasks();
        for (var i = 0; i < t.size(); i += 1) {
            var row = t[i];
            if (row instanceof Array && id.equals(row[ID])) {
                row[STATUS] = status;
                row[SNOOZED] = snoozedUntil;
            }
        }
        Application.Storage.setValue("tasks", t as Array<Application.PropertyValueType>);
    }

    //! "HH:MM" -> minutes since midnight, or null
    function minutes(hhmm as Application.PersistableType) as Number or Null {
        if (!(hhmm instanceof String) || hhmm.length() < 5) {
            return null;
        }
        var h = hhmm.substring(0, 2);
        var m = hhmm.substring(3, 5);
        if (h == null || m == null) {
            return null;
        }
        var hn = h.toNumber();
        var mn = m.toNumber();
        return (hn == null || mn == null) ? null : hn * 60 + mn;
    }

    //! Next open task with a due time: the first one due from 30 min ago
    //! onwards, else the earliest overdue one. Rows are sorted by due time.
    function next() as Array or Null {
        if (!fresh()) {
            return null;
        }
        var clock = System.getClockTime();
        var nowMin = clock.hour * 60 + clock.min;
        var t = tasks();
        var overdue = null;
        for (var i = 0; i < t.size(); i += 1) {
            var row = t[i];
            if (!(row instanceof Array) || isClosed(row)) {
                continue;
            }
            var m = minutes(row[DUE]);
            if (m == null) {
                continue;
            }
            if (m >= nowMin - 30) {
                return row;
            }
            if (overdue == null) {
                overdue = row;
            }
        }
        return overdue;
    }

    //! [done, total] for today
    function progress() as Array<Number> {
        var t = tasks();
        var done = 0;
        for (var i = 0; i < t.size(); i += 1) {
            var row = t[i];
            if (row instanceof Array && "done".equals(row[STATUS])) {
                done += 1;
            }
        }
        return [done, t.size()];
    }

    //! True if the last sensor sync reached the app within 15 minutes
    function syncOk() as Boolean {
        var code = Application.Storage.getValue("lastResult");
        var t = Application.Storage.getValue("lastTime");
        return code instanceof Number && code == 200 && t instanceof Number && Time.now().value() - t < 15 * 60;
    }
}
