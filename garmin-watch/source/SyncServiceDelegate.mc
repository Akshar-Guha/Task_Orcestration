import Toybox.ActivityMonitor;
import Toybox.Background;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.SensorHistory;
import Toybox.System;
import Toybox.Time;

(:background)
class SyncServiceDelegate extends System.ServiceDelegate {

    //! Look back further than the 5-minute interval so a missed sync
    //! (phone out of range) is filled in next time. The server de-duplicates.
    const WINDOW_SECONDS = 30 * 60;

    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() as Void {
        var payload = {
            "device" => "vivoactive5",
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
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :headers => {
                    "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON,
                    "x-watch-key" => Config.INGEST_KEY
                },
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onResponse)
        );
    }

    function onResponse(code as Number, data as Dictionary or String or Null) as Void {
        Background.exit(code);
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
