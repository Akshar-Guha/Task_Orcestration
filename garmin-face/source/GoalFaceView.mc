import Toybox.Activity;
import Toybox.ActivityMonitor;
import Toybox.Application;
import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.SensorHistory;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

//! Colours from the Goal Tracker web app
const BG    = 0x060B11;
const NAVY  = 0x1B2E45;
const GOLD  = 0xD4A853;
const TEXT  = 0xEEE8DF;
const MUTED = 0x6A7F96;

class GoalFaceView extends WatchUi.WatchFace {
    private var _sleeping as Boolean = false;

    function initialize() {
        WatchFace.initialize();
    }

    function onEnterSleep() as Void {
        _sleeping = true;
        WatchUi.requestUpdate();
    }

    function onExitSleep() as Void {
        _sleeping = false;
        WatchUi.requestUpdate();
    }

    function onUpdate(dc as Graphics.Dc) as Void {
        var cx = dc.getWidth() / 2;
        var cy = dc.getHeight() / 2;
        var clock = System.getClockTime();
        var hour = clock.hour;
        if (!System.getDeviceSettings().is24Hour) {
            hour = hour % 12;
            if (hour == 0) { hour = 12; }
        }
        var time = hour.format("%d") + ":" + clock.min.format("%02d");

        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        if (_sleeping) {
            // AMOLED always-on: few lit pixels, shifted each minute against burn-in
            var shift = (clock.min % 5) * 4 - 8;
            dc.setColor(MUTED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx + shift, cy + shift, Graphics.FONT_NUMBER_MEDIUM, time,
                Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
            return;
        }

        dc.setColor(BG, BG);
        dc.fillCircle(cx, cy, cx);
        drawTicks(dc, cx, cy);
        drawStepsArc(dc, cx, cy);

        // Date
        var info = Gregorian.info(Time.now(), Time.FORMAT_MEDIUM);
        dc.setColor(MUTED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 105, Graphics.FONT_XTINY,
            (info.day_of_week as String).toUpper() + " " + info.day.format("%d") + " " + (info.month as String).toUpper(),
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

        // Time
        dc.setColor(TEXT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 15, Graphics.FONT_NUMBER_THAI_HOT, time,
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);

        // Stats row: heart rate · Body Battery · steps
        var y = cy + 70;
        drawStat(dc, cx - 95, y, heartRate(), "BPM");
        drawStat(dc, cx, y, bodyBattery(), "BODY");
        drawStat(dc, cx + 95, y, stepsLabel(), "STEPS");

        // Sync indicator (gold = data reached the app recently) + battery
        dc.setColor(syncOk() ? GOLD : NAVY, Graphics.COLOR_TRANSPARENT);
        dc.fillPolygon([[cx, cy + 128], [cx + 7, cy + 135], [cx, cy + 142], [cx - 7, cy + 135]]);
        dc.setColor(MUTED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + 160, Graphics.FONT_XTINY, System.getSystemStats().battery.toNumber() + "%",
            Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    private function drawTicks(dc as Graphics.Dc, cx as Number, cy as Number) as Void {
        var r = cx - 6;
        for (var i = 0; i < 60; i += 1) {
            var a = Math.toRadians(i * 6 - 90);
            var major = i % 5 == 0;
            var len = i == 0 ? 36 : (major ? 22 : 9);
            dc.setPenWidth(i == 0 ? 5 : (major ? 3 : 1));
            dc.setColor(major ? GOLD : NAVY, Graphics.COLOR_TRANSPARENT);
            var c = Math.cos(a);
            var s = Math.sin(a);
            dc.drawLine(cx + (r - len) * c, cy + (r - len) * s, cx + r * c, cy + r * s);
        }
        dc.setPenWidth(1);
    }

    //! Gold arc = progress towards today's step goal
    private function drawStepsArc(dc as Graphics.Dc, cx as Number, cy as Number) as Void {
        var r = cx - 48;
        var info = ActivityMonitor.getInfo();
        var steps = info.steps != null ? info.steps : 0;
        var goal = (info.stepGoal != null && info.stepGoal > 0) ? info.stepGoal : 10000;
        var pct = steps.toFloat() / goal;
        if (pct > 1.0) { pct = 1.0; }

        dc.setPenWidth(4);
        dc.setColor(NAVY, Graphics.COLOR_TRANSPARENT);
        dc.drawCircle(cx, cy, r);
        if (pct > 0.005) {
            dc.setColor(GOLD, Graphics.COLOR_TRANSPARENT);
            var end = 90 - (pct * 360).toNumber();
            dc.drawArc(cx, cy, r, Graphics.ARC_CLOCKWISE, 90, end);
        }
        dc.setPenWidth(1);
    }

    private function drawStat(dc as Graphics.Dc, x as Number, y as Number, value as String, label as String) as Void {
        dc.setColor(TEXT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, Graphics.FONT_SMALL, value, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
        dc.setColor(GOLD, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y + 28, Graphics.FONT_XTINY, label, Graphics.TEXT_JUSTIFY_CENTER | Graphics.TEXT_JUSTIFY_VCENTER);
    }

    private function heartRate() as String {
        var hr = Activity.getActivityInfo().currentHeartRate;
        return hr != null ? hr.format("%d") : "--";
    }

    private function bodyBattery() as String {
        if ((Toybox has :SensorHistory) && (SensorHistory has :getBodyBatteryHistory)) {
            var it = SensorHistory.getBodyBatteryHistory({ :period => 1 });
            var s = it != null ? it.next() : null;
            if (s != null && s.data != null) {
                return (s.data as Number).format("%d");
            }
        }
        return "--";
    }

    private function stepsLabel() as String {
        var steps = ActivityMonitor.getInfo().steps;
        if (steps == null) { return "--"; }
        if (steps >= 10000) { return (steps / 1000.0).format("%.1f") + "k"; }
        return steps.format("%d");
    }

    //! True if the last background sync to the app succeeded within 15 min
    private function syncOk() as Boolean {
        var code = Application.Storage.getValue("lastResult");
        var t = Application.Storage.getValue("lastTime");
        return code == 200 && t != null && Time.now().value() - (t as Number) < 15 * 60;
    }
}
