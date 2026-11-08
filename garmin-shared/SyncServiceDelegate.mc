import Toybox.ActivityMonitor;
import Toybox.Application;
import Toybox.Background;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.SensorHistory;
import Toybox.System;
import Toybox.Time;

//! Runs every 5 minutes (the Connect IQ minimum):
//!   1. POST sensor data to /api/watch/ingest
//!   2. GET today's routine tasks from /api/watch/tasks
//! and hands a small dictionary to AppBase.onBackgroundData:
//!   { "code" => ingest HTTP code, "tcode" => tasks HTTP code,
//!     "tasks" => [[id, title, due "HH:MM" or null, status, snoozedUntil or null], ...],
//!     "readiness" => Number or null, "due" => [id, ...] }
//! Background memory is 64 KB on the vívoactive 5, so only those fields are kept.
(:background)
class SyncServiceDelegate extends System.ServiceDelegate {

    //! Look back further than the 5-minute interval so a missed sync
    //! (phone out of range) is filled in next time. The server de-duplicates.
    const WINDOW_SECONDS = 30 * 60;

    //! Only device apps may ask to be opened (ignored for watch faces).
    private var _canWake as Boolean;
    private var _ingestCode as Number = 0;

    function initialize(canWake as Boolean) {
        ServiceDelegate.initialize();
        _canWake = canWake;
    }

    function onTemporalEvent() as Void {
        var payload = {
            "device" => System.getDeviceSettings().partNumber,
            "sentAt" => Time.now().value(),
            "info" => activityInfo(),
            "hr" => history(:hr),
            "stress" => history(:stress),
            "bodyBattery" => history(:bodyBattery),
            "spo2" => history(:spo2)
        };

        Communications.makeWebRequest(
            Config.INGEST_URL,
            payload,
            Api.options(Communications.HTTP_REQUEST_METHOD_POST),
            method(:onIngest)
        );
    }

    //! Sensor upload finished (any result): chain the tasks request
    function onIngest(code as Number, data as Dictionary or String or Null) as Void {
        _ingestCode = code;
        Communications.makeWebRequest(
            Api.url("/tasks"),
            null,
            Api.options(Communications.HTTP_REQUEST_METHOD_GET),
            method(:onTasks)
        );
    }

    function onTasks(code as Number, data as Dictionary or String or Null) as Void {
        var out = { "code" => _ingestCode, "tcode" => code } as Dictionary<String, Application.PropertyValueType>;
        if (code == 200 && data instanceof Dictionary) {
            var rows = TaskStore.rows(data);
            var due = data["dueNow"];
            out.put("tasks", rows);
            out.put("readiness", data["readiness"] as Number or Null);
            out.put("due", due instanceof Array ? due as Array<Application.PropertyValueType> : [] as Array<Application.PropertyValueType>);
            if (_canWake && due instanceof Array) {
                maybeWake(due, rows);
            }
        }
        try {
            Background.exit(out);
        } catch (e instanceof Background.ExitDataSizeLimitException) {
            out.remove("tasks");
            Background.exit(out);
        }
    }

    //! Ask the user to open the app for a newly due task. Skipped when the app
    //! is already open (it vibrates itself) and for tasks already announced.
    private function maybeWake(due as Array, rows as Array) as Void {
        var now = Time.now().value();
        var fgAt = Application.Storage.getValue("fgAt");
        if (fgAt instanceof Number && now - fgAt < 6 * 60) {
            return;
        }
        var prev = Application.Storage.getValue("woken");
        var prevIds = prev instanceof String ? prev : "";
        var ids = "";
        var newId = null;
        for (var i = 0; i < due.size(); i += 1) {
            var id = due[i];
            if (!(id instanceof String)) {
                continue;
            }
            ids += id + ",";
            if (newId == null && prevIds.find(id) == null) {
                newId = id;
            }
        }
        // Remember what was announced; an empty list re-arms snoozed tasks
        Application.Storage.setValue("woken", ids);
        if (newId == null) {
            return;
        }
        var title = "";
        for (var j = 0; j < rows.size(); j += 1) {
            var r = rows[j] as Array;
            if (newId.equals(r[0]) && r[1] instanceof String) {
                title = r[1] as String;
            }
        }
        Application.Storage.setValue("wakeTask", newId);
        Application.Storage.setValue("wakeAt", now);
        // Message limit is 255 bytes; titles are <= 40 chars from the server
        Background.requestApplicationWake("Task due: " + title);
    }

    //! Daily totals so far
    function activityInfo() as Dictionary {
        var i = ActivityMonitor.getInfo();
        var out = {};
        out.put("steps", i.steps);
        out.put("stepGoal", i.stepGoal);
        out.put("calories", i.calories);
        out.put("distanceCm", i.distance);
        if (i has :activeMinutesDay && i.activeMinutesDay != null) {
            out.put("activeMinutes", i.activeMinutesDay.total);
        }
        if (i has :floorsClimbed) { out.put("floorsClimbed", i.floorsClimbed); }
        if (i has :respirationRate) { out.put("respirationRate", i.respirationRate); }
        if (i has :timeToRecovery) { out.put("timeToRecoveryHours", i.timeToRecovery); }
        return out;
    }

    //! Samples from the last WINDOW_SECONDS as [[epochSeconds, value], ...]
    function history(kind as Symbol) as Array {
        var out = [];
        if (!(Toybox has :SensorHistory)) {
            return out;
        }
        var opts = {
            :period => new Time.Duration(WINDOW_SECONDS),
            :order => SensorHistory.ORDER_OLDEST_FIRST
        };
        var iter = null;
        if (kind == :hr && SensorHistory has :getHeartRateHistory) {
            iter = SensorHistory.getHeartRateHistory(opts);
        } else if (kind == :stress && SensorHistory has :getStressHistory) {
            iter = SensorHistory.getStressHistory(opts);
        } else if (kind == :bodyBattery && SensorHistory has :getBodyBatteryHistory) {
            iter = SensorHistory.getBodyBatteryHistory(opts);
        } else if (kind == :spo2 && SensorHistory has :getOxygenSaturationHistory) {
            iter = SensorHistory.getOxygenSaturationHistory(opts);
        }
        if (iter == null) {
            return out;
        }
        var s = iter.next();
        while (s != null) {
            if (s.data != null && s.when != null) {
                out.add([s.when.value(), s.data]);
            }
            s = iter.next();
        }
        return out;
    }
}
